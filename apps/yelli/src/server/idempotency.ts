import { Redis } from 'ioredis';

/**
 * Valkey idempotency dedup primitive (PRODUCT.md §21 — mutation replay queue).
 *
 * A flaky-network client re-sends a queued mutation with a stable UUIDv7
 * `idempotencyKey`; the server must execute it AT MOST once per
 * (actorUserId, idempotencyKey) within a 24h window. This helper is the dedup
 * primitive: a single atomic `SET key 1 NX EX 86400`. The first caller "reserves"
 * the key (returns `{ duplicate: false }`); any replay inside 24h sees the key is
 * already held (`{ duplicate: true }`) and the caller skips the side effect.
 *
 * W6a ships this primitive only. The client-side replay queue + per-mutation
 * wrapping land in W6b (q-W6-01 split). ioredis is pinned to 5.10.1 via the root
 * pnpm.overrides, deduped with the realtime-bus + @yelli/jobs instances.
 *
 * Best-effort, fail-open: when REDIS_URL is unset (build / unit-test / a Valkey
 * outage) the helper returns `{ duplicate: false }` so the mutation still runs —
 * the durable per-entity DB constraints remain the correctness backstop, exactly
 * as the realtime-bus best-effort convention (bus.ts). Importing this module is
 * side-effect-free (lazy connection).
 */

/** LOCKED 24h dedup window (PRODUCT.md §21). */
const IDEMPOTENCY_TTL_SEC = 24 * 60 * 60;

const idempotencyKey = (actorUserId: string, key: string): string =>
  `yelli:idem:${actorUserId}:${key}`;

let client: Redis | null = null;

function getClient(): Redis | null {
  const url = process.env['REDIS_URL'];
  if (!url) return null; // No Valkey configured → dedup is a no-op (fail-open).
  if (!client) {
    client = new Redis(url, { maxRetriesPerRequest: null });
    client.on('error', (err) => console.error('[idempotency] redis error:', err.message));
  }
  return client;
}

/**
 * Atomically reserve `(actorUserId, idempotencyKey)` for 24h.
 *
 * @returns `{ duplicate: false }` if this is the first time the key was seen
 *   (the caller SHOULD perform the mutation), or `{ duplicate: true }` if the key
 *   was already reserved within the window (the caller SHOULD skip the mutation).
 *   Fails open to `{ duplicate: false }` when Valkey is unavailable.
 */
export async function reserveIdempotencyKey(
  actorUserId: string,
  key: string,
): Promise<{ duplicate: boolean }> {
  const redis = getClient();
  if (!redis) return { duplicate: false };
  try {
    const result = await redis.set(
      idempotencyKey(actorUserId, key),
      '1',
      'EX',
      IDEMPOTENCY_TTL_SEC,
      'NX',
    );
    // ioredis returns 'OK' when the key was set (first time), null when NX failed.
    return { duplicate: result === null };
  } catch (err) {
    console.error('[idempotency] reserve failed —', (err as Error).message);
    return { duplicate: false }; // fail-open
  }
}
