import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { type DsrStatus, type DsrType } from '@yelli/db';
import { userDisplayNameSchema } from '@yelli/shared';

import { resolveAuditActorId } from '../audit-actor';
import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

/**
 * DSR (Data Subject Request) router — PH Data Privacy Act (RA 10173) §16 rights.
 * All procedures are `protectedProcedure`: userId / tenantId are ALWAYS derived from
 * ctx.session — never from input (L6 tenant isolation, security.md #13).
 *
 * Statutory response window: 15 calendar days (NPC reasonable period; NPC Advisory
 * Opinion 2016-49 and IRR Rule XI §47 — adjust if NPC issues a narrower circular).
 *
 * Legal-retention exceptions baked in:
 *   AuditLog  — 7 years  (RA 10173 §21 + SEC/BIR records-retention rules)
 *   CallSession — 1 year (operational log, proportionality principle)
 * DSR erase therefore = soft-delete own user record (set removedAt + isSuspended),
 * NOT cascade-purge of legally-retained rows.
 */

/** Days added to requestedAt to compute dueAt per NPC reasonable-period guidance. */
const DSR_DUE_DAYS = 15;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Create a DataSubjectRequest row + emit an AuditLog entry for a DSR event. */
async function createDsrRecord(
  db: Parameters<Parameters<typeof protectedProcedure.mutation>[0]>[0]['ctx']['db'],
  opts: {
    tenantId: string;
    userId: string;
    actorUserId: string;
    type: DsrType;
    status: DsrStatus;
    action: string;
    evidenceUrl?: string;
  },
) {
  const now = new Date();
  const dueAt = addDays(now, DSR_DUE_DAYS);
  await db.dataSubjectRequest.create({
    data: {
      tenantId: opts.tenantId,
      userId: opts.userId,
      type: opts.type,
      status: opts.status,
      dueAt,
      resolvedAt: opts.status === 'COMPLETED' ? now : undefined,
      evidenceUrl: opts.evidenceUrl,
    },
  });
  await db.auditLog.create({
    data: {
      tenantId: opts.tenantId,
      actorUserId: resolveAuditActorId(opts.actorUserId),
      action: opts.action,
      targetType: 'DataSubjectRequest',
      targetId: opts.userId,
    },
  });
}

