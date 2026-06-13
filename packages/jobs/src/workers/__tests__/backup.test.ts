import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * backup worker — whole-DB pg_dump → offsite S3 (system cron). RUNTIME-DEFERRED:
 * BACKUP_S3_* is not provisioned (gate #2), so the worker MUST fail safe — reject
 * non-system payloads (assertSystemJob) and throw a clear "runtime deferred" error
 * rather than fabricate a credential. These two contracts are exactly what guards
 * the unprovisioned backup path. AWS SDK is stubbed (never reached on these paths).
 */
vi.mock('@aws-sdk/client-s3', () => ({ S3Client: class {} }));
vi.mock('@aws-sdk/lib-storage', () => ({ Upload: class {} }));

const { processBackup } = await import('../backup');

const job = (data: unknown) => ({ id: 'j1', data }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of [
    'BACKUP_S3_BUCKET',
    'BACKUP_S3_REGION',
    'BACKUP_S3_ENDPOINT',
    'BACKUP_S3_ACCESS_KEY_ID',
    'BACKUP_S3_SECRET_ACCESS_KEY',
  ]) {
    delete process.env[k];
  }
});

describe('processBackup', () => {
  it('rejects a non-system payload (requires _pwbt / system)', async () => {
    await expect(processBackup(job({ tenantId: 't1', userId: 'u1' }))).rejects.toThrow(/system job payload/);
  });

  it('fails safe when BACKUP_S3 is unconfigured (never fabricates a credential)', async () => {
    await expect(processBackup(job({ tenantId: '_pwbt', userId: 'system' }))).rejects.toThrow(
      /BACKUP_S3 not configured/,
    );
  });
});
