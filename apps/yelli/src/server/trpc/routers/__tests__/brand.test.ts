import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * brand router — admin-gated tenant branding (display name + logo). Reuses the
 * router-test harness pattern (see tenants.test.ts): mock @yelli/db + the storage
 * and logo-queue side-effect modules, drive the real middleware chain via
 * createCaller. The displayName + audit behavior was confirmed live in the S6 walk
 * (the "Saved." → tenant.branding.update audit entry).
 */
const h = vi.hoisted(() => {
  const tenant = { update: vi.fn(), findUnique: vi.fn() };
  const auditLog = { create: vi.fn() };
  const db = { tenant, auditLog };
  return {
    tenant,
    auditLog,
    prisma: { ...db, $extends: vi.fn(() => db) },
    putBrandingLogo: vi.fn(),
    validateBrandingUpload: vi.fn(),
    enqueueLogoImage: vi.fn(async () => {}),
  };
});

vi.mock('@yelli/db', () => ({
  prisma: h.prisma,
  tenantGuardExtension: () => (c: unknown) => c,
  Prisma: {},
}));
vi.mock('@yelli/storage', () => ({
  putBrandingLogo: h.putBrandingLogo,
  validateBrandingUpload: h.validateBrandingUpload,
  BrandingValidationError: class BrandingValidationError extends Error {},
}));
vi.mock('@/server/jobs/logo-queue', () => ({ enqueueLogoImage: h.enqueueLogoImage }));

const { brandRouter } = await import('@/server/trpc/routers/brand');

function caller(role: 'admin' | 'member') {
  return brandRouter.createCaller({
    session: {
      user: { id: 'caller1', email: 'a@x.test', name: 'A', tenantId: 't1', role, securityVersion: 0 },
      expires: '2099-01-01',
    },
  } as never);
}

beforeEach(() => vi.clearAllMocks());

describe('brandRouter.update', () => {
  it('rejects a non-admin caller with FORBIDDEN', async () => {
    await expect(caller('member').update({ displayName: 'X' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects an empty update with BAD_REQUEST', async () => {
    await expect(caller('admin').update({})).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(h.tenant.update).not.toHaveBeenCalled();
  });

  it('updates displayName and writes the §11 tenant.branding.update audit', async () => {
    h.tenant.update.mockResolvedValue({
      id: 't1',
      slug: '_pwbt',
      displayName: 'New Co',
      logoUrl: null,
      isSuspended: false,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });

    const result = await caller('admin').update({ displayName: 'New Co' });

    expect(result.displayName).toBe('New Co');
    expect(h.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't1' }, data: { displayName: 'New Co' } }),
    );
    expect(h.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'tenant.branding.update' }),
      }),
    );
    expect(h.enqueueLogoImage).not.toHaveBeenCalled(); // no logo in this update
  });
});
