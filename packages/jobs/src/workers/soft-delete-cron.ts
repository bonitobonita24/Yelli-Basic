import type { Job } from 'bullmq';
import { prisma } from '@yelli/db';
import { assertTenantUser, log } from './_validate';
import { QUEUE_NAMES, type SoftDeleteCronJobData } from '../queues';

/** Hard-delete grace window — LOCKED 7 days (PRODUCT.md §Roles L182 + §Non-functional L297). */
const GRACE_PERIOD_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * soft-delete-cron worker — sweeps users past the 7-day soft-delete grace period.
 *
 * Enqueued per tenant (V25 cron rule: iterate tenants explicitly — cron has no
 * request/session context, so every query is scoped to job.data.tenantId).
 *
 * Flow (DECISIONS_LOG q-W5-01):
 *   1. Find all Users in this tenant where removedAt < now()-7d.
 *   2. For each user: delete outgoing Invitations (FK NOT NULL — no standalone value),
 *      then hard-delete the User row (AuditLog.actorUserId SET NULL cascades per schema).
 *   3. No per-deletion AuditLog row is emitted here: the `user.delete` audit was already
 *      written by removeMember at soft-delete time. Emitting a second row would
 *      double-count in the Audit View. A structured log line is written per sweep for
 *      ops observability (security.md cron rule 7).
 *
 * Idempotent: re-runs on the same tenant are safe because the cutoff filter
 * (`removedAt < cutoff`) selects the same set until rows are deleted.
 *
 * Tenant-safe: all queries carry an explicit tenantId; the base Prisma client is
 * used (not the L6-guarded extension) since cron jobs have no session — same
 * pattern as device-archive.ts (security.md Queue Safety rule).
 */
export async function processSoftDeleteCron(job: Job<SoftDeleteCronJobData>): Promise<void> {
  assertTenantUser(job.data);
  const { tenantId } = job.data;
  const cutoff = new Date(Date.now() - GRACE_PERIOD_DAYS * DAY_MS);

  // Find users past the grace period for this tenant.
  const candidates = await prisma.user.findMany({
    where: {
      tenantId,
      removedAt: { not: null, lt: cutoff },
    },
    select: { id: true },
  });

  if (candidates.length === 0) {
    log('info', 'soft-delete-cron sweep complete — nothing to hard-delete', {
      queue: QUEUE_NAMES.softDeleteCron,
      jobId: job.id,
      tenantId,
      deleted: 0,
      gracePeriodDays: GRACE_PERIOD_DAYS,
    });
    return;
  }

  let deleted = 0;
  const errorIds: string[] = [];

  for (const { id: userId } of candidates) {
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Delete outgoing Invitations — invitedByUserId has no SET NULL cascade in the
        //    schema (it's nullable but has no onDelete policy), so we delete them first
        //    to unblock the User hard-delete.
        await tx.invitation.deleteMany({
          where: { tenantId, invitedByUserId: userId },
        });

        // 2. Hard-delete the User row. Schema-defined cascades fire automatically:
        //    AuditLog.actorUserId        → SET NULL (nullable FK; 7yr retention survives)
        //    Auth.js Session + Account   → onDelete: Cascade
        //    WebPushSubscription.userId  → SET NULL (nullable FK)
        //    ExportJob.requestedByUserId → SET NULL (nullable FK)
        //    Device.userId               → SET NULL (nullable FK)
        await tx.user.delete({ where: { id: userId, tenantId } });
      });
      deleted++;
    } catch (err) {
      // Per-user errors are logged but don't abort the sweep — other users in this
      // tenant still get cleaned up. The failed user is retried on the next scheduled run.
      errorIds.push(userId);
      log('error', 'soft-delete-cron: failed to hard-delete user', {
        queue: QUEUE_NAMES.softDeleteCron,
        jobId: job.id,
        tenantId,
        userId,
        err: (err as Error).message,
      });
    }
  }

  log('info', 'soft-delete-cron sweep complete', {
    queue: QUEUE_NAMES.softDeleteCron,
    jobId: job.id,
    tenantId,
    candidates: candidates.length,
    deleted,
    errors: errorIds.length,
    gracePeriodDays: GRACE_PERIOD_DAYS,
  });
}
