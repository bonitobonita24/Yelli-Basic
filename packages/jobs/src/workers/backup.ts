import type { Job } from 'bullmq';
import { assertSystemJob, log } from './_validate';
import { QUEUE_NAMES, type BackupJobData } from '../queues';

/**
 * backup worker — STUB (implementation lands in the BullMQ wiring session).
 *
 * Cron daily 02:00 UTC. Whole-DB `pg_dump --format=custom --compress=9` →
 * `s3://yelli-backups-prod/postgres/YYYY-MM-DD.dump`; 30-day retention, Glacier
 * IR after 7 days. NOT tenant-scoped — guarded by the stricter `assertSystemJob`
 * (LOCKED exception: tenantId '_pwbt' + userId 'system').
 */
export async function processBackup(job: Job<BackupJobData>): Promise<void> {
  assertSystemJob(job.data);
  log('info', 'backup job received (stub — not yet implemented)', {
    queue: QUEUE_NAMES.backup,
    jobId: job.id,
  });
  // TODO(BullMQ wiring session): run pg_dump custom/compress=9, upload to the
  // backups bucket, apply 30d/Glacier-IR-7d lifecycle, emit structured result.
  throw new Error('backup worker not yet implemented (S3 stub).');
}
