import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { Prisma, type Role } from '@yelli/db';

import { publishSessionInvalidate } from '@/server/realtime/bus';

import { resolveAuditActorId } from '../audit-actor';
import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

/**
 * Tenants router — tenant profile + member administration. Production wiring of the
 * Phase 3.3 `sim.tenants` / `sim.users` admin surface.
 *
 * Member mutations implement the LOCKED roles model (DECISIONS [Steps 1, 6]): any
 * Tenant Admin may promote/demote/suspend peers; the LAST-ADMIN GUARD blocks the
 * demotion / suspension of the sole remaining effective admin; transfer-admin is an
 * ATOMIC promote+demote transaction. Every role/status change bumps
 * User.securityVersion (so the Auth.js jwt callback kills stale JWTs on the next
 * call — security.md §AUTH #6 / V28) AND fires `publishSessionInvalidate` so live
 * sessions drop within the LOCKED 30s SLO (W2a bus — this is the deferred call-site).
 *
 * Audit actions use the §11-canonical vocabulary VERBATIM (@yelli/shared):
 * user.role.promote / user.role.demote / user.suspend. There is NO `user.unsuspend`
 * in the locked vocabulary, so un-suspend emits no audit (W1a precedent). tenantId is
 * never returned on member rows (security.md #13) — MEMBER_SELECT omits it.
 *
 * DEFERRED:
 *   - removeMember (hard User delete): the current locked schema has no soft-delete
 *     column, and a hard delete collides with FK integrity (Invitation.invitedByUserId
 *     NOT NULL) + AuditLog immutability (actorUserId provenance). Needs a schema/policy
 *     decision (soft-delete column or cascade strategy); suspend is the MVP deactivation
 *     path. Surfaced as a non-blocking question.
 *   - tenant.export.* (request/list/markDownloaded): a `tenant-export` queue-worker
 *     concern (S3 signed URL + status→ready) — rides with the BullMQ-wiring/storage
 *     session alongside the worker that fulfils it, not W3.
 *   - tenant.branding.update + admin passphrase: the branding+storage Wire session (W5).
 */
const TENANT_SELECT = {
  id: true,
  slug: true,
  displayName: true,
  logoUrl: true,
  isSuspended: true,
  createdAt: true,
} satisfies Prisma.TenantSelect;

const userIdInput = z.object({ userId: z.string().min(1) });

type MemberRow = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  isSuspended: boolean;
  createdAt: Date;
};

/** Curate a full User row down to the client-safe member shape (no secrets, no tenantId). */
function toMember(u: MemberRow): MemberRow {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    isSuspended: u.isSuspended,
    createdAt: u.createdAt,
  };
}

function requireAdmin(role: string): void {
  if (role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin role required.' });
  }
}

/** Fire the W2a session-kill bus for a member whose role/status just changed
 *  (best-effort; no-op without Valkey). Carries the new securityVersion so every
 *  instance drops the stale JWT within the 30s SLO (security.md REALTIME #3). */
function invalidate(tenantId: string, userId: string, securityVersion: number): Promise<void> {
  return publishSessionInvalidate(tenantId, {
    userId,
    securityVersion,
    at: new Date().toISOString(),
  });
}

