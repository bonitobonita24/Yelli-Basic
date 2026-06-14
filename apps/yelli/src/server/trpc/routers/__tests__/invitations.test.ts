import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * invitations router — admin invite surface (Flow F). Same harness as tenants/brand.
 * The create→email and revoke paths were confirmed live in the S6 walk (MailHog
 * received the invite; Revoke flipped the row to Expired).
 */
const h = vi.hoisted(() => {
  const invitation = { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() };
  const auditLog = { create: vi.fn() };
  const db = {
    invitation,
    auditLog,
    $transaction: vi.fn(async (cb: (tx: { invitation: typeof invitation; auditLog: typeof auditLog }) => unknown) =>
      cb({ invitation, auditLog }),
    ),
  };
  return { invitation, auditLog, prisma: { ...db, $extends: vi.fn(() => db) }, enqueue: vi.fn(async () => {}) };
});

vi.mock('@yelli/db', () => ({
  prisma: h.prisma,
  tenantGuardExtension: () => (c: unknown) => c,
  Prisma: {},
}));
vi.mock('@/server/jobs/email-queue', () => ({ enqueueInvitationEmail: h.enqueue }));

const { invitationsRouter } = await import('@/server/trpc/routers/invitations');
const { LAN_ADMIN_ACTOR_ID } = await import('@/server/trpc/audit-actor');

function caller(role: 'admin' | 'member', userId = 'caller1') {
  return invitationsRouter.createCaller({
    session: {
      user: { id: userId, email: 'a@x.test', name: 'A', tenantId: 't1', role, securityVersion: 0 },
      expires: '2099-01-01',
    },
  } as never);
}

const row = {
  id: 'inv1',
  email: 'invitee@x.test',
  invitedByUserId: 'caller1',
  expiresAt: new Date(Date.now() + 7 * 864e5),
  acceptedAt: null as Date | null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

beforeEach(() => vi.clearAllMocks());

describe('invitationsRouter', () => {
  it('list rejects non-admin with FORBIDDEN', async () => {
    await expect(caller('member').list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('create stores the invite, audits invitation.create, and queues the email', async () => {
    h.invitation.create.mockResolvedValue(row);

    const result = await caller('admin').create({ email: 'invitee@x.test' });

    expect(result.id).toBe('inv1');
    expect(h.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'invitation.create' }) }),
    );
    expect(h.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'invitee@x.test', token: expect.any(String) }),
    );
  });

  it('create from the LAN admin writes invitedByUserId null (FK-safe, no users row)', async () => {
    h.invitation.create.mockResolvedValue({ ...row, invitedByUserId: null });

    await caller('admin', LAN_ADMIN_ACTOR_ID).create({ email: 'invitee@x.test' });

    expect(h.invitation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ invitedByUserId: null }) }),
    );
    expect(h.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ actorUserId: null }) }),
    );
  });

  it('revoke expires a pending invite and audits invitation.revoke', async () => {
    h.invitation.findUnique.mockResolvedValue({ ...row });
    h.invitation.update.mockResolvedValue({ ...row, expiresAt: new Date() });

    await caller('admin').revoke({ id: 'inv1' });

    expect(h.invitation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inv1' }, data: expect.objectContaining({ expiresAt: expect.any(Date) }) }),
    );
    expect(h.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'invitation.revoke' }) }),
    );
  });

  it('revoke refuses an already-accepted invite (BAD_REQUEST)', async () => {
    h.invitation.findUnique.mockResolvedValue({ ...row, acceptedAt: new Date() });

    await expect(caller('admin').revoke({ id: 'inv1' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(h.invitation.update).not.toHaveBeenCalled();
  });
});
