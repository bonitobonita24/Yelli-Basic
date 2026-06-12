import type { Job } from 'bullmq';
import { assertTenantUser, log } from './_validate';
import { QUEUE_NAMES, type SoftDeleteCronJobData } from '../queues';

/**
 * soft-delete-cron worker — STUB (implementation lands in the BullMQ wiring session).
 *
 * Sweeps members whose 7-day soft-delete grace period has elapsed (set on Remove
 * Member, flow #14) and hard-deletes them. Enqueued per tenant (V25 cron rule).
 */
export async function processSoftDeleteCron(job: Job<SoftDeleteCronJobData>): Promise<void> {
  assertTenantUser(job.data);
  log('info', 'soft-delete-cron job received (stub — not yet implemented)', {
    queue: QUEUE_NAMES.softDeleteCron,
    jobId: job.id,
    tenantId: job.data.tenantId,
  });
  // TODO(BullMQ wiring session): hard-delete members past the 7-day soft-delete
  // grace for this tenant; cascade per schema; write the corresponding AuditLog.
  throw new Error('soft-delete-cron worker not yet implemented (S3 stub).');
}
