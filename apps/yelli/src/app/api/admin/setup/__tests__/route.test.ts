import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `/api/admin/setup` Route Handler tests. Mocks `setLanAdminPassphrase` so this
 * file exercises the HANDLER contract only — Zod body validation, the
 * passphrase/confirm match + length floor, the process-local 5/min/IP rate limit,
 * and the generic `{ ok: false }` envelope on every failure (no setup-state leak).
 * The first-run backend logic itself is covered by the lan-admin-setup unit test.
 *
 * The rate-limit map is module-local, so the rate-limit case uses a UNIQUE IP and
 * the other cases use distinct IPs to stay independent of execution order.
 */
const h = vi.hoisted(() => ({
  setLanAdminPassphrase: vi.fn(),
}));

vi.mock('@/server/auth/lan-admin', () => ({
  setLanAdminPassphrase: h.setLanAdminPassphrase,
}));

const { POST } = await import('../route');

function req(body: unknown, ip = '10.0.0.1'): Request {
  return new Request('http://lan/api/admin/setup', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/admin/setup', () => {
  it('first-run success → 200 { ok: true }', async () => {
    h.setLanAdminPassphrase.mockResolvedValue({ ok: true, tenantId: 't1', role: 'admin' });
    const res = await POST(req({ passphrase: 'supersecret', confirm: 'supersecret' }, '10.0.0.10'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(h.setLanAdminPassphrase).toHaveBeenCalledWith('supersecret');
  });

  it('already-configured / refused → generic 401 { ok: false }', async () => {
    h.setLanAdminPassphrase.mockResolvedValue({ ok: false });
    const res = await POST(req({ passphrase: 'supersecret', confirm: 'supersecret' }, '10.0.0.11'));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ ok: false });
  });

  it('passphrase/confirm mismatch → 400 (backend never called)', async () => {
    const res = await POST(req({ passphrase: 'supersecret', confirm: 'different1' }, '10.0.0.12'));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false });
    expect(h.setLanAdminPassphrase).not.toHaveBeenCalled();
  });

  it('too-short passphrase → 400 (below 8-char floor)', async () => {
    const res = await POST(req({ passphrase: 'short', confirm: 'short' }, '10.0.0.13'));
    expect(res.status).toBe(400);
    expect(h.setLanAdminPassphrase).not.toHaveBeenCalled();
  });

  it('missing fields → 400', async () => {
    const res = await POST(req({ passphrase: 'supersecret' }, '10.0.0.14'));
    expect(res.status).toBe(400);
    expect(h.setLanAdminPassphrase).not.toHaveBeenCalled();
  });

  it('non-JSON body → 400', async () => {
    const res = await POST(req('not json{', '10.0.0.15'));
    expect(res.status).toBe(400);
    expect(h.setLanAdminPassphrase).not.toHaveBeenCalled();
  });

  it('rate limit → 429 after 5 attempts from the same IP', async () => {
    h.setLanAdminPassphrase.mockResolvedValue({ ok: false });
    const ip = '10.0.0.250';
    const body = { passphrase: 'supersecret', confirm: 'supersecret' };
    // 5 allowed
    for (let i = 0; i < 5; i++) {
      const r = await POST(req(body, ip));
      expect(r.status).not.toBe(429);
    }
    // 6th over budget
    const over = await POST(req(body, ip));
    expect(over.status).toBe(429);
    await expect(over.json()).resolves.toEqual({ ok: false });
  });
});
