import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { Prisma } from '@yelli/db';
import { browserFingerprintSchema, callRoleSchema, deviceDisplayNameSchema } from '@yelli/shared';

import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

/**
 * Devices router — LAN/Cloud device identity + lifecycle. Production wiring of the
 * Phase 3.3 `sim.devices` surface (the SWAP BOUNDARY). Every query/mutation runs
 * under the LOCKED protectedProcedure 5-step chain: the L6 tenant-guard (`ctx.db`)
 * auto-scopes every row to the caller's tenant, and each mutation writes one L5
 * AuditLog row using the §11-canonical action vocabulary VERBATIM (@yelli/shared).
 *
 * tenantId is omitted from every client-facing row via DEVICE_SELECT (security.md
 * #13 — internal isolation key the client never needs). The L5 write is inlined on
 * the L6-guarded transaction client (`tx.auditLog.create`); AuditLog is excluded
 * from the guard, so tenantId is passed explicitly. `device.archive.batch` is the
 * cron path (packages/jobs), not a router procedure, so it is intentionally absent.
 */
const ONLINE_WINDOW_MS = 5 * 60 * 1000; // PRODUCT.md presence rule (5 min).

const DEVICE_SELECT = {
  id: true,
  userId: true,
  displayName: true,
  callRole: true,
  browserFingerprint: true,
  assignedRoleAt: true,
  lastSeenAt: true,
  archivedAt: true,
  createdAt: true,
} satisfies Prisma.DeviceSelect;

const idInput = z.object({ id: z.string().min(1) });

function requireAdmin(role: string): void {
  if (role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin role required.' });
  }
}

