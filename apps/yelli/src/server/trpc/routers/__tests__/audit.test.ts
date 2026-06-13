import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * audit router — read-only AuditLog view (ScreenAdminAudit). Same harness. Focus:
 * admin gate, explicit tenant scoping (AuditLog is L6-excluded so the WHERE must
 * carry tenantId — security.md #10), the §11 actionPrefix filter, and cursor
 * pagination (take limit+1 → pop → nextCursor).
 */
const h = vi.hoisted(() => {
  const auditLog = { findMany: vi.fn() };
  const db = { auditLog };
  return { auditLog, prisma: { ...db, $extends: vi.fn(() => db) } };
});

vi.mock('@yelli/db', () => ({
  prisma: h.prisma,
  tenantGuardExtension: () => (c: unknown) => c,
  Prisma: {},
}));

const { auditRouter } = await import('@/server/trpc/routers/audit');

function caller(role: 'admin' | 'member') {
  return auditRouter.createCaller({
    session: {
      user: { id: 'caller1', email: 'a@x.test', name: 'A', tenantId: 't1', role, securityVersion: 0 },
      expires: '2099-01-01',
    },
  } as never);
}

const entry = (id: string) => ({
  id,
  action: 'device.rename',
  targetType: 'Device',
  targetId: 'd1',
  actorUserId: 'caller1',
  payload: {},
  createdAt: new Date(),
});

beforeEach(() => vi.clearAllMocks());

describe('auditRouter.list', () => {
  it('rejects a non-admin with FORBIDDEN', async () => {
    await expect(caller('member').list({ limit: 50 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('scopes the query to the caller tenant explicitly (L6-excluded table)', async () => {
    h.auditLog.findMany.mockResolvedValue([]);
    await caller('admin').list({ limit: 50 });
    expect(h.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 't1' }) }),
    );
  });

  it('applies the §11 actionPrefix filter as a startsWith', async () => {
    h.auditLog.findMany.mockResolvedValue([]);
    await caller('admin').list({ limit: 50, actionPrefix: 'device.' });
    expect(h.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ action: { startsWith: 'device.' } }) }),
    );
  });

  it('paginates: returns `limit` items and a nextCursor when an extra row exists', async () => {
    // limit 2 but 3 rows returned (take = limit+1) → pop extra → nextCursor
    h.auditLog.findMany.mockResolvedValue([entry('a'), entry('b'), entry('c')]);
    const result = await caller('admin').list({ limit: 2 });
    expect(result.items.map((r) => r.id)).toEqual(['a', 'b']);
    expect(result.nextCursor).toBe('c');
  });

  it('no extra row → nextCursor is null', async () => {
    h.auditLog.findMany.mockResolvedValue([entry('a'), entry('b')]);
    const result = await caller('admin').list({ limit: 2 });
    expect(result.nextCursor).toBeNull();
  });
});
