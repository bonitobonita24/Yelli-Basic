import type { Redis } from 'ioredis';

import { SIGNALING_HEARTBEAT_KEY, type SignalingHeartbeat } from '@yelli/shared';

/**
 * Liveness heartbeat. The signaler refreshes a single short-TTL Valkey key on an
 * interval; GET /_pwbt/health reads it and reports the `signaling` field as
 * healthy iff the key is still present (i.e. refreshed within its TTL). If this
 * process dies, the key expires and health flips the field to false — no separate
 * service-discovery needed (DECISIONS_LOG L88).
 *
 * Best-effort: a failed write is logged, never thrown.
 */
export function startHeartbeat(
  redis: Redis,
  ttlSec: number,
  countPeers: () => number,
): () => void {
  // Refresh at half the TTL so a single missed tick never expires the key.
  const intervalMs = Math.max(1, Math.floor((ttlSec * 1000) / 2));

  const write = async (): Promise<void> => {
    const payload: SignalingHeartbeat = {
      at: new Date().toISOString(),
      peers: countPeers(),
      pid: process.pid,
    };
    try {
      await redis.set(SIGNALING_HEARTBEAT_KEY, JSON.stringify(payload), 'EX', ttlSec);
    } catch (err) {
      console.error('[signaling] heartbeat write failed —', (err as Error).message);
    }
  };

  void write();
  const timer = setInterval(() => void write(), intervalMs);
  // Don't keep the event loop alive solely for the heartbeat.
  timer.unref?.();

  return () => clearInterval(timer);
}
