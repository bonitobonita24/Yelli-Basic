import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * tenants router — security-critical RBAC + last-admin-guard unit tests.
 * First tRPC router test harness: mocks @yelli/db (the L6-guarded client is an
 * identity passthrough here) + the realtime bus, then drives the router through
 * its real protected-procedure middleware chain via `createCaller`. The behaviors
 * asserted here were also confirmed live in the S6 walk (see docs/S6_VALIDATION_REPORT.md).
 */
const h = vi.hoisted(() => {
  const user = { findUnique: vi.fn(), update: vi.fn(), count: vi.fn() };
  const auditLog = { create: vi.fn(), createMany: vi.fn() };
  const tenant = { findUnique: vi.fn() };
  const models = { user, auditLog, tenant };
  const db = {
    ...models,
    $transaction: vi.fn(async (cb: (tx: typeof models) => unknown) => cb(models)),
  };
  return { ...models, db, prisma: { ...db, $extends: vi.fn(() => db) }, bus: vi.fn(async () => {}) };
});

vi.mock('@yelli/db', () => ({
  prisma: h.prisma,
  tenantGuardExtension: () => (c: unknown) => c,
  Prisma: {},
}));
vi.mock('@/server/realtime/bus', () => ({ publishSessionInvalidate: h.bus }));

const { tenantsRouter } = await import('@/server/trpc/routers/tenants');

function caller(role: 'admin' | 'member') {
  return tenantsRouter.createCaller({
    session: {
      user: { id: 'caller1', email: 'caller@x.test', name: 'Caller', tenantId: 't1', role, securityVersion: 0 },
      expires: '2099-01-01',
    },
  } as never);
}

const member = {
  id: 'u2',
  email: 'm@x.test',
  displayName: 'Member',
  role: 'member' as const,
  isSuspended: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  securityVersion: 0,
};

beforeEach(() => vi.clearAllMocks());

describe('tenantsRouter — RBAC + guards', () => {
  it('rejects a non-admin caller with FORBIDDEN', async () => {
    await expect(caller('member').promoteMember({ userId: 'u2' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    } satisfies Partial<TRPCError>);
  });

  it('promotes a member to admin (bumps securityVersion, writes §11 audit)', async () => {
    h.user.findUnique.mockResolvedValue(member);
    h.user.update.mockResolvedValue({ ...member, role: 'admin', securityVersion: 1 });

    const result = await caller('admin').promoteMember({ userId: 'u2' });

    expect(result.role).toBe('admin');
    expect(h.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u2' },
        data: { role: 'admin', securityVersion: { increment: 1 } },
      }),
    );
    expect(h.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'user.role.promote' }) }),
    );
    expect(h.bus).toHaveBeenCalled(); // live session invalidated
  });

  it('blocks demoting the LAST remaining admin (CONFLICT)', async () => {
    h.user.findUnique.mockResolvedValue({ ...member, role: 'admin' });
    h.user.count.mockResolvedValue(0); // no other active admins

    await expect(caller('admin').demoteMember({ userId: 'u2' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(h.user.update).not.toHaveBeenCalled();
  });

  it('get() returns the caller tenant profile', async () => {
    const profile = { id: 't1', slug: '_pwbt', displayName: 'Yelli', logoUrl: null, isSuspended: false, createdAt: new Date() };
    h.tenant.findUnique.mockResolvedValue(profile);

    await expect(caller('admin').get()).resolves.toMatchObject({ slug: '_pwbt', displayName: 'Yelli' });
  });

  // LAN bridge: a synthesized LAN-admin session (createContext LAN BRIDGE, synthetic
  // actor id, role 'admin', tenantId from the verified cookie) drives the SAME
  // protected chain → get() resolves the tenant. Mirrors the live 200 on tenants.get.
  it('get() resolves for a LAN-bridged admin session (cookie-only, synthetic actor)', async () => {
    const profile = { id: 'lanTenant', slug: '_pwbt', displayName: 'Yelli', logoUrl: null, isSuspended: false, createdAt: new Date() };
    h.tenant.findUnique.mockResolvedValue(profile);

    const lanCaller = tenantsRouter.createCaller({
      session: {
        user: {
          id: '__lan_admin__',
          role: 'admin',
          tenantId: 'lanTenant',
          tenantSlug: '',
          securityVersion: 0,
          name: 'LAN Admin',
          email: null,
        },
        expires: '2099-01-01',
      },
    } as never);

    await expect(lanCaller.get()).resolves.toMatchObject({ slug: '_pwbt', displayName: 'Yelli' });
    expect(h.tenant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'lanTenant' } }),
    );
  });
});
