import type { Queue } from 'bullmq';

import { QUEUE_NAMES, createQueue, createRedisConnection, type LogoImageJobData } from '@yelli/jobs';

/**
 * Logo-image queue PRODUCER — branding logo resize/optimization trigger (W4 scope).
 *
 * brand.update validates + uploads the ORIGINAL logo to storage and sets
 * Tenant.logoUrl immediately, so branding works without the worker. This enqueues
 * the `logo-image` job (LOCKED: resize to the 36×36 app-shell target + retina
 * variants + re-encode) for later optimization. The CONSUMER worker is a stub
 * until the BullMQ-wiring session — W4 only fires the trigger, mirroring the W3
 * email-queue / W2a realtime-bus "ready API, call-site here" pattern.
 *
 * Best-effort + build/test-safe, identical to apps/yelli/src/server/jobs/email-queue.ts:
 *   - A lazy singleton Queue is created on first enqueue, ONLY when REDIS_URL is set
 *     (no Valkey → enqueue no-ops; importing the module is side-effect-free).
 *   - A failed enqueue is logged, never thrown: the logo is already live on
 *     Tenant.logoUrl and its AuditLog row is committed; the resize is a non-critical
 *     enhancement that an admin can re-trigger by re-saving branding.
 */
let queue: Queue<LogoImageJobData> | null = null;

function getLogoQueue(): Queue<LogoImageJobData> | null {
  if (!process.env['REDIS_URL']) return null; // No Valkey configured → enqueue is a no-op.
  if (!queue) {
    const connection = createRedisConnection();
    connection.on('error', (err) => console.error('[logo-queue] connection error:', err.message));
    queue = createQueue(QUEUE_NAMES.logoImage, connection);
  }
  return queue;
}

/**
 * Fire a logo resize job (best-effort). `storageKey` is the key of the uploaded
 * original; the worker fetches, magic-byte re-verifies, resizes, and writes the
 * processed variants back (security.md Queue Safety #1: every job carries
 * tenantId + userId).
 */
export async function enqueueLogoImage(input: {
  tenantId: string;
  userId: string;
  storageKey: string;
}): Promise<void> {
  const q = getLogoQueue();
  if (!q) return;
  try {
    await q.add('logo-image', {
      tenantId: input.tenantId,
      userId: input.userId,
      storageKey: input.storageKey,
    });
  } catch (err) {
    console.error('[logo-queue] enqueue failed —', (err as Error).message);
  }
}
