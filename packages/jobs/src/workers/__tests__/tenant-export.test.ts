import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * tenant-export worker — Flow I GDPR/DPA export (W5b). Runs on the UNGUARDED client,
 * so every query is scoped to job.data.tenantId explicitly (IDOR defense-in-depth).
 * Tested here: Queue-Safety reject, and the {id, tenantId}-scoped not-found path that
 * warns + no-ops (never uploads / never flips status) when the ExportJob row is absent
 * or belongs to another tenant. (The full bundle/upload happy path needs S3 + many
 * models; the IDOR skip is the security-critical branch.)
 */
const h = vi.hoisted(() => {
  const exportJob = { findFirst: vi.fn(), updateMany: vi.fn() };
  return {
    exportJob,
    prisma: { exportJob },
    putTenantExport: vi.fn(),
    getSignedObjectUrl: vi.fn(),
  };
});

vi.mock('@yelli/db', () => ({ prisma: h.prisma }));
vi.mock('@yelli/storage', () => ({
  putTenantExport: h.putTenantExport,
  getSignedObjectUrl: h.getSignedObjectUrl,
}));

const { processTenantExport } = await import('../tenant-export');

const job = (data: unknown) => ({ id: 'j1', data }) as never;

beforeEach(() => vi.clearAllMocks());

describe('processTenantExport', () => {
  it('rejects a job missing tenant/user identity', async () => {
    await expect(processTenantExport(job({ exportJobId: 'e1' }))).rejects.toThrow(
      /tenantId and userId are required/,
    );
  });

  it('no-ops (no upload, no status flip) when the ExportJob is absent / cross-tenant', async () => {
    h.exportJob.findFirst.mockResolvedValue(null);

    await expect(
      processTenantExport(job({ tenantId: 't1', userId: 'u1', exportJobId: 'e1' })),
    ).resolves.toBeUndefined();

    expect(h.exportJob.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'e1', tenantId: 't1' } }),
    );
    expect(h.exportJob.updateMany).not.toHaveBeenCalled(); // never claimed → processing
    expect(h.putTenantExport).not.toHaveBeenCalled(); // never uploaded
  });
});
