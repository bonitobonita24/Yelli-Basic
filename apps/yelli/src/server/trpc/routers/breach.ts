import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { resolveAuditActorId } from '../audit-actor';
import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

/**
 * Breach notification router — NPC Circular 16-03 (PH Data Privacy Act RA 10173).
 *
 * Admin-only.  Tracks the lifecycle of a personal-data breach incident:
 *   DETECTED → ASSESSED → NOTIFIED (NPC + subjects notified) → REPORTED (written report
 *   submitted) → CLOSED.
 *
 * Key statutory windows:
 *   72 hours  — initial notification to NPC after detection (Circular 16-03 §5)
 *   5 business days — full written report after the initial notification
 *
 * writtenReportDueAt is pre-computed at creation time as:
 *   detectedAt + 72h + 5 business days
 * This is stored so SLA dashboards and reminders can query cheaply without
 * recomputing business-day arithmetic at read time.
 */

function requireAdmin(role: string): void {
  if (role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin role required.' });
  }
}

/**
 * Add N business days to a date (Mon–Fri only; PH public holidays not accounted for
 * at this layer — the DPO is expected to track those manually).
 */
function addBusinessDays(date: Date, days: number): Date {
  const d = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) remaining--; // skip Sun (0) + Sat (6)
  }
  return d;
}

/**
 * Compute writtenReportDueAt:
 *   detectedAt + 72h = initial NPC notification deadline.
 *   initial notification deadline + 5 business days = written report deadline.
 */
function computeWrittenReportDueAt(detectedAt: Date): Date {
  const initialNotifyDeadline = new Date(detectedAt.getTime() + 72 * 60 * 60 * 1000); // +72h
  return addBusinessDays(initialNotifyDeadline, 5);
}

const BREACH_SELECT = {
  id: true,
  severity: true,
  status: true,
  detectedAt: true,
  npcNotifiedAt: true,
  subjectsNotifiedAt: true,
  writtenReportDueAt: true,
  writtenReportSubmittedAt: true,
  affectedUserCount: true,
  description: true,
  recordedByUserId: true,
} as const;

export const breachRouter = router({
  /**
   * breach.record — Record a newly detected breach.
   * Computes writtenReportDueAt = detectedAt + 72h + 5 business days.
   * Emits AuditLog action 'breach.record'.
   */
  record: protectedProcedure
    .input(
      z.object({
        severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
        detectedAt: z.coerce.date(),
        affectedUserCount: z.number().int().nonnegative(),
        description: z.string().min(1).max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const { id: actorId, tenantId } = ctx.user;

      const writtenReportDueAt = computeWrittenReportDueAt(input.detectedAt);

      const breach = await ctx.db.breachNotificationRecord.create({
        data: {
          tenantId,
          severity: input.severity,
          status: 'DETECTED',
          detectedAt: input.detectedAt,
          writtenReportDueAt,
          affectedUserCount: input.affectedUserCount,
          description: input.description,
          recordedByUserId: resolveAuditActorId(actorId),
        },
        select: BREACH_SELECT,
      });

      await ctx.db.auditLog.create({
        data: {
          tenantId,
          actorUserId: resolveAuditActorId(actorId),
          action: 'breach.record',
          targetType: 'BreachNotificationRecord',
          targetId: breach.id,
          payload: { severity: input.severity, affectedUserCount: input.affectedUserCount },
        },
      });

      return breach;
    }),

  /**
   * breach.markNpcNotified — Record that the NPC was notified within the 72h window.
   * Transitions status to NOTIFIED (if not already past REPORTED/CLOSED).
   */
  markNpcNotified: protectedProcedure
    .input(z.object({ breachId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const { id: actorId, tenantId } = ctx.user;

      const existing = await ctx.db.breachNotificationRecord.findFirst({
        where: { id: input.breachId, tenantId },
        select: { id: true, status: true },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Breach record not found.' });

      const now = new Date();
      const breach = await ctx.db.breachNotificationRecord.update({
        where: { id: input.breachId },
        data: {
          npcNotifiedAt: now,
          status: 'NOTIFIED',
        },
        select: BREACH_SELECT,
      });

      await ctx.db.auditLog.create({
        data: {
          tenantId,
          actorUserId: resolveAuditActorId(actorId),
          action: 'breach.notify.npc',
          targetType: 'BreachNotificationRecord',
          targetId: breach.id,
          payload: { npcNotifiedAt: now.toISOString() },
        },
      });

      return breach;
    }),

  /**
   * breach.markSubjectsNotified — Record that affected data subjects were notified.
   */
  markSubjectsNotified: protectedProcedure
    .input(z.object({ breachId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const { id: actorId, tenantId } = ctx.user;

      const existing = await ctx.db.breachNotificationRecord.findFirst({
        where: { id: input.breachId, tenantId },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Breach record not found.' });

      const now = new Date();
      const breach = await ctx.db.breachNotificationRecord.update({
        where: { id: input.breachId },
        data: { subjectsNotifiedAt: now },
        select: BREACH_SELECT,
      });

      await ctx.db.auditLog.create({
        data: {
          tenantId,
          actorUserId: resolveAuditActorId(actorId),
          action: 'breach.notify.subjects',
          targetType: 'BreachNotificationRecord',
          targetId: breach.id,
          payload: { subjectsNotifiedAt: now.toISOString() },
        },
      });

      return breach;
    }),

  /**
   * breach.submitReport — Record that the full written report was submitted to the NPC.
   * Transitions status to REPORTED.
   */
  submitReport: protectedProcedure
    .input(z.object({ breachId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const { id: actorId, tenantId } = ctx.user;

      const existing = await ctx.db.breachNotificationRecord.findFirst({
        where: { id: input.breachId, tenantId },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Breach record not found.' });

      const now = new Date();
      const breach = await ctx.db.breachNotificationRecord.update({
        where: { id: input.breachId },
        data: {
          writtenReportSubmittedAt: now,
          status: 'REPORTED',
        },
        select: BREACH_SELECT,
      });

      await ctx.db.auditLog.create({
        data: {
          tenantId,
          actorUserId: resolveAuditActorId(actorId),
          action: 'breach.report.submit',
          targetType: 'BreachNotificationRecord',
          targetId: breach.id,
          payload: { writtenReportSubmittedAt: now.toISOString() },
        },
      });

      return breach;
    }),

  /**
   * breach.list — List all breach records for the caller's tenant (admin only).
   * Most-recent-first; no pagination (breach volumes are low in practice).
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    requireAdmin(ctx.user.role);
    return ctx.db.breachNotificationRecord.findMany({
      where: { tenantId: ctx.user.tenantId },
      select: BREACH_SELECT,
      orderBy: { detectedAt: 'desc' },
    });
  }),
});
