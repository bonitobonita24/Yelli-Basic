import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * LAN admin first-run SETUP backend unit tests (`setLanAdminPassphrase` +
 * `lanAdminConfigured`). Mirrors the tenants-router harness: hoisted mocks for
 * @yelli/db, plus next/headers `cookies()` and @node-rs/argon2 (native — mocked so
 * the test is deterministic + fast). Asserts the first-run gate, the
 * already-configured refusal (generic, no setup-state leak), the no-tenant refusal,
 * and the cookie-mint-on-success behaviour.
 */
const h = vi.hoisted(() => {
  const tenant = { findFirst: vi.fn(), updateMany: vi.fn() };
  const auditLog = { create: vi.fn(async () => ({})) };
  const cookieStore = { set: vi.fn(), get: vi.fn(), delete: vi.fn() };
  return {
    tenant,
    auditLog,
    cookieStore,
    argon2Hash: vi.fn(async (p: string) => `argon2$${p}`),
  };
});

vi.mock('@yelli/db', () => ({
  prisma: { tenant: h.tenant, auditLog: h.auditLog },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => h.cookieStore) }));
vi.mock('@node-rs/argon2', () => ({
  hash: h.argon2Hash,
  verify: vi.fn(async () => false),
}));

const { setLanAdminPassphrase, lanAdminConfigured } = await import('../lan-admin');

const ENV = process.env;
beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ENV, AUTH_SECRET: 'x'.repeat(40), NODE_ENV: 'test' };
});

/** `resolveLanTenant()` (used by both functions) calls tenant.findFirst with the
 *  `adminPassphraseHash: { not: null }` filter; the bare first-run target lookup
 *  calls findFirst again with no such filter. We disambiguate by the `where`. */
function mockConfigured(configured: boolean) {
  h.tenant.findFirst.mockImplementation(async (args: { where?: { adminPassphraseHash?: unknown } }) => {
    const isProbe = args?.where?.adminPassphraseHash !== undefined;
    if (isProbe) {
      return configured ? { id: 't1', adminPassphraseHash: 'existing' } : null;
    }
    // first-run target lookup (no adminPassphraseHash filter)
    return { id: 't1' };
  });
}

describe('lanAdminConfigured', () => {
  it('returns true when a tenant already carries a passphrase hash', async () => {
    mockConfigured(true);
    await expect(lanAdminConfigured()).resolves.toBe(true);
  });

  it('returns false when no tenant carries a passphrase hash', async () => {
    mockConfigured(false);
    await expect(lanAdminConfigured()).resolves.toBe(false);
  });
});

describe('setLanAdminPassphrase — first-run', () => {
  it('sets the hash, mints the cookie, audits success on a fresh deploy', async () => {
    mockConfigured(false);
    h.tenant.updateMany.mockResolvedValue({ count: 1 });

    const res = await setLanAdminPassphrase('correct horse battery');

    expect(res).toEqual({ ok: true, tenantId: 't1', role: 'admin' });
    expect(h.argon2Hash).toHaveBeenCalledWith('correct horse battery');
    expect(h.tenant.updateMany).toHaveBeenCalledWith({
      where: { id: 't1', adminPassphraseHash: null },
      data: { adminPassphraseHash: 'argon2$correct horse battery' },
    });
    expect(h.cookieStore.set).toHaveBeenCalledWith(
      'yelli_admin_session',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
    );
    expect(h.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'lan.admin.setup.success' }) }),
    );
  });

  it('refuses generically when a passphrase already exists (no cookie, no set)', async () => {
    mockConfigured(true);

    const res = await setLanAdminPassphrase('anything');

    expect(res).toEqual({ ok: false });
    expect(h.tenant.updateMany).not.toHaveBeenCalled();
    expect(h.cookieStore.set).not.toHaveBeenCalled();
    expect(h.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'lan.admin.setup.fail',
          payload: { reason: 'already_configured' },
        }),
      }),
    );
  });

  it('refuses when no tenant exists to bind to', async () => {
    // Not configured (probe null) AND the first-run target lookup also returns null.
    h.tenant.findFirst.mockResolvedValue(null);

    const res = await setLanAdminPassphrase('correct horse battery');

    expect(res).toEqual({ ok: false });
    expect(h.tenant.updateMany).not.toHaveBeenCalled();
    expect(h.cookieStore.set).not.toHaveBeenCalled();
  });

  it('refuses when a concurrent setup won the race (updateMany count 0)', async () => {
    mockConfigured(false);
    h.tenant.updateMany.mockResolvedValue({ count: 0 });

    const res = await setLanAdminPassphrase('correct horse battery');

    expect(res).toEqual({ ok: false });
    expect(h.cookieStore.set).not.toHaveBeenCalled();
  });
});
