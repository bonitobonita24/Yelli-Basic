import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * logo-image worker — branding logo resize/optimize (W5d). Mocks sharp + @yelli/storage
 * to validate the orchestration (fetch original → server-side re-verify → resize/encode
 * → store processed → point Tenant.logoUrl), the Queue-Safety guard, and the
 * tenant-deleted-mid-flight no-op (updateMany count 0). Real image bytes aren't needed —
 * sharp's pipeline is stubbed; the magic-byte authority (validateBrandingUpload) is the
 * storage layer's own unit concern.
 */
const h = vi.hoisted(() => {
  const tenant = { updateMany: vi.fn() };
  const toBuffer = vi.fn(async () => Buffer.from('processed-bytes'));
  const pipeline = { png: vi.fn(() => ({ toBuffer })), jpeg: vi.fn(() => ({ toBuffer })) };
  const sharpInstance = { metadata: vi.fn(async () => ({ format: 'png' })), resize: vi.fn(() => pipeline) };
  return {
    tenant,
    prisma: { tenant },
    sharp: vi.fn(() => sharpInstance),
    getBrandingObject: vi.fn(async () => ({ bytes: new Uint8Array([1, 2, 3]), contentType: 'image/png' })),
    putBrandingLogo: vi.fn(async () => ({ key: 'tenant/t1/logo-xyz.png', url: 'https://cdn/x.png' })),
    validateBrandingUpload: vi.fn(() => ({ mime: 'image/png', ext: 'png' })),
  };
});

vi.mock('sharp', () => ({ default: h.sharp }));
vi.mock('@yelli/db', () => ({ prisma: h.prisma }));
vi.mock('@yelli/storage', () => ({
  getBrandingObject: h.getBrandingObject,
  putBrandingLogo: h.putBrandingLogo,
  validateBrandingUpload: h.validateBrandingUpload,
}));

const { processLogoImage } = await import('../logo-image');

const job = (data: unknown) => ({ id: 'j1', data }) as never;
const valid = { tenantId: 't1', userId: 'u1', storageKey: 'tenant/t1/orig.png' };

beforeEach(() => vi.clearAllMocks());

describe('processLogoImage', () => {
  it('rejects a job missing tenant/user identity', async () => {
    await expect(processLogoImage(job({ storageKey: 'k' }))).rejects.toThrow(
      /tenantId and userId are required/,
    );
  });

  it('fetches → re-verifies → resizes → stores → points Tenant.logoUrl at the processed asset', async () => {
    h.tenant.updateMany.mockResolvedValue({ count: 1 });

    await processLogoImage(job(valid));

    expect(h.getBrandingObject).toHaveBeenCalledWith('tenant/t1/orig.png');
    expect(h.validateBrandingUpload).toHaveBeenCalled(); // server-side magic-byte re-verify
    expect(h.putBrandingLogo).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', contentType: 'image/png', ext: 'png' }),
    );
    expect(h.tenant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't1' }, data: { logoUrl: 'https://cdn/x.png' } }),
    );
  });

  it('no-ops when the tenant was deleted mid-flight (updateMany count 0)', async () => {
    h.tenant.updateMany.mockResolvedValue({ count: 0 });
    await expect(processLogoImage(job(valid))).resolves.toBeUndefined();
  });
});
