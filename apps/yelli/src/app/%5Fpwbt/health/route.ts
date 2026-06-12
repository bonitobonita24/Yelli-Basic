import { Redis } from 'ioredis';

import { prisma } from '@yelli/db';
import { SIGNALING_HEARTBEAT_KEY } from '@yelli/shared';

// Health must always reflect live state — never cached, Node runtime (Prisma + ioredis).
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /_pwbt/health — uptime probe (DECISIONS_LOG L88). Returns
 * `{ ok, db, valkey, signaling }`, HTTP 200 when all green else 503, no auth.
 * (The `%5F` folder name is Next's escape so the underscore-prefixed `_pwbt`
 * segment is routed rather than treated as a private folder.)
 *
 * The `signaling` field is driven by the short-TTL heartbeat key the standalone
 * signaling server (W2b) refreshes — presence ⇒ a signaler is alive within TTL.
 *
 * Rate-limiting (60/min/IP, L88) is an edge/proxy concern enforced by Traefik +
 * the tRPC rate-limit middleware Wire — intentionally not re-implemented here.
 */

// Reuse one Valkey connection across requests (and across dev hot-reloads).
const globalForRedis = globalThis as unknown as { __healthRedis?: Redis };

function getRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!globalForRedis.__healthRedis) {
    globalForRedis.__healthRedis = new Redis(url, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    globalForRedis.__healthRedis.on('error', () => {
      /* swallowed — surfaced as valkey:false below */
    });
  }
  return globalForRedis.__healthRedis;
}

async function checkDb(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function checkValkey(redis: Redis | null): Promise<boolean> {
  if (!redis) return false;
  try {
    return (await redis.ping()) === 'PONG';
  } catch {
    return false;
  }
}

async function checkSignaling(redis: Redis | null): Promise<boolean> {
  if (!redis) return false;
  try {
    return (await redis.get(SIGNALING_HEARTBEAT_KEY)) !== null;
  } catch {
    return false;
  }
}

export async function GET(): Promise<Response> {
  const redis = getRedis();
  const [db, valkey, signaling] = await Promise.all([
    checkDb(),
    checkValkey(redis),
    checkSignaling(redis),
  ]);
  const ok = db && valkey && signaling;
  return Response.json({ ok, db, valkey, signaling }, { status: ok ? 200 : 503 });
}
