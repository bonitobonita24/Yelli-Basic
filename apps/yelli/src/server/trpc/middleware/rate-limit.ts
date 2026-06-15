import { TRPCError } from '@trpc/server';
import { Redis } from 'ioredis';

import { middleware } from '../trpc';

/**
 * Tiered Valkey-backed rate limiter (inputs.yml security.rate_limiting).
 *
 * Tiers and limits (LOCKED from inputs.yml):
 *   auth     10 req/min/IP   — unauthenticated paths (sign-in, password reset)
 *   api     100 req/min/user — authenticated API calls (keyed by userId)
 *   public  300 req/min/IP   — public/read-only endpoints
 *   upload   20 req/min/user — file/logo upload endpoints
 *
 * Algorithm: sliding-window counter via atomic INCR + EXPIRE.
 *   key = `yelli:rl:<tier>:<identity>` (identity = userId or IP)
 *   On first increment the key is given a 60s TTL (atomically via EXPIRE NX so
 *   a concurrent racing INCR doesn't reset the window).
 *
 * Fail-open: when Valkey is unavailable the request passes through and the error
 * is logged. This keeps the app available during Valkey outages; the Traefik +
 * next-middleware edge layer handles gross abuse independently.
 *
 * Usage: compose this middleware BEFORE authMiddleware for auth-tier calls, or
 * AFTER for api-tier calls where userId is available on ctx.
 *
 * The tier is supplied at the procedure level by passing it as input to the
 * factory. The default tier is 'api' with fail-open for unknown tiers.
 */

/** Rate-limit tiers — mirrors inputs.yml security.rate_limiting. */
export type RateLimitTier = 'auth' | 'api' | 'public' | 'upload';

export const TIER_LIMITS: Record<RateLimitTier, number> = {
  auth: 10,
  api: 100,
  public: 300,
  upload: 20,
};

const WINDOW_SEC = 60;

// Lazy singleton — mirrors idempotency.ts pattern (best-effort, fail-open).
let _client: Redis | null = null;

function getRateLimitClient(): Redis | null {
  const url = process.env['REDIS_URL'];
  if (!url) return null;
  if (!_client) {
    _client = new Redis(url, { maxRetriesPerRequest: null });
    _client.on('error', (err) =>
      console.error(
        JSON.stringify({ level: 'error', msg: '[rate-limit] redis error', err: err.message }),
      ),
    );
  }
  return _client;
}

function rateLimitKey(tier: RateLimitTier, identity: string): string {
  return `yelli:rl:${tier}:${identity}`;
}

/**
 * Check and increment the sliding-window counter for a given tier + identity.
 * Returns `{ allowed: true }` when under the limit, `{ allowed: false }` when
 * the limit is exceeded. Fails open to `{ allowed: true }` on any Valkey error.
 */
async function checkLimit(
  tier: RateLimitTier,
  identity: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const redis = getRateLimitClient();
  const limit = TIER_LIMITS[tier];

  if (!redis) return { allowed: true, remaining: limit };

  const key = rateLimitKey(tier, identity);
  try {
    // Atomic pipeline: INCR + EXPIRE NX (does not reset an existing TTL).
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, WINDOW_SEC, 'NX');
    const results = await pipeline.exec();

    if (!results) return { allowed: true, remaining: limit };

    const count = results[0]?.[1] as number | null;
    if (typeof count !== 'number') return { allowed: true, remaining: limit };

    const remaining = Math.max(0, limit - count);
    return { allowed: count <= limit, remaining };
  } catch (err) {
    // Fail-open: Valkey error → let the request through, log server-side only.
    console.error(
      JSON.stringify({
        level: 'error',
        msg: '[rate-limit] check failed — failing open',
        tier,
        identity,
        err: (err as Error).message,
      }),
    );
    return { allowed: true, remaining: limit };
  }
}

/**
 * Create a rate-limit middleware for the given tier.
 *
 * Identity resolution:
 *   - 'api' and 'upload' tiers key by `ctx.session?.user?.id` (authenticated).
 *     Falls back to IP when userId is unavailable (should not happen on protected
 *     procedures, but guards against configuration drift).
 *   - 'auth' and 'public' tiers key by the forwarded IP header.
 *
 * IP is read from `x-forwarded-for` (Traefik sets this). The first IP in the
 * chain is used (closest client — consistent with Traefik trusted-proxy config).
 * Falls back to 'unknown' when no header is present (dev / test environment).
 */
export function createRateLimitMiddleware(tier: RateLimitTier = 'api') {
  return middleware(async ({ ctx, next, getRawInput }) => {
    void getRawInput; // suppress unused-param lint; available if needed for input-based keying

    // Resolve identity based on tier.
    let identity: string;
    const userId = (ctx.session as { user?: { id?: string } } | null)?.user?.id;

    if ((tier === 'api' || tier === 'upload') && userId) {
      identity = userId;
    } else {
      // Extract IP from x-forwarded-for — set by Traefik in staging/prod.
      // In the tRPC fetch-adapter context the Request object isn't directly on ctx;
      // we read the env-injected header if the context carries it, else use 'unknown'.
      const forwarded =
        (ctx as unknown as { headers?: Headers })?.headers?.get?.('x-forwarded-for') ??
        'unknown';
      identity = forwarded.split(',')[0]?.trim() ?? 'unknown';
    }

    const { allowed, remaining } = await checkLimit(tier, identity);

    if (!allowed) {
      console.error(
        JSON.stringify({
          level: 'warn',
          msg: '[rate-limit] limit exceeded',
          tier,
          identity,
          limit: TIER_LIMITS[tier],
          windowSec: WINDOW_SEC,
        }),
      );
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Rate limit exceeded. Retry after ${WINDOW_SEC}s.`,
      });
    }

    // Propagate remaining count on ctx so procedures can surface it in headers if needed.
    return next({ ctx: { rateLimitRemaining: remaining } });
  });
}

/**
 * Default exported middleware — 'api' tier (100 req/min/user).
 * Named export for use in procedure chain composition.
 */
export const rateLimitMiddleware = createRateLimitMiddleware('api');
