import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * push router — Web Push subscription + PWA install audit (§19/§20). Same harness.
 * Focus: cross-tenant deviceId → NOT_FOUND (L6 IDOR), and the pwa.install dedup
 * (a device that already recorded an install does not emit a second audit).
 */
const h = vi.hoisted(() => {
  const device = { findUnique: vi.fn() };
  const webPushSubscription = { findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), deleteMany: vi.fn() };
  const auditLog = { findFirst: vi.fn(), create: vi.fn() };
  const db = { device, webPushSubscription, auditLog };
  return { device, webPushSubscription, auditLog, prisma: { ...db, $extends: vi.fn(() => db) } };
});

vi.mock('@yelli/db', () => ({ prisma: h.prisma, tenantGuardExtension: () => (c: unknown) => c, Prisma: {} }));

const { pushRouter } = await import('@/server/trpc/routers/push');

function caller() {
  return pushRouter.createCaller({
    session: {
      user: { id: 'me1', email: 'me@x.test', name: 'Me', tenantId: 't1', role: 'member', securityVersion: 0 },
      expires: '2099-01-01',
    },
  } as never);
}

const sub = { deviceId: 'd1', endpoint: 'https://push.example.com/x', keys: { p256dh: 'p', auth: 'a' } };

beforeEach(() => vi.clearAllMocks());

describe('pushRouter', () => {
  it('subscribe rejects an unknown / cross-tenant device (NOT_FOUND)', async () => {
    h.device.findUnique.mockResolvedValue(null);
    await expect(caller().subscribe(sub)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(h.webPushSubscription.create).not.toHaveBeenCalled();
  });

  it('subscribe creates a new row when none exists for the endpoint', async () => {
    h.device.findUnique.mockResolvedValue({ id: 'd1' });
    h.webPushSubscription.findFirst.mockResolvedValue(null);
    const result = await caller().subscribe(sub);
    expect(result).toEqual({ ok: true });
    expect(h.webPushSubscription.create).toHaveBeenCalled();
  });

  it('recordInstall is deduped by device (no second pwa.install audit)', async () => {
    h.device.findUnique.mockResolvedValue({ id: 'd1' });
    h.auditLog.findFirst.mockResolvedValue({ id: 'existing' }); // already installed
    const result = await caller().recordInstall({ deviceId: 'd1', platform: 'android' });
    expect(result).toEqual({ recorded: false });
    expect(h.auditLog.create).not.toHaveBeenCalled();
  });

  it('recordInstall writes the §11 pwa.install audit on first install', async () => {
    h.device.findUnique.mockResolvedValue({ id: 'd1' });
    h.auditLog.findFirst.mockResolvedValue(null);
    const result = await caller().recordInstall({ deviceId: 'd1', platform: 'ios' });
    expect(result).toEqual({ recorded: true });
    expect(h.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'pwa.install' }) }),
    );
  });
});