export const tenantsRouter = router({
  /** The caller's own tenant profile (TenantTopBar / brand surfaces). Tenant is
   *  excluded from the L6 guard, so the by-id read is direct. */
  get: protectedProcedure.query(async ({ ctx }) => {
    const tenant = await ctx.db.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: TENANT_SELECT,
    });
    if (!tenant) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant not found.' });
    return tenant;
  }),

  /** Promote a member → admin. */
  promoteMember: protectedProcedure.input(userIdInput).mutation(async ({ ctx, input }) => {
    requireAdmin(ctx.user.role);
    const updated = await ctx.db.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: input.userId } });
      if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found.' });
      if (target.role === 'admin') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Already an admin.' });
      }
      const next = await tx.user.update({
        where: { id: input.userId },
        data: { role: 'admin', securityVersion: { increment: 1 } },
      });
      await tx.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          actorUserId: resolveAuditActorId(ctx.user.id),
          action: 'user.role.promote',
          targetType: 'User',
          targetId: next.id,
          payload: { userId: next.id, from: 'member', to: 'admin' },
        },
      });
      return next;
    });
    await invalidate(ctx.tenantId, updated.id, updated.securityVersion);
    return toMember(updated);
  }),

  /** Demote an admin → member (last-admin guarded). */
  demoteMember: protectedProcedure.input(userIdInput).mutation(async ({ ctx, input }) => {
    requireAdmin(ctx.user.role);
    const updated = await ctx.db.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: input.userId } });
      if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found.' });
      if (target.role !== 'admin') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not an admin.' });
      }
      if (target.role === 'admin' && !target.isSuspended) {
        const others = await tx.user.count({
          where: { role: 'admin', isSuspended: false, id: { not: target.id } },
        });
        if (others === 0) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Cannot remove the last admin.' });
        }
      }
      const next = await tx.user.update({
        where: { id: input.userId },
        data: { role: 'member', securityVersion: { increment: 1 } },
      });
      await tx.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          actorUserId: resolveAuditActorId(ctx.user.id),
          action: 'user.role.demote',
          targetType: 'User',
          targetId: next.id,
          payload: { userId: next.id, from: 'admin', to: 'member' },
        },
      });
      return next;
    });
    await invalidate(ctx.tenantId, updated.id, updated.securityVersion);
    return toMember(updated);
  }),

  /** Suspend a member (last-admin guarded). Force-kills their live session within
   *  the 30s SLO (V28). */
  suspendMember: protectedProcedure.input(userIdInput).mutation(async ({ ctx, input }) => {
    requireAdmin(ctx.user.role);
    const updated = await ctx.db.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: input.userId } });
      if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found.' });
      if (target.isSuspended) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Already suspended.' });
      }
      if (target.role === 'admin' && !target.isSuspended) {
        const others = await tx.user.count({
          where: { role: 'admin', isSuspended: false, id: { not: target.id } },
        });
        if (others === 0) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Cannot remove the last admin.' });
        }
      }
      const next = await tx.user.update({
        where: { id: input.userId },
        data: { isSuspended: true, securityVersion: { increment: 1 } },
      });
      await tx.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          actorUserId: resolveAuditActorId(ctx.user.id),
          action: 'user.suspend',
          targetType: 'User',
          targetId: next.id,
          payload: { userId: next.id },
        },
      });
      return next;
    });
    await invalidate(ctx.tenantId, updated.id, updated.securityVersion);
    return toMember(updated);
  }),

  /** Lift a suspension. No §11 audit action exists for un-suspend (locked vocabulary),
   *  so none is emitted (W1a precedent); securityVersion is still bumped so any stale
   *  JWT is rejected on its next freshness check. */
  unsuspendMember: protectedProcedure.input(userIdInput).mutation(async ({ ctx, input }) => {
    requireAdmin(ctx.user.role);
    const updated = await ctx.db.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: input.userId } });
      if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found.' });
      if (!target.isSuspended) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not suspended.' });
      }
      return tx.user.update({
        where: { id: input.userId },
        data: { isSuspended: false, securityVersion: { increment: 1 } },
      });
    });
    await invalidate(ctx.tenantId, updated.id, updated.securityVersion);
    return toMember(updated);
  }),

  /** Atomic admin transfer (DECISIONS [Step 6] = single promote+demote transaction):
   *  promote `userId` (a member) → admin AND demote the calling admin → member. The
   *  promote-before-demote ordering keeps ≥1 admin at all times, so no last-admin
   *  guard is needed. Both parties' sessions are invalidated. */
  transferAdmin: protectedProcedure.input(userIdInput).mutation(async ({ ctx, input }) => {
    requireAdmin(ctx.user.role);
    if (input.userId === ctx.user.id) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot transfer admin to yourself.' });
    }
    const { promoted, demoted } = await ctx.db.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: input.userId } });
      if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found.' });
      if (target.role !== 'member') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Target is already an admin.' });
      }
      const promoted = await tx.user.update({
        where: { id: input.userId },
        data: { role: 'admin', securityVersion: { increment: 1 } },
      });
      const demoted = await tx.user.update({
        where: { id: ctx.user.id },
        data: { role: 'member', securityVersion: { increment: 1 } },
      });
      await tx.auditLog.createMany({
        data: [
          {
            tenantId: ctx.tenantId,
            actorUserId: resolveAuditActorId(ctx.user.id),
            action: 'user.role.promote',
            targetType: 'User',
            targetId: promoted.id,
            payload: { userId: promoted.id, from: 'member', to: 'admin', transfer: true },
          },
          {
            tenantId: ctx.tenantId,
            actorUserId: resolveAuditActorId(ctx.user.id),
            action: 'user.role.demote',
            targetType: 'User',
            targetId: demoted.id,
            payload: { userId: demoted.id, from: 'admin', to: 'member', transfer: true },
          },
        ],
      });
      return { promoted, demoted };
    });
    await Promise.all([
      invalidate(ctx.tenantId, promoted.id, promoted.securityVersion),
      invalidate(ctx.tenantId, demoted.id, demoted.securityVersion),
    ]);
    return { admin: toMember(promoted), formerAdmin: toMember(demoted) };
  }),
});
