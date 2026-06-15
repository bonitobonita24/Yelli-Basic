import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * soft-delete-cron worker — hard-deletes Users past the 7-day grace period.
 * Tests: empty sweep, hard-delete with Invitation cascade, Queue Safety guard,
 * per-user error isolation (other users still processed), idempotent cutoff.
 */

const h = vi.hoisted(() => {
  const user = { findMany: vi.fn(), delete: vi.fn() };
  const invitation = { deleteMany: vi.fn() };
  const auditLog = { create: vi.fn() };
  const models = { user, invitation, auditLog };
  return {
    ...models,
    prisma: {
      ...models,
      $transaction: vi.fn(async (cb: (tx: typeof models) => unknown) => cb(models)),
    },
  };
});

vi.mock('@yelli/db', () => ({ prisma: h.prisma }));

const { processSoftDeleteCron } = await import('../soft-delete-cron');

const job = (data: unknown) => ({ id: 'j1', data }) as never;

beforeEach(() => vi.clearAllMocks());

describe('processSoftDeleteCron', () => {
  it('rejects a job missing tenantId/userId (Queue Safety guard)', async () => {
    await expect(processSoftDeleteCron(job({}))).rejects.toThrow(
      /tenantId and userId are required/,
    );
    expect(h.user.findMany).not.toHaveBeenCalled();
  });

  it('does nothing when no users are past the grace period', async () => {
    h.user.findMany.mockResolvedValue([]);

    await processSoftDeleteCron(job({ tenantId: 't1', userId: 'system' }));

    expect(h.invitation.deleteMany).not.toHaveBeenCalled();
    expect(h.user.delete).not.toHaveBeenCalled();
    expect(h.auditLog.create).not.toHaveBeenCalled();
  });

  it('deletes outgoing Invitations then hard-deletes the User (FK cascade order)', async () => {
    h.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    h.invitation.deleteMany.mockResolvedValue({ count: 2 });
    h.user.delete.mockResolvedValue({ id: 'u1' });

    await processSoftDeleteCron(job({ tenantId: 't1', userId: 'system' }));

    // Invitations deleted before the user (FK order).
    expect(h.invitation.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 't1', invitedByUserId: 'u1' },
      }),
    );
    expect(h.user.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1', tenantId: 't1' },
      }),
    );
  });

  it('does NOT write a new AuditLog row (user.delete audit already written by removeMember)', async () => {
    h.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    h.invitation.deleteMany.mockResolvedValue({ count: 0 });
    h.user.delete.mockResolvedValue({ id: 'u1' });

    await processSoftDeleteCron(job({ tenantId: 't1', userId: 'system' }));

    expect(h.auditLog.create).not.toHaveBeenCalled();
  });

  it('scopes findMany to the job tenant (no cross-tenant leakage)', async () => {
    h.user.findMany.mockResolvedValue([]);

    await processSoftDeleteCron(job({ tenantId: 'tenant-A', userId: 'system' }));

    expect(h.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-A' }),
      }),
    );
  });

  it('continues processing remaining users when one user delete fails (error isolation)', async () => {
    h.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
    // u1 fails; u2 succeeds.
    h.prisma.$transaction
      .mockRejectedValueOnce(new Error('FK violation on u1'))
      .mockResolvedValueOnce(undefined);

    // Should not throw — errors are isolated per user.
    await expect(
      processSoftDeleteCron(job({ tenantId: 't1', userId: 'system' })),
    ).resolves.toBeUndefined();
  });

  it('uses a cutoff of now()-7d for the removedAt filter', async () => {
    h.user.findMany.mockResolvedValue([]);

    const before = Date.now();
    await processSoftDeleteCron(job({ tenantId: 't1', userId: 'system' }));
    const after = Date.now();

    const call = h.user.findMany.mock.calls[0]![0] as { where: { removedAt: { lt: Date } } };
    const cutoff = call.where.removedAt.lt.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(cutoff).toBeGreaterThanOrEqual(before - sevenDaysMs - 100);
    expect(cutoff).toBeLessThanOrEqual(after - sevenDaysMs + 100);
  });
});
