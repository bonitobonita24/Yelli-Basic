import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Rate-limit middleware — tested via a minimal tRPC router that wires the
 * middleware into a procedure, then driven through createCaller (matching the
 * pattern used in all other router/middleware tests in this codebase).
 *
 * Tests: allow under limit, block at limit, fail-open on Valkey error,
 * fail-open when REDIS_URL unset, TIER_LIMITS values match inputs.yml.
 */

const h = vi.hoisted(() => {
  const pipeline = {
    incr: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn(),
  };
  // Object that will be returned as the Redis "instance".
  const redisInstance = {
    pipeline: vi.fn(() => pipeline),
    on: vi.fn(),
  };
  // Must be a regular function (not arrow) so it can be called with `new`.
  const RedisCtor = vi.fn(function () {
    return redisInstance;
  });
  return { pipeline, redisInstance, RedisCtor };
});

vi.mock('ioredis', () => ({ Redis: h.RedisCtor }));

// Import after mock (top-level await; vitest ESM isolation handles module re-use per test file).
const { createRateLimitMiddleware, TIER_LIMITS } = await import('../rate-limit');
const { initTRPC } = await import('@trpc/server');
const superjson = await import('superjson');

// ── test router wired to the rate-limit middleware ────────────────────────────

function makeRouter(tier: import('../rate-limit').RateLimitTier, sessionUserId?: string) {
  const t = initTRPC.context<{ session: { user: { id: string } } | null }>().create({
    transformer: superjson,
  });
  const mw = createRateLimitMiddleware(tier);
  const proc = t.procedure.use(mw).query(() => ({ ok: true }));
  const r = t.router({ ping: proc });
  return r.createCaller({ session: sessionUserId ? { user: { id: sessionUserId } } : null });
}

// ── helpers ───────────────────────────────────────────────────────────────────

function mockCount(count: number) {
  h.pipeline.exec.mockResolvedValue([[null, count], [null, 1]]);
}

// ── tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  process.env['REDIS_URL'] = 'redis://localhost:6379';
  // Restore pipeline mock behavior after clearAllMocks().
  h.pipeline.incr.mockReturnThis();
  h.pipeline.expire.mockReturnThis();
  h.redisInstance.pipeline.mockReturnValue(h.pipeline);
});

describe('TIER_LIMITS — matches inputs.yml security.rate_limiting', () => {
  it('has the correct per-tier limits', () => {
    expect(TIER_LIMITS).toMatchObject({
      auth: 10,
      api: 100,
      public: 300,
      upload: 20,
    });
  });
});

describe('createRateLimitMiddleware — allow / block', () => {
  it('allows a request under the api limit (count 50 < 100)', async () => {
    mockCount(50);
    const caller = makeRouter('api', 'u1');
    await expect(caller.ping()).resolves.toMatchObject({ ok: true });
  });

  it('blocks a request when count exceeds the api limit (101 > 100)', async () => {
    mockCount(101);
    const caller = makeRouter('api', 'u1');
    await expect(caller.ping()).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' } satisfies Partial<TRPCError>);
  });

  it('blocks at exactly limit+1 for auth tier (11 > 10)', async () => {
    mockCount(11);
    const caller = makeRouter('auth');
    await expect(caller.ping()).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
  });

  it('allows at exactly limit-1 for auth tier (9 < 10)', async () => {
    mockCount(9);
    const caller = makeRouter('auth');
    await expect(caller.ping()).resolves.toBeDefined();
  });

  it('allows under the public tier limit (299 < 300)', async () => {
    mockCount(299);
    const caller = makeRouter('public');
    await expect(caller.ping()).resolves.toBeDefined();
  });

  it('blocks over the upload tier limit (21 > 20)', async () => {
    mockCount(21);
    const caller = makeRouter('upload', 'u1');
    await expect(caller.ping()).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
  });
});

describe('createRateLimitMiddleware — fail-open', () => {
  it('fails open when Valkey pipeline throws (request passes through)', async () => {
    h.pipeline.exec.mockRejectedValue(new Error('ECONNREFUSED'));
    const caller = makeRouter('api', 'u1');
    await expect(caller.ping()).resolves.toBeDefined();
  });

  it('fails open when REDIS_URL is not set', async () => {
    delete process.env['REDIS_URL'];
    const caller = makeRouter('api', 'u1');
    await expect(caller.ping()).resolves.toBeDefined();
    expect(h.redisInstance.pipeline).not.toHaveBeenCalled();
  });

  it('fails open when pipeline returns null results', async () => {
    h.pipeline.exec.mockResolvedValue(null);
    const caller = makeRouter('api', 'u1');
    await expect(caller.ping()).resolves.toBeDefined();
  });
});

describe('createRateLimitMiddleware — identity keying', () => {
  it('keys by userId for api tier', async () => {
    mockCount(1);
    const caller = makeRouter('api', 'user-abc');
    await caller.ping();
    expect(h.pipeline.incr).toHaveBeenCalledWith('yelli:rl:api:user-abc');
  });

  it('falls back to "unknown" for auth tier (no headers available via createCaller)', async () => {
    mockCount(1);
    const caller = makeRouter('auth');
    await caller.ping();
    // createCaller has no real Request headers, so identity resolves to 'unknown'.
    expect(h.pipeline.incr).toHaveBeenCalledWith('yelli:rl:auth:unknown');
  });
});
