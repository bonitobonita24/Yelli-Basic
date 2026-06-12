import type { Job } from 'bullmq';
import { assertTenantUser, log } from './_validate';
import { QUEUE_NAMES, type LogoImageJobData } from '../queues';

/**
 * logo-image worker — STUB (implementation lands in the BullMQ wiring session).
 *
 * Processes a tenant branding logo upload: magic-byte verify (PNG/JPEG ONLY —
 * LOCKED MIME whitelist; SVG/HTML rejected as XSS vector), resize to the 36×36
 * app-shell render target + retina variants, re-encode, write back to storage,
 * set Tenant.logoUrl. ≤2 MiB (MAX_BRANDING_BYTES).
 */
export async function processLogoImage(job: Job<LogoImageJobData>): Promise<void> {
  assertTenantUser(job.data);
  log('info', 'logo-image job received (stub — not yet implemented)', {
    queue: QUEUE_NAMES.logoImage,
    jobId: job.id,
    tenantId: job.data.tenantId,
    storageKey: job.data.storageKey,
  });
  // TODO(BullMQ wiring session): magic-byte verify PNG/JPEG, resize + re-encode,
  // upload variants, update Tenant.logoUrl. Reject any non-PNG/JPEG payload.
  throw new Error('logo-image worker not yet implemented (S3 stub).');
}
