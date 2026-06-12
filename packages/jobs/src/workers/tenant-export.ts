import type { Job } from 'bullmq';
import { assertTenantUser, log } from './_validate';
import { QUEUE_NAMES, type TenantExportJobData } from '../queues';

/**
 * tenant-export worker — STUB (implementation lands in the BullMQ wiring session).
 *
 * Assembles a JSON bundle (Users + Devices + AuditLog + CallSession scoped by
 * tenantId) → uploads to S3/MinIO under `exports/<tenantId>/<jobId>.json` →
 * emails the requesting admin a signed download URL valid 24h. Rate-limited
 * 1/tenant/24h. AuditLog: `tenant.export.request` / `.complete` / `.failed`.
 */
export async function processTenantExport(job: Job<TenantExportJobData>): Promise<void> {
  assertTenantUser(job.data);
  log('info', 'tenant-export job received (stub — not yet implemented)', {
    queue: QUEUE_NAMES.tenantExport,
    jobId: job.id,
    tenantId: job.data.tenantId,
    exportJobId: job.data.exportJobId,
  });
  // TODO(BullMQ wiring session): assemble tenant-scoped JSON bundle, upload to
  // S3/MinIO, email the signed 24h URL, write tenant.export.complete AuditLog.
  throw new Error('tenant-export worker not yet implemented (S3 stub).');
}
