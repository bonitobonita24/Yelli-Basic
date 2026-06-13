import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * call router (merged as `calls`) — Flow A/B lifecycle + the IDOR/role guards
 * (security.md #5). Same harness. EndReason enum + realtime bus are stubbed.
 * Asserts: self-call BAD_REQUEST, place-from-unowned-device IDOR FORBIDDEN,
 * role-guard auto-reject (forbidden-by-role), happy ringing, and connect/end
 * participant guards.
 */
const h = vi.hoisted(() => {
  const device = { findUnique: vi.fn() };
  const callSession = { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() };
  const db = { device, callSession };
  const EndReason = {
    completed: 'completed',
    declined: 'declined',
    busy: 'busy',
    no_answer: 'no_answer',
    peer_disconnect: 'peer_disconnect',
    ice_failed: 'ice_failed',
    cancelled: 'cancelled',
    forbidden_by_role: 'forbidden_by_role',
  };
  return { device, callSession, EndReason, prisma: { ...db, $extends: vi.fn(() => db) }, signal: vi.fn() };
});

vi.mock('@yelli/db', () => ({
  prisma: h.prisma,
  tenantGuardExtension: () => (c: unknown) => c,
  Prisma: {},
  EndReason: h.EndReason,
}));
vi.mock('@/server/realtime/bus', () => ({ publishCallSignal: h.signal }));

const { callRouter } = await import('@/server/trpc/routers/call');

function caller(id = 'caller1') {
  return callRouter.createCaller({
    session: {
      user: { id, email: 'a@x.test', name: 'A', tenantId: 't1', role: 'member', securityVersion: 0 },
      expires: '2099-01-01',
    },
  } as never);
}

// device.findUnique resolves by id
function devices(map: Record<string, unknown>) {
  h.device.findUnique.mockImplementation(({ where: { id } }: { where: { id: string } }) =>
    Promise.resolve(map[id] ?? null),
  );
}
const session = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  callerDeviceId: 'dc',
  calleeDeviceId: 'de',
  callerRoleAtCall: 'both',
  calleeRoleAtCall: 'both',
  startedAt: new Date(),
  connectedAt: null,
  endedAt: null,
  durationSec: null,
  endReason: null,
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('callRouter', () => {
  it('start rejects a self-call (BAD_REQUEST)', async () => {
    await expect(caller().start({ callerDeviceId: 'dc', calleeDeviceId: 'dc' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('start blocks placing a call from a device you do not own (IDOR FORBIDDEN)', async () => {
    devices({ dc: { id: 'dc', userId: 'someone-else', callRole: 'both' }, de: { id: 'de', userId: 'x', callRole: 'both' } });
    await expect(caller('caller1').start({ callerDeviceId: 'dc', calleeDeviceId: 'de' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('start auto-rejects when roles forbid it (forbidden-by-role, ended immediately)', async () => {
    // caller is receiver-only (cannot call) → forbidden
    devices({ dc: { id: 'dc', userId: 'caller1', callRole: 'receiver' }, de: { id: 'de', userId: 'x', callRole: 'both' } });
    h.callSession.create.mockResolvedValue(
      session({ endedAt: new Date(), durationSec: 0, endReason: 'forbidden_by_role' }),
    );

    const result = await caller('caller1').start({ callerDeviceId: 'dc', calleeDeviceId: 'de' });

    expect(result.endReason).toBe('forbidden-by-role');
    expect(h.callSession.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ endReason: 'forbidden_by_role' }) }),
    );
  });

  it('start (owned + roles ok) returns a ringing session (no endReason)', async () => {
    devices({ dc: { id: 'dc', userId: 'caller1', callRole: 'both' }, de: { id: 'de', userId: 'x', callRole: 'both' } });
    h.callSession.create.mockResolvedValue(session());

    const result = await caller('caller1').start({ callerDeviceId: 'dc', calleeDeviceId: 'de' });

    expect(result.connectedAt).toBeNull();
    expect(result.endReason).toBeNull();
    expect(h.signal).toHaveBeenCalled();
  });

  it('connect blocks a non-callee operator (FORBIDDEN)', async () => {
    h.callSession.findUnique.mockResolvedValue(session());
    devices({ de: { id: 'de', userId: 'not-me' } });
    await expect(caller('caller1').connect({ id: 's1' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('end blocks a non-participant (FORBIDDEN)', async () => {
    h.callSession.findUnique.mockResolvedValue(session());
    devices({ dc: { id: 'dc', userId: 'x' }, de: { id: 'de', userId: 'y' } });
    await expect(caller('caller1').end({ id: 's1', reason: 'completed' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
