import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Error middleware — tested via a minimal tRPC router that wires the middleware
 * into a procedure. Pattern mirrors brand.test.ts / tenants.test.ts (createCaller).
 *
 * Tests: pass-through on success (no log), structured JSON log on error,
 * includes userId/tenantId from ctx, omits stack in production, returns error unchanged.
 */

const { errorMiddleware } = await import('../error');
const { initTRPC } = await import('@trpc/server');
const superjson = await import('superjson');

// ── minimal router helpers ────────────────────────────────────────────────────

type TestCtx = {
  user?: { id: string };
  tenantId?: string;
};

function makeCallerThatSucceeds(ctx: TestCtx = {}) {
  const t = initTRPC.context<TestCtx>().create({ transformer: superjson });
  // errorMiddleware is bound to the app Context; cast to this test harness's
  // narrower TestCtx middleware shape (ctx access is duck-typed inside the mw).
  const proc = t.procedure
    .use(errorMiddleware as unknown as Parameters<typeof t.procedure.use>[0])
    .query(() => ({ ok: true }));
  const r = t.router({ ping: proc });
  return r.createCaller(ctx);
}

function makeCallerThatFails(
  ctx: TestCtx = {},
  code: TRPCError['code'] = 'INTERNAL_SERVER_ERROR',
  cause?: Error,
) {
  const t = initTRPC.context<TestCtx>().create({ transformer: superjson });
  const proc = t.procedure
    .use(errorMiddleware as unknown as Parameters<typeof t.procedure.use>[0])
    .query(() => {
      throw new TRPCError({ code, message: `Test error ${code}`, cause });
    });
  const r = t.router({ ping: proc });
  return r.createCaller(ctx);
}

// ── tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('errorMiddleware — pass-through on success', () => {
  it('returns the ok result without logging', async () => {
    const caller = makeCallerThatSucceeds();
    await expect(caller.ping()).resolves.toMatchObject({ ok: true });
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe('errorMiddleware — structured logging on error', () => {
  it('logs a structured JSON line containing level, code, and path', async () => {
    const caller = makeCallerThatFails({}, 'NOT_FOUND');
    await expect(caller.ping()).rejects.toBeDefined();

    expect(console.error).toHaveBeenCalledOnce();
    const raw = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.level).toBe('error');
    expect(parsed.code).toBe('NOT_FOUND');
    expect(parsed.path).toBe('ping');
  });

  it('re-throws the error unchanged (does not swallow)', async () => {
    const caller = makeCallerThatFails({}, 'FORBIDDEN');
    await expect(caller.ping()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    } satisfies Partial<TRPCError>);
  });

  it('includes userId and tenantId from ctx when available', async () => {
    const caller = makeCallerThatFails({ user: { id: 'u1' }, tenantId: 't1' });
    await expect(caller.ping()).rejects.toBeDefined();

    const raw = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.userId).toBe('u1');
    expect(parsed.tenantId).toBe('t1');
  });

  it('omits userId and tenantId when ctx has neither', async () => {
    const caller = makeCallerThatFails({});
    await expect(caller.ping()).rejects.toBeDefined();

    const raw = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed).not.toHaveProperty('userId');
    expect(parsed).not.toHaveProperty('tenantId');
  });

  it('does NOT include stack in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    try {
      const caller = makeCallerThatFails({}, 'INTERNAL_SERVER_ERROR', new Error('root'));
      await expect(caller.ping()).rejects.toBeDefined();

      const raw = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      expect(parsed).not.toHaveProperty('stack');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('includes stack in development when cause is an Error', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    try {
      const cause = new Error('root cause');
      const caller = makeCallerThatFails({}, 'INTERNAL_SERVER_ERROR', cause);
      await expect(caller.ping()).rejects.toBeDefined();

      const raw = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      expect(parsed.stack).toBeTruthy();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