export const devicesRouter = router({
  // ── Queries ────────────────────────────────────────────────────────────────
  /** All devices in the tenant, newest first (directory + Manage Devices screen). */
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.device.findMany({ where: {}, select: DEVICE_SELECT, orderBy: { createdAt: 'desc' } }),
  ),

  /** Non-archived devices seen within the 5-minute presence window (callable peers). */
  listOnline: protectedProcedure.query(({ ctx }) => {
    const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS);
    return ctx.db.device.findMany({
      where: { archivedAt: null, lastSeenAt: { gte: cutoff } },
      select: DEVICE_SELECT,
      orderBy: { displayName: 'asc' },
    });
  }),

  byId: protectedProcedure.input(idInput).query(({ ctx, input }) =>
    ctx.db.device.findUnique({ where: { id: input.id }, select: DEVICE_SELECT }),
  ),

  // ── Mutations ──────────────────────────────────────────────────────────────
  /** Register a device (Flow D). displayName may be empty on auto-join — the name
   *  picker later calls setDisplayName, which emits device.first_join. */
  register: protectedProcedure
    .input(
      z.object({
        displayName: deviceDisplayNameSchema.optional(),
        browserFingerprint: browserFingerprintSchema,
        callRole: callRoleSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const displayName = input.displayName ?? '';
      return ctx.db.$transaction(async (tx) => {
        const device = await tx.device.create({
          data: {
            tenantId: ctx.tenantId,
            displayName,
            browserFingerprint: input.browserFingerprint,
            callRole: input.callRole ?? 'receiver',
            // Owner is ALWAYS the authenticated caller — never client-supplied
            // (prevents device-ownership + audit-actor spoofing). LAN-anonymous
            // (userId=null) registration is a separate unauthenticated path.
            userId: ctx.user.id,
          },
          select: DEVICE_SELECT,
        });
        await tx.auditLog.create({
          data: {
            tenantId: ctx.tenantId,
            actorUserId: ctx.user.id,
            action: 'device.create',
            targetType: 'Device',
            targetId: device.id,
            payload: { deviceId: device.id, displayName: device.displayName },
          },
        });
        return device;
      });
    }),

  /** Set a device's display name. First set (prior empty) → device.first_join;
   *  otherwise → device.rename (mirrors sim.devices.setDisplayName). */
  setDisplayName: protectedProcedure
    .input(idInput.extend({ displayName: deviceDisplayNameSchema }))
    .mutation(async ({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        const prior = await tx.device.findUnique({ where: { id: input.id } });
        if (!prior) throw new TRPCError({ code: 'NOT_FOUND', message: 'Device not found.' });
        // Ownership: only the device owner (self-rename / first_join) or an admin
        // (Flow G Manage Devices) may rename — prevents cross-member rename (IDOR).
        if (ctx.user.role !== 'admin' && prior.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Not permitted.' });
        }
        const device = await tx.device.update({
          where: { id: input.id },
          data: { displayName: input.displayName },
          select: DEVICE_SELECT,
        });
        const firstJoin = prior.displayName.trim() === '';
        await tx.auditLog.create({
          data: {
            tenantId: ctx.tenantId,
            actorUserId: ctx.user.id,
            action: firstJoin ? 'device.first_join' : 'device.rename',
            targetType: 'Device',
            targetId: device.id,
            payload: firstJoin
              ? { deviceId: device.id, name: device.displayName }
              : { deviceId: device.id, from: prior.displayName, to: device.displayName },
          },
        });
        return device;
      }),
    ),

  /** Assign a device's call role (Flow C). Admin-only — callRole is admin-assigned. */
  setRole: protectedProcedure
    .input(idInput.extend({ role: callRoleSchema }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      return ctx.db.$transaction(async (tx) => {
        const prior = await tx.device.findUnique({ where: { id: input.id } });
        if (!prior) throw new TRPCError({ code: 'NOT_FOUND', message: 'Device not found.' });
        const device = await tx.device.update({
          where: { id: input.id },
          data: { callRole: input.role, assignedRoleAt: new Date() },
          select: DEVICE_SELECT,
        });
        await tx.auditLog.create({
          data: {
            tenantId: ctx.tenantId,
            actorUserId: ctx.user.id,
            action: 'device.role.assign',
            targetType: 'Device',
            targetId: device.id,
            payload: { deviceId: device.id, from: prior.callRole, to: device.callRole },
          },
        });
        return device;
      });
    }),

  /** Presence heartbeat — bumps lastSeenAt. No audit (high-frequency, non-material). */
  touch: protectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    try {
      return await ctx.db.device.update({
        where: { id: input.id },
        data: { lastSeenAt: new Date() },
        select: DEVICE_SELECT,
      });
    } catch {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Device not found.' });
    }
  }),

  /** Archive a single device (Flow G, admin). Distinct from the cron device.archive.batch. */
  archive: protectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    requireAdmin(ctx.user.role);
    return ctx.db.$transaction(async (tx) => {
      const prior = await tx.device.findUnique({ where: { id: input.id } });
      if (!prior) throw new TRPCError({ code: 'NOT_FOUND', message: 'Device not found.' });
      const device = await tx.device.update({
        where: { id: input.id },
        data: { archivedAt: new Date() },
        select: DEVICE_SELECT,
      });
      await tx.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          actorUserId: ctx.user.id,
          action: 'device.archive',
          targetType: 'Device',
          targetId: device.id,
          payload: { deviceId: device.id },
        },
      });
      return device;
    });
  }),

  /** Restore an archived device (admin). Resets presence so it can call again. */
  unarchive: protectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    requireAdmin(ctx.user.role);
    return ctx.db.$transaction(async (tx) => {
      const prior = await tx.device.findUnique({ where: { id: input.id } });
      if (!prior) throw new TRPCError({ code: 'NOT_FOUND', message: 'Device not found.' });
      const device = await tx.device.update({
        where: { id: input.id },
        data: { archivedAt: null, lastSeenAt: new Date() },
        select: DEVICE_SELECT,
      });
      await tx.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          actorUserId: ctx.user.id,
          action: 'device.unarchive',
          targetType: 'Device',
          targetId: device.id,
          payload: { deviceId: device.id },
        },
      });
      return device;
    });
  }),

  /** Permanently delete a device (admin). */
  delete: protectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    requireAdmin(ctx.user.role);
    return ctx.db.$transaction(async (tx) => {
      const prior = await tx.device.findUnique({ where: { id: input.id } });
      if (!prior) throw new TRPCError({ code: 'NOT_FOUND', message: 'Device not found.' });
      await tx.device.delete({ where: { id: input.id } });
      await tx.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          actorUserId: ctx.user.id,
          action: 'device.delete',
          targetType: 'Device',
          targetId: prior.id,
          payload: { deviceId: prior.id },
        },
      });
      return { id: prior.id };
    });
  }),
});
