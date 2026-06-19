import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Breach notification router — unit tests (V32.9).
 * Same harness as tenants.test.ts / audit.test.ts.
 *
 * Covers:
 *   record          — non-admin FORBIDDEN; creates breach record with correct due-date
 *   markNpcNotified — transitions to NOTIFIED + emits audit
 *   submitReport    — transitions to REPORTED + emits audit
 *   list            — non-admin FORBIDDEN; returns tenant-scoped list
 */
const h = vi.hoisted(() => {
  const breachNotificationRecord = {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  };
  const auditLog = { create: vi.fn() };

  const models = { breachNotificationRecord, auditLog };
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

const { breachRouter } = await import('@/server/trpc/routers/breach');

function caller(role: 'admin' | 'member' = 'admin') {
  return breachRouter.createCaller({
    session: {
      user: { id: 'actor1', email: 'admin@x.test', name: 'Admin', tenantId: 't1', role, securityVersion: 0 },
      expires: '2099-01-01',
    },
  } as never);
}

const detectedAt = new Date('2026-01-01T00:00:00Z');

const stubBreach = {
  id: 'b1',
  severity: 'HIGH',
  status: 'DETECTED',
  detectedAt,
  npcNotifiedAt: null,
  subjectsNotifiedAt: null,
  writtenReportDueAt: new Date('2026-01-08T00:00:00Z'), // approximate
  writtenReportSubmittedAt: null,
  affectedUserCount: 10,
  description: 'Test breach',
  recordedByUserId: 'actor1',
} as const;

beforeEach(() => vi.clearAllMocks());

// ─── RBAC gate ────────────────────────────────────────────────────────────────

describe('breachRouter — admin gate', () => {
  it('rejects a non-admin caller with FORBIDDEN on record', async () => {
    await expect(
      caller('member').record({
        severity: 'HIGH',
        detectedAt,
        affectedUserCount: 10,
        description: 'test',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<TRPCError>);
    expect(h.breachNotificationRecord.create).not.toHaveBeenCalled();
  });

  it('rejects a non-admin caller with FORBIDDEN on list', async () => {
    await expect(caller('member').list()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    } satisfies Partial<TRPCError>);
  });
});

// ─── record ──────────────────────────────────────────────────────────────────

describe('breachRouter.record', () => {
  it('creates a breach record and emits audit', async () => {
    h.breachNotificationRecord.create.mockResolvedValue(stubBreach);
    h.auditLog.create.mockResolvedValue({});

    const result = await caller('admin').record({
      severity: 'HIGH',
      detectedAt,
      affectedUserCount: 10,
      description: 'Test breach',
    });

    expect(result.id).toBe('b1');
    expect(h.breachNotificationRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 't1',
          severity: 'HIGH',
          status: 'DETECTED',
          affectedUserCount: 10,
        }),
      }),
    );
    expect(h.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'breach.record', targetType: 'BreachNotificationRecord' }),
      }),
    );
  });

  it('computes writtenReportDueAt as detectedAt + 72h + 5 business days', async () => {
    // detectedAt = 2026-01-01T00:00:00Z (Thursday)
    // +72h       = 2026-01-04T00:00:00Z (Sunday)
    // +5 business days from Sunday: Mon(1) Tue(2) Wed(3) Thu(4) Fri(5) = 2026-01-09
    const expectedDue = new Date('2026-01-09T00:00:00.000Z');

    let capturedDue: Date | undefined;
    h.breachNotificationRecord.create.mockImplementation(
      (args: { data: { writtenReportDueAt: Date } }) => {
        capturedDue = args.data.writtenReportDueAt;
        return Promise.resolve({ ...stubBreach, writtenReportDueAt: args.data.writtenReportDueAt });
      },
    );
    h.auditLog.create.mockResolvedValue({});

    await caller('admin').record({
      severity: 'HIGH',
      detectedAt: new Date('2026-01-01T00:00:00Z'),
      affectedUserCount: 10,
      description: 'Test',
    });

    expect(capturedDue).toBeDefined();
    expect(capturedDue?.toISOString()).toBe(expectedDue.toISOString());
  });
});

// ─── markNpcNotified ─────────────────────────────────────────────────────────

describe('breachRouter.markNpcNotified', () => {
  it('throws NOT_FOUND when breach does not belong to caller tenant', async () => {
    h.breachNotificationRecord.findFirst.mockResolvedValue(null);

    await expect(caller('admin').markNpcNotified({ breachId: 'no-such' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    } satisfies Partial<TRPCError>);
    expect(h.breachNotificationRecord.update).not.toHaveBeenCalled();
  });

  it('updates status to NOTIFIED and emits breach.notify.npc audit', async () => {
    h.breachNotificationRecord.findFirst.mockResolvedValue({ id: 'b1', status: 'DETECTED' });
    h.breachNotificationRecord.update.mockResolvedValue({ ...stubBreach, status: 'NOTIFIED', npcNotifiedAt: new Date() });
    h.auditLog.create.mockResolvedValue({});

    const result = await caller('admin').markNpcNotified({ breachId: 'b1' });

    expect(result.status).toBe('NOTIFIED');
    expect(h.breachNotificationRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'b1' },
        data: expect.objectContaining({ status: 'NOTIFIED' }),
      }),
    );
    expect(h.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'breach.notify.npc' }),
      }),
    );
  });
});

// ─── submitReport ─────────────────────────────────────────────────────────────

describe('breachRouter.submitReport', () => {
  it('updates status to REPORTED and emits breach.report.submit audit', async () => {
    h.breachNotificationRecord.findFirst.mockResolvedValue({ id: 'b1' });
    h.breachNotificationRecord.update.mockResolvedValue({
      ...stubBreach,
      status: 'REPORTED',
      writtenReportSubmittedAt: new Date(),
    });
    h.auditLog.create.mockResolvedValue({});

    const result = await caller('admin').submitReport({ breachId: 'b1' });

    expect(result.status).toBe('REPORTED');
    expect(h.breachNotificationRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'REPORTED',
          writtenReportSubmittedAt: expect.any(Date),
        }),
      }),
    );
    expect(h.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'breach.report.submit' }),
      }),
    );
  });
});

// ─── list ─────────────────────────────────────────────────────────────────────

describe('breachRouter.list', () => {
  it('returns breaches scoped to the caller tenant', async () => {
    h.breachNotificationRecord.findMany.mockResolvedValue([stubBreach]);

    const result = await caller('admin').list();

    expect(result).toHaveLength(1);
    expect(h.breachNotificationRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 't1' }),
      }),
    );
  });
});
