import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * device-archive cron worker — auto-archive devices unseen ≥90d (LOCKED threshold),
 * one job per tenant, scoped explicitly to job.data.tenantId (cron has no L6 guard).
 * Emits a single device.archive.batch audit only when ≥1 device is archived.
 */
const h = vi.hoisted(() => {
  const device = { updateMany: vi.fn() };
  const auditLog = { create: vi.fn() };
  return {
    device,
    auditLog,
    prisma: { $transaction: vi.fn(async (cb: (tx: { device: typeof device; auditLog: typeof auditLog }) => unknown) => cb({ device, auditLog })) },
  };
});

vi.mock('@yelli/db', () => ({ prisma: h.prisma }));

const { processDeviceArchive } = await import('../device-archive');

const job = (data: unknown) => ({ id: 'j1', data }) as never;

beforeEach(() => vi.clearAllMocks());

describe('processDeviceArchive', () => {
  it('rejects a job missing tenant/user identity (Queue Safety)', async () => {
    await expect(processDeviceArchive(job({}))).rejects.toThrow(/tenantId and userId are required/);
    expect(h.device.updateMany).not.toHaveBeenCalled();
  });

  it('archives stale devices scoped to the job tenant and writes device.archive.batch', async () => {
    h.device.updateMany.mockResolvedValue({ count: 3 });

    await processDeviceArchive(job({ tenantId: 't1', userId: 'system' }));

    expect(h.device.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 't1', archivedAt: null, lastSeenAt: { lt: expect.any(Date) } }),
      }),
    );
    expect(h.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'device.archive.batch',
          actorUserId: null,
          payload: { count: 3, olderThanDays: 90 },
        }),
      }),
    );
  });

  it('writes NO audit row when nothing was archived', async () => {
    h.device.updateMany.mockResolvedValue({ count: 0 });
    await processDeviceArchive(job({ tenantId: 't1', userId: 'system' }));
    expect(h.auditLog.create).not.toHaveBeenCalled();
  });
});