export const dsrRouter = router({
  /**
   * dsr.access — Right to be Informed / Access (RA 10173 §16(c)).
   * Returns a machine-readable copy of the subject's own personal data:
   *   own User profile + Devices owned + CallSessions (as caller/callee) +
   *   AuditLog rows where actorUserId = self + ConsentLog entries.
   * tenantId is omitted from returned rows (security.md #13).
   */
  access: protectedProcedure.query(async ({ ctx }) => {
    const { id: userId, tenantId } = ctx.user;

    const [user, devices, callSessions, auditEntries, consentEntries] = await Promise.all([
      ctx.db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          emailVerifiedAt: true,
          displayName: true,
          role: true,
          isSuspended: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      ctx.db.device.findMany({
        where: { tenantId, userId },
        select: {
          id: true,
          displayName: true,
          callRole: true,
          browserFingerprint: true,
          assignedRoleAt: true,
          lastSeenAt: true,
          archivedAt: true,
          createdAt: true,
        },
      }),
      ctx.db.callSession.findMany({
        where: {
          tenantId,
          OR: [
            { callerDevice: { userId } },
            { calleeDevice: { userId } },
          ],
        },
        select: {
          id: true,
          callerRoleAtCall: true,
          calleeRoleAtCall: true,
          startedAt: true,
          connectedAt: true,
          endedAt: true,
          durationSec: true,
          endReason: true,
        },
        orderBy: { startedAt: 'desc' },
        take: 500, // reasonable cap — full export uses dsr.port
      }),
      ctx.db.auditLog.findMany({
        where: { tenantId, actorUserId: userId },
        select: {
          id: true,
          action: true,
          targetType: true,
          targetId: true,
          payload: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      ctx.db.consentLog.findMany({
        where: { tenantId, userId },
        select: {
          id: true,
          purpose: true,
          lawfulBasis: true,
          noticeVersion: true,
          granted: true,
          grantedAt: true,
          withdrawnAt: true,
        },
        orderBy: { grantedAt: 'desc' },
      }),
    ]);

    if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found.' });

    await createDsrRecord(ctx.db, {
      tenantId,
      userId,
      actorUserId: userId,
      type: 'ACCESS',
      status: 'COMPLETED',
      action: 'dsr.access',
    });

    return { user, devices, callSessions, auditEntries, consentEntries };
  }),

  /**
   * dsr.port — Right to Data Portability (RA 10173 §16(f)).
   * Returns the same structured JSON as dsr.access but packaged as a portable export.
   * Long-running bulk exports for large accounts would be enqueued to BullMQ;
   * for Yelli's user scale this is synchronous.
   */
  port: protectedProcedure.query(async ({ ctx }) => {
    const { id: userId, tenantId } = ctx.user;

    const [user, devices, callSessions, auditEntries, consentEntries] = await Promise.all([
      ctx.db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          emailVerifiedAt: true,
          displayName: true,
          role: true,
          isSuspended: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      ctx.db.device.findMany({
        where: { tenantId, userId },
        select: {
          id: true,
          displayName: true,
          callRole: true,
          browserFingerprint: true,
          assignedRoleAt: true,
          lastSeenAt: true,
          archivedAt: true,
          createdAt: true,
        },
      }),
      ctx.db.callSession.findMany({
        where: {
          tenantId,
          OR: [
            { callerDevice: { userId } },
            { calleeDevice: { userId } },
          ],
        },
        select: {
          id: true,
          callerRoleAtCall: true,
          calleeRoleAtCall: true,
          startedAt: true,
          connectedAt: true,
          endedAt: true,
          durationSec: true,
          endReason: true,
        },
        orderBy: { startedAt: 'desc' },
      }),
      ctx.db.auditLog.findMany({
        where: { tenantId, actorUserId: userId },
        select: {
          id: true,
          action: true,
          targetType: true,
          targetId: true,
          payload: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      ctx.db.consentLog.findMany({
        where: { tenantId, userId },
        select: {
          id: true,
          purpose: true,
          lawfulBasis: true,
          noticeVersion: true,
          granted: true,
          grantedAt: true,
          withdrawnAt: true,
        },
      }),
    ]);

    if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found.' });

    await createDsrRecord(ctx.db, {
      tenantId,
      userId,
      actorUserId: userId,
      type: 'PORT',
      status: 'COMPLETED',
      action: 'dsr.port',
    });

    return {
      exportedAt: new Date().toISOString(),
      subject: user,
      devices,
      callSessions,
      auditEntries,
      consentEntries,
    };
  }),

  /**
   * dsr.rectify — Right to Rectification (RA 10173 §16(d)).
   * Validates + applies a patch to own records.  Currently supports:
   *   displayName — any valid display name
   *   email       — must be unique within the tenant; bumps securityVersion on change
   *                 (session-invalidation per security.md §AUTH #6).
   */
  rectify: protectedProcedure
    .input(
      z.object({
        displayName: userDisplayNameSchema.optional(),
        email: z.string().email().max(254).optional(),
      }).refine((v) => v.displayName !== undefined || v.email !== undefined, {
        message: 'At least one field (displayName or email) must be provided.',
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id: userId, tenantId } = ctx.user;

      if (input.email) {
        // Guard @@unique([tenantId, email]) before attempting the update.
        const conflict = await ctx.db.user.findFirst({
          where: { tenantId, email: input.email, NOT: { id: userId } },
          select: { id: true },
        });
        if (conflict) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'That email address is already in use within this tenant.',
          });
        }
      }

      const updated = await ctx.db.user.update({
        where: { id: userId },
        data: {
          ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
          ...(input.email !== undefined
            ? {
                email: input.email,
                emailVerifiedAt: null, // re-verify on email change
                securityVersion: { increment: 1 },
              }
            : {}),
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          isSuspended: true,
          updatedAt: true,
        },
      });

      await createDsrRecord(ctx.db, {
        tenantId,
        userId,
        actorUserId: userId,
        type: 'RECTIFY',
        status: 'COMPLETED',
        action: 'dsr.rectify',
      });

      return updated;
    }),

  /**
   * dsr.erase — Right to Erasure / Blocking (RA 10173 §16(e)).
   * Self-soft-delete: sets removedAt + isSuspended=true on own account.
   * Legal-retention exceptions are honoured by NOT purging AuditLog (7yr) or
   * CallSession (1yr) rows — those must survive per RA 10173 §21.
   * Hard-delete after the 7-day grace period is handled by the existing cron job
   * (DECISIONS_LOG q-W5-01 — same soft-delete semantics as removeMember).
   */
  erase: protectedProcedure.mutation(async ({ ctx }) => {
    const { id: userId, tenantId } = ctx.user;
    const now = new Date();

    await ctx.db.user.update({
      where: { id: userId },
      data: {
        removedAt: now,
        isSuspended: true,
        securityVersion: { increment: 1 },
      },
    });

    await createDsrRecord(ctx.db, {
      tenantId,
      userId,
      actorUserId: userId,
      type: 'ERASE',
      status: 'COMPLETED',
      action: 'dsr.erase',
    });

    return { erasedAt: now };
  }),

  /**
   * dsr.myRequests — list own DSR history (all types, all statuses).
   * Pagination-free: DSR rows per user are small in practice.
   */
  myRequests: protectedProcedure.query(async ({ ctx }) => {
    const { id: userId, tenantId } = ctx.user;
    return ctx.db.dataSubjectRequest.findMany({
      where: { tenantId, userId },
      select: {
        id: true,
        type: true,
        status: true,
        requestedAt: true,
        dueAt: true,
        resolvedAt: true,
        evidenceUrl: true,
      },
      orderBy: { requestedAt: 'desc' },
    });
  }),
});
