import type { Queue } from 'bullmq';

import { QUEUE_NAMES, createQueue, createRedisConnection, type EmailJobData } from '@yelli/jobs';

/**
 * Email queue PRODUCER — the "invitation email queue trigger" (W3 scope).
 *
 * Enqueues a transactional invitation email onto the LOCKED `email` BullMQ queue
 * (@yelli/jobs QUEUE_NAMES.email). The CONSUMER (the worker that renders the
 * template + sends via SMTP) is a stub until the BullMQ-wiring session — W3 only
 * fires the trigger, mirroring the W2a realtime-bus "ready API, call-site here"
 * pattern.
 *
 * Build/test-safe + best-effort, exactly like apps/yelli/src/server/realtime/bus.ts:
 *   - A lazy singleton Queue is created on first enqueue, and ONLY when REDIS_URL
 *     is configured. With no Valkey (unit tests, `next build`), enqueues no-op, so
 *     importing this module is side-effect-free.
 *   - A failed enqueue is logged, never thrown: the invitation row + its AuditLog
 *     are already committed, and the admin can `invitations.resend` to re-fire the
 *     email. Letting an enqueue failure roll back a committed invite would be wrong.
 */
let queue: Queue<EmailJobData> | null = null;

function getEmailQueue(): Queue<EmailJobData> | null {
  if (!process.env['REDIS_URL']) return null; // No Valkey configured → enqueue is a no-op.
  if (!queue) {
    const connection = createRedisConnection();
    connection.on('error', (err) => console.error('[email-queue] connection error:', err.message));
    queue = createQueue(QUEUE_NAMES.email, connection);
  }
  return queue;
}

/**
 * Fire an invitation email (best-effort). `token` is the RAW single-use token —
 * it is NEVER persisted (only its SHA-256 hash is stored on Invitation.tokenHash);
 * it travels solely in the email link the worker renders.
 */
export async function enqueueInvitationEmail(input: {
  tenantId: string;
  /** The inviting admin — the job's actor (security.md Queue Safety #1: every job carries tenantId + userId). */
  userId: string;
  to: string;
  token: string;
}): Promise<void> {
  const q = getEmailQueue();
  if (!q) return;
  try {
    await q.add('invitation', {
      tenantId: input.tenantId,
      userId: input.userId,
      kind: 'invitation',
      to: input.to,
      token: input.token,
    });
  } catch (err) {
    console.error('[email-queue] invitation enqueue failed —', (err as Error).message);
  }
}
