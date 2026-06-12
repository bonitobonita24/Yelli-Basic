import type { Job } from 'bullmq';
import { assertTenantUser, log } from './_validate';
import { QUEUE_NAMES, type DeviceArchiveJobData } from '../queues';

/**
 * device-archive worker — STUB (implementation lands in the BullMQ wiring session).
 *
 * Cron daily 03:00 UTC; the scheduler enqueues one job per tenant (V25 cron rule).
 * Sweeps devices not seen in ≥90 days → set `archivedAt` → write `device.archive`
 * AuditLog. Auto-unarchive is handled on reconnect (not here).
 */
export async function processDeviceArchive(job: Job<DeviceArchiveJobData>): Promise<void> {
  assertTenantUser(job.data);
  log('info', 'device-archive job received (stub — not yet implemented)', {
    queue: QUEUE_NAMES.deviceArchive,
    jobId: job.id,
    tenantId: job.data.tenantId,
  });
  // TODO(BullMQ wiring session): sweep devices offline ≥90d for this tenant,
  // set archivedAt, hide from default admin views, write device.archive AuditLog.
  throw new Error('device-archive worker not yet implemented (S3 stub).');
}
