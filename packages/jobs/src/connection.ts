import { Redis, type RedisOptions } from 'ioredis';

/**
 * Shared ioredis connection factory for BullMQ.
 *
 * REDIS_URL points at Valkey (MIT Redis fork) — see inputs.yml / .env.*.
 * BullMQ Workers REQUIRE `maxRetriesPerRequest: null` (they issue blocking
 * commands); we default it here so every Queue/Worker shares the same contract.
 *
 * ioredis is pinned to EXACT 5.10.1 (LOCKED: ioredis version pin) and deduped
 * with bullmq's bundled instance via the root `pnpm.overrides.ioredis`.
 */
export function createRedisConnection(options: RedisOptions = {}): Redis {
  const url = process.env['REDIS_URL'];
  if (!url) {
    throw new Error('REDIS_URL is not set — cannot create a BullMQ Redis connection.');
  }
  return new Redis(url, { maxRetriesPerRequest: null, ...options });
}
