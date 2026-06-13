import { beforeEach, describe, expect, it, vi } from 'vitest';

/** users router — account self-ownership + member directory. Same harness. */
const h = vi.hoisted(() => {
  const user = { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() };
  const db = { user };
  return { user, prisma: { ...db, $extends: vi.fn(() => db) } };
});

vi.mock('@yelli/db', () => ({ prisma: h.prisma, tenantGuardExtension: () => (c: unknown) => c, Prisma: {} }));

const { usersRouter } = await import('@/server/trpc/routers/users');

function caller(id = 'me1') {
  return usersRouter.createCaller({
    session: {
      user: { id, email: 'me@x.test', name: 'Me', tenantId: 't1', role: 'member', securityVersion: 0 },
      expires: '2099-01-01',
    },
  } as never);
}

beforeEach(() => vi.clearAllMocks());

describe('usersRouter', () => {
  it('me returns the signed-in user profile', async () => {
    h.user.findUnique.mockResolvedValue({ id: 'me1', email: 'me@x.test', displayName: 'Me', role: 'member' });
    const result = await caller('me1').me();
    expect(result.id).toBe('me1');
    expect(h.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'me1' } }));
  });

  it('me throws NOT_FOUND when the account is gone', async () => {
    h.user.findUnique.mockResolvedValue(null);
    await expect(caller('me1').me()).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('setDisplayName is self-bound (updates only ctx.user.id — no cross-user rename)', async () => {
    h.user.update.mockResolvedValue({ id: 'me1', displayName: 'New Name' });
    await caller('me1').setDisplayName({ displayName: 'New Name' });
    expect(h.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'me1' }, data: { displayName: 'New Name' } }),
    );
  });
});
