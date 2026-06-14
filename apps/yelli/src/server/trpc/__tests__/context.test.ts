import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * createContext LAN bridge — security-critical. Verifies the LAN anonymous-admin
 * cookie is synthesized into a Session of the augmented shape so the UNCHANGED
 * protected-procedure chain derives ctx.user/tenantId/db, WITHOUT weakening the
 * Auth.js path (which always takes precedence). See context.ts LAN BRIDGE.
 */
const h = vi.hoisted(() => ({
  auth: vi.fn(),
  getLanAdminSession: vi.fn(),
}));

vi.mock('@/server/auth/config', () => ({ auth: h.auth }));
vi.mock('@/server/auth/lan-admin', () => ({ getLanAdminSession: h.getLanAdminSession }));

const { createContext, LAN_ADMIN_ACTOR_ID } = await import('@/server/trpc/context');

beforeEach(() => vi.clearAllMocks());

describe('createContext — Auth.js precedence', () => {
  it('returns the Auth.js session verbatim and never reads the LAN cookie', async () => {
    const authSession = {
      user: { id: 'u1', role: 'member', tenantId: 't1', tenantSlug: 's', securityVersion: 3 },
      expires: '2099-01-01',
    };
    h.auth.mockResolvedValue(authSession);

    const ctx = await createContext();

    expect(ctx.session).toBe(authSession);
    expect(h.getLanAdminSession).not.toHaveBeenCalled();
  });
});

describe('createContext — LAN bridge', () => {
  it('synthesizes an admin session pinned to the verified-cookie tenant', async () => {
    h.auth.mockResolvedValue(null);
    h.getLanAdminSession.mockResolvedValue({ valid: true, tenantId: 'lanTenant', role: 'admin' });

    const ctx = await createContext();

    expect(ctx.session?.user).toMatchObject({
      id: LAN_ADMIN_ACTOR_ID,
      role: 'admin', // never super_admin
      tenantId: 'lanTenant', // strictly the verified cookie tenant
    });
  });

  it('returns null session when no Auth.js session AND no valid LAN cookie (still 401)', async () => {
    h.auth.mockResolvedValue(null);
    h.getLanAdminSession.mockResolvedValue({ valid: false });

    const ctx = await createContext();

    expect(ctx.session).toBeNull();
  });
});
