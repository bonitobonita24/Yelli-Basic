import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * DSR router — data-subject-rights unit tests (V32.9).
 * Same harness as tenants.test.ts: mocks @yelli/db + drives the router through the
 * real protected-procedure middleware chain via `createCaller`.
 *
 * Covers:
 *   access  — returns own data; cross-tenant isolation (tenantId from session, not input)
 *   rectify — validates input; detects email conflict; bumps securityVersion on email change
 *   erase   — soft-deletes own account + emits audit; cross-tenant rejected
 *   myRequests — list is tenant-scoped
 */
const h = vi.hoisted(() => {
  const user = { findUnique: vi.fn(), update: vi.fn(), findFirst: vi.fn() };
  const device = { findMany: vi.fn() };
  const callSession = { findMany: vi.fn() };
  const auditLog = { findMany: vi.fn(), create: vi.fn() };
  const consentLog = { findMany: vi.fn() };
  const dataSubjectRequest = { create: vi.fn(), findMany: vi.fn() };

  const models = { user, device, callSession, auditLog, consentLog, dataSubjectRequest };
  const db = {
    ...models,
    $transaction: vi.fn(async (cb: (tx: typeof models) => unknown) => cb(models)),
  };
  return {
    ...models,
    db,
    prisma: { ...db, $extends: vi.fn(() => db) },
  };
});

vi.mock('@yelli/db', () => ({
  prisma: h.prisma,
  tenantGuardExtension: () => (c: unknown) => c,
  Prisma: {},
}));

const { dsrRouter } = await import('@/server/trpc/routers/dsr');

function caller(role: 'admin' | 'member' = 'member', tenantId = 't1', userId = 'u1') {
  return dsrRouter.createCaller({
    session: {
      user: { id: userId, email: 'user@x.test', name: 'User', tenantId, role, securityVersion: 0 },
      expires: '2099-01-01',
    },
  } as never);
}

const stubUser = {
  id: 'u1',
  email: 'user@x.test',
  emailVerifiedAt: null,
  displayName: 'Test User',
  role: 'member' as const,
  isSuspended: false,
  lastLoginAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

beforeEach(() => vi.clearAllMocks());

// ─── access ──────────────────────────────────────────────────────────────────

describe('dsrRouter.access', () => {
  it('returns own user data and creates a DSR record + audit log', async () => {
    h.user.findUnique.mockResolvedValue(stubUser);
    h.device.findMany.mockResolvedValue([]);
    h.callSession.findMany.mockResolvedValue([]);
    h.auditLog.findMany.mockResolvedValue([]);
    h.consentLog.findMany.mockResolvedValue([]);
    h.dataSubjectRequest.create.mockResolvedValue({});
    h.auditLog.create.mockResolvedValue({});

    const result = await caller().access();

    expect(result.user.id).toBe('u1');
    expect(result.user.email).toBe('user@x.test');
    // tenantId MUST NOT be returned on the user row (security.md #13)
    expect(result.user).not.toHaveProperty('tenantId');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user).not.toHaveProperty('securityVersion');

    // DSR record created with type ACCESS + COMPLETED
    expect(h.dataSubjectRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'ACCESS', status: 'COMPLETED', userId: 'u1', tenantId: 't1' }),
      }),
    );
    // Audit log emitted with action 'dsr.access'
    expect(h.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'dsr.access', targetType: 'DataSubjectRequest' }),
      }),
    );
  });

  it('throws NOT_FOUND when the own user row is missing', async () => {
    h.user.findUnique.mockResolvedValue(null);
    h.device.findMany.mockResolvedValue([]);
    h.callSession.findMany.mockResolvedValue([]);
    h.auditLog.findMany.mockResolvedValue([]);
    h.consentLog.findMany.mockResolvedValue([]);

    await expect(caller().access()).rejects.toMatchObject({
      code: 'NOT_FOUND',
    } satisfies Partial<TRPCError>);
  });

  it('scopes device/call/audit queries to ctx.tenantId (cross-tenant isolation)', async () => {
    h.user.findUnique.mockResolvedValue(stubUser);
    h.device.findMany.mockResolvedValue([]);
    h.callSession.findMany.mockResolvedValue([]);
    h.auditLog.findMany.mockResolvedValue([]);
    h.consentLog.findMany.mockResolvedValue([]);
    h.dataSubjectRequest.create.mockResolvedValue({});
    h.auditLog.create.mockResolvedValue({});

    await caller('member', 't1', 'u1').access();

    // device query must be scoped to tenantId from session ('t1'), not a free variable
    expect(h.device.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 't1' }) }),
    );
    // auditLog read scoped to tenantId + own userId
    expect(h.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 't1', actorUserId: 'u1' }),
      }),
    );
  });
});

