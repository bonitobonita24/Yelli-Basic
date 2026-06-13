import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

/**
 * Push router — Web Push subscription registration + PWA install audit
 * (PRODUCT.md §20 push, §11 + §19 install). Production wiring of the W6 PWA surface.
 *
 * SCOPE (q-W6-04): every procedure is `protectedProcedure`, binding tenantId + userId
 * from the Auth.js v5 session (same as W1a/W3/W4). The LAN-anonymous device-only
 * subscription path (nullable userId on WebPushSubscription) is DEFERRED to the
 * follow-up that resolves the deviceId↔user binding (q-W2b-04) — we do NOT ship a
 * publicProcedure device-fingerprint shortcut here.
 *
 * The `deviceId` is client-supplied but VERIFIED in-tenant before any write: the
 * lookup runs through the L6-guarded `ctx.db`, so a deviceId belonging to another
 * tenant resolves to null → NOT_FOUND (security.md IDOR / batch-ownership). Writes
 * to WebPushSubscription go through `ctx.db` too, so tenantId is L6-injected.
 *
 * NOTE: SENDING push (web-push + VAPID private key) is a worker concern, not W6a —
 * these endpoints only record the subscription rows the sender will later read.
 */

const subscribeInput = z.object({
  deviceId: z.string().min(1).max(64),
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(256),
  }),
  // The browser PushSubscription.expirationTime (epoch ms) or null.
  expirationTime: z.number().int().positive().nullable().optional(),
});

// 404 (not 403) when a deviceId is absent or belongs to another tenant: the lookup
// runs through the L6-guarded client, so a cross-tenant id resolves to null and we
// do not confirm it exists (security.md error/IDOR rules). Inlined (not a shared
// helper) so it types against the real L6-extended `ctx.db` without a hand-written
// client shape.
const DEVICE_NOT_FOUND = new TRPCError({ code: 'NOT_FOUND', message: 'Device not found.' });

export const pushRouter = router({
  /**
   * Register (or refresh) a Web Push subscription for the caller's device.
   * Upsert-by-endpoint without Prisma `upsert` (the L6 extension injects tenantId
   * into `data` only, not into `upsert.create`, so we branch explicitly): find the
   * existing row scoped to the tenant, then update-by-id or create.
   */
  subscribe: protectedProcedure.input(subscribeInput).mutation(async ({ ctx, input }) => {
    const device = await ctx.db.device.findUnique({
      where: { id: input.deviceId },
      select: { id: true },
    });
    if (!device) throw DEVICE_NOT_FOUND;

    const expiresAt = input.expirationTime != null ? new Date(input.expirationTime) : null;

    // endpoint is globally @unique; via the L6 guard this findFirst is tenant-scoped.
    const existing = await ctx.db.webPushSubscription.findFirst({
      where: { endpoint: input.endpoint },
      select: { id: true },
    });

    if (existing) {
      await ctx.db.webPushSubscription.update({
        where: { id: existing.id },
        data: {
          deviceId: input.deviceId,
          userId: ctx.user.id,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          expiresAt,
          lastUsedAt: new Date(),
        },
      });
    } else {
      // tenantId is L6-injected into `data`; userId bound from the session.
      await ctx.db.webPushSubscription.create({
        data: {
          deviceId: input.deviceId,
          userId: ctx.user.id,
          endpoint: input.endpoint,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          expiresAt,
        },
      });
    }

    return { ok: true };
  }),

  /** Remove a subscription by endpoint. Idempotent (deleteMany; 0-row safe). */
  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string().url().max(2048) }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.db.webPushSubscription.deleteMany({
        where: { endpoint: input.endpoint },
      });
      return { deleted: count };
    }),

  /**
   * Record a PWA install (PRODUCT.md §11 + §19; flow #19). Emits the §11-canonical
   * `pwa.install` audit action VERBATIM, deduped by deviceId: a device that already
   * has a `pwa.install` row in this tenant does not produce a second one (re-install
   * / multi-tab is a no-op). `platform` is the client-reported install platform
   * (navigator.userAgentData.platform), stored in the audit payload.
   */
  recordInstall: protectedProcedure
    .input(
      z.object({
        deviceId: z.string().min(1).max(64),
        platform: z.string().max(64).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const device = await ctx.db.device.findUnique({
        where: { id: input.deviceId },
        select: { id: true },
      });
      if (!device) throw DEVICE_NOT_FOUND;

      // Dedup by deviceId. AuditLog is L6-excluded → scope tenantId explicitly
      // (security.md #10), matching the audit router read pattern.
      const already = await ctx.db.auditLog.findFirst({
        where: {
          tenantId: ctx.tenantId,
          action: 'pwa.install',
          targetType: 'Device',
          targetId: input.deviceId,
        },
        select: { id: true },
      });
      if (already) return { recorded: false };

      await ctx.recordAudit(
        'pwa.install',
        { type: 'Device', id: input.deviceId },
        input.platform ? { platform: input.platform } : {},
      );
      return { recorded: true };
    }),
});
