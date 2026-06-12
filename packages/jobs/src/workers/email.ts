import type { Job } from 'bullmq';
import { assertTenantUser, log } from './_validate';
import { QUEUE_NAMES, type EmailJobData } from '../queues';

/**
 * email worker — STUB (implementation lands in the BullMQ wiring session).
 *
 * Sends transactional email: invitation / verify / reset. Cloud uses the platform
 * SMTP; LAN account mode uses the customer-configured SMTP. The token is single-
 * use + time-limited (Auth Defaults #2/#3).
 */
export async function processEmail(job: Job<EmailJobData>): Promise<void> {
  assertTenantUser(job.data);
  log('info', 'email job received (stub — not yet implemented)', {
    queue: QUEUE_NAMES.email,
    jobId: job.id,
    tenantId: job.data.tenantId,
    kind: job.data.kind,
  });
  // TODO(BullMQ wiring session): render the template for job.data.kind and send
  // via the configured SMTP transport. Never log the token or recipient PII.
  throw new Error('email worker not yet implemented (S3 stub).');
}