// ─── rectify ─────────────────────────────────────────────────────────────────

describe('dsrRouter.rectify', () => {
  it('updates displayName and creates DSR + audit', async () => {
    h.user.findFirst.mockResolvedValue(null); // no conflict
    h.user.update.mockResolvedValue({ ...stubUser, displayName: 'New Name' });
    h.dataSubjectRequest.create.mockResolvedValue({});
    h.auditLog.create.mockResolvedValue({});

    const result = await caller().rectify({ displayName: 'New Name' });

    expect(result.displayName).toBe('New Name');
    expect(h.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ displayName: 'New Name' }),
      }),
    );
    expect(h.dataSubjectRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'RECTIFY', status: 'COMPLETED' }),
      }),
    );
    expect(h.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'dsr.rectify' }),
      }),
    );
  });

  it('bumps securityVersion when email changes', async () => {
    h.user.findFirst.mockResolvedValue(null); // no conflict
    h.user.update.mockResolvedValue({ ...stubUser, email: 'new@x.test' });
    h.dataSubjectRequest.create.mockResolvedValue({});
    h.auditLog.create.mockResolvedValue({});

    await caller().rectify({ email: 'new@x.test' });

    expect(h.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'new@x.test',
          emailVerifiedAt: null,
          securityVersion: { increment: 1 },
        }),
      }),
    );
  });

  it('throws CONFLICT when the new email is already taken in the tenant', async () => {
    h.user.findFirst.mockResolvedValue({ id: 'other-user' }); // conflict row

    await expect(caller().rectify({ email: 'taken@x.test' })).rejects.toMatchObject({
      code: 'CONFLICT',
    } satisfies Partial<TRPCError>);
    expect(h.user.update).not.toHaveBeenCalled();
  });

  it('rejects input with no fields specified', async () => {
    // Zod refine: at least one field must be provided
    await expect(caller().rectify({})).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// ─── erase ───────────────────────────────────────────────────────────────────

describe('dsrRouter.erase', () => {
  it('soft-deletes own account (sets removedAt + isSuspended) + emits audit', async () => {
    h.user.update.mockResolvedValue({});
    h.dataSubjectRequest.create.mockResolvedValue({});
    h.auditLog.create.mockResolvedValue({});

    const result = await caller().erase();

    expect(result.erasedAt).toBeInstanceOf(Date);

    // Soft-delete semantics: removedAt set, isSuspended=true, securityVersion bumped
    expect(h.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
          isSuspended: true,
          securityVersion: { increment: 1 },
        }),
      }),
    );
    expect(h.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ removedAt: expect.any(Date) }),
      }),
    );

    // DSR record created with type ERASE + COMPLETED
    expect(h.dataSubjectRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'ERASE', status: 'COMPLETED', userId: 'u1', tenantId: 't1' }),
      }),
    );

    // Audit log emitted with action 'dsr.erase'
    expect(h.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'dsr.erase', targetType: 'DataSubjectRequest' }),
      }),
    );
  });

  it('only erases the caller own account (userId from session, never from input)', async () => {
    // The router derives userId solely from ctx.user.id (the session) — there is no
    // input userId so a caller can never target another user.
    h.user.update.mockResolvedValue({});
    h.dataSubjectRequest.create.mockResolvedValue({});
    h.auditLog.create.mockResolvedValue({});

    await caller('member', 't1', 'myUserId').erase();

    expect(h.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'myUserId' } }),
    );
  });
});

// ─── myRequests ──────────────────────────────────────────────────────────────

describe('dsrRouter.myRequests', () => {
  it('returns own DSR history scoped to the caller tenant + user', async () => {
    const rows = [
      { id: 'r1', type: 'ACCESS', status: 'COMPLETED', requestedAt: new Date(), dueAt: new Date(), resolvedAt: new Date(), evidenceUrl: null },
    ];
    h.dataSubjectRequest.findMany.mockResolvedValue(rows);

    const result = await caller('member', 't1', 'u1').myRequests();

    expect(result).toHaveLength(1);
    expect(h.dataSubjectRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 't1', userId: 'u1' }),
      }),
    );
  });
});
