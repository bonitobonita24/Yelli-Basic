import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * devices router — directory/device lifecycle. Same harness as the sibling router
 * tests. Focus: the security-critical paths — admin-only role assignment, the
 * setDisplayName IDOR guard (non-owner non-admin), and the first_join vs rename
 * audit branching.
 */
const h = vi.hoisted(() => {
  const device = { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() };
  const auditLog = { create: vi.fn() };
  const db = {
    device,
    auditLog,
    $transaction: vi.fn(async (cb: (tx: { device: typeof device; auditLog: typeof auditLog }) => unknown) =>
      cb({ device, auditLog }),
    ),
  };
  return { device, auditLog, prisma: { ...db, $extends: vi.fn(() => db) } };
});

vi.mock('@yelli/db', () => ({
  prisma: h.prisma,
  tenantGuardExtension: () => (c: unknown) => c,
  Prisma: {},
}));

const { devicesRouter } = await import('@/server/trpc/routers/devices');

function caller(role: 'admin' | 'member', id = 'caller1') {
  return devicesRouter.createCaller({
    session: {
      user: { id, email: 'a@x.test', name: 'A', tenantId: 't1', role, securityVersion: 0 },
      expires: '2099-01-01',
    },
  } as never);
}

const dev = (over: Record<string, unknown> = {}) => ({
  id: 'd1',
  userId: 'caller1',
  displayName: 'Reception PC',
  callRole: 'receiver',
  browserFingerprint: 'fp',
  assignedRoleAt: null,
  lastSeenAt: new Date(),
  archivedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('devicesRouter', () => {
  it('setRole rejects a non-admin with FORBIDDEN', async () => {
    await expect(caller('member').setRole({ id: 'd1', role: 'caller' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('setRole (admin) assigns the role and audits device.role.assign', async () => {
    h.device.findUnique.mockResolvedValue(dev({ callRole: 'receiver' }));
    h.device.update.mockResolvedValue(dev({ callRole: 'caller' }));

    const result = await caller('admin').setRole({ id: 'd1', role: 'caller' });

    expect(result.callRole).toBe('caller');
    expect(h.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'device.role.assign' }) }),
    );
  });

  it('setDisplayName blocks a non-owner non-admin (IDOR guard)', async () => {
    h.device.findUnique.mockResolvedValue(dev({ userId: 'someone-else' }));

    await expect(
      caller('member', 'caller1').setDisplayName({ id: 'd1', displayName: 'Hacked' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(h.device.update).not.toHaveBeenCalled();
  });

  it('setDisplayName on a blank-named device audits device.first_join', async () => {
    h.device.findUnique.mockResolvedValue(dev({ userId: 'caller1', displayName: '' }));
    h.device.update.mockResolvedValue(dev({ displayName: 'Front Desk' }));

    await caller('member', 'caller1').setDisplayName({ id: 'd1', displayName: 'Front Desk' });

    expect(h.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'device.first_join' }) }),
    );
  });

  it('setDisplayName on an already-named device audits device.rename', async () => {
    h.device.findUnique.mockResolvedValue(dev({ userId: 'caller1', displayName: 'Old' }));
    h.device.update.mockResolvedValue(dev({ displayName: 'New' }));

    await caller('member', 'caller1').setDisplayName({ id: 'd1', displayName: 'New' });

    expect(h.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'device.rename' }) }),
    );
  });
});
