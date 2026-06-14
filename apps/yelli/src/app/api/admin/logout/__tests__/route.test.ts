import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `/api/admin/logout` Route Handler tests. The handler must clear BOTH admin
 * sessions on every POST so a LAN admin can't be silently re-logged-in by the
 * persisting `yelli_admin_session` cookie (the reported bug). Mocks both session
 * clearers to assert the handler invokes each one unconditionally.
 */
const h = vi.hoisted(() => ({
  clearLanAdminSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/server/auth/lan-admin', () => ({ clearLanAdminSession: h.clearLanAdminSession }));
vi.mock('@/server/auth/config', () => ({ signOut: h.signOut }));

const { POST } = await import('../route');

beforeEach(() => {
  vi.clearAllMocks();
  h.clearLanAdminSession.mockResolvedValue(undefined);
  h.signOut.mockResolvedValue(undefined);
});

describe('POST /api/admin/logout', () => {
  it('clears the LAN cookie AND the Auth.js session, returns 200 { ok: true }', async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    // Both sessions cleared — LAN cookie + Auth.js — regardless of which one is live.
    expect(h.clearLanAdminSession).toHaveBeenCalledTimes(1);
    expect(h.signOut).toHaveBeenCalledTimes(1);
    // Auth.js must NOT issue its own redirect Response — the handler owns the envelope.
    expect(h.signOut).toHaveBeenCalledWith({ redirect: false });
  });
});
