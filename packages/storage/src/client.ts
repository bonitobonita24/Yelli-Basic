import { randomUUID } from 'node:crypto';

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * S3 / MinIO object PUT for branding logos. The same S3 API covers MinIO (dev)
 * via `forcePathStyle`; the provider is chosen purely by env:
 *   STORAGE_ENDPOINT · STORAGE_BUCKET · STORAGE_ACCESS_KEY · STORAGE_SECRET_KEY
 *   STORAGE_REGION (optional, defaults us-east-1)
 *
 * The client is lazily constructed on first use (so importing this module is
 * side-effect-free for `next build` / unit tests with no storage configured) and
 * throws a clear error if a required var is missing at call time.
 */
let cached: { client: S3Client; bucket: string; baseUrl: string } | null = null;

function getStorage(): { client: S3Client; bucket: string; baseUrl: string } {
  if (cached) return cached;

  const endpoint = process.env['STORAGE_ENDPOINT'];
  const bucket = process.env['STORAGE_BUCKET'];
  const accessKeyId = process.env['STORAGE_ACCESS_KEY'];
  const secretAccessKey = process.env['STORAGE_SECRET_KEY'];
  const region = process.env['STORAGE_REGION'] ?? 'us-east-1';

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Storage is not configured (STORAGE_ENDPOINT / STORAGE_BUCKET / STORAGE_ACCESS_KEY / STORAGE_SECRET_KEY).',
    );
  }

  const client = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    // MinIO + most S3-compatible servers require path-style addressing.
    forcePathStyle: true,
  });
  cached = { client, bucket, baseUrl: `${endpoint.replace(/\/$/, '')}/${bucket}` };
  return cached;
}

/**
 * Upload a branding logo under a tenant-prefixed, randomized key (security.md
 * File Upload Safety #4 randomized filename + #5 tenantId path prefix). Returns
 * the storage key (for the resize job) and a public object URL (Tenant.logoUrl).
 */
export async function putBrandingLogo(input: {
  tenantId: string;
  bytes: Uint8Array;
  contentType: string;
  ext: string;
}): Promise<{ key: string; url: string }> {
  const { client, bucket, baseUrl } = getStorage();
  const key = `${input.tenantId}/branding/logo-${randomUUID()}.${input.ext}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: input.bytes,
      ContentType: input.contentType,
    }),
  );

  return { key, url: `${baseUrl}/${key}` };
}

/**
 * Fetch a stored object's raw bytes + content type by key. Used by the logo-image
 * resize worker (@yelli/jobs) to pull the original upload it must re-encode. The
 * key is server-controlled (it is the value returned by `putBrandingLogo` and
 * persisted on the producer side) — never a raw client-supplied path
 * (security.md File Upload Safety #8: download endpoints take the storage key from
 * trusted server state, not the client).
 */
export async function getBrandingObject(
  key: string,
): Promise<{ bytes: Uint8Array; contentType: string | undefined }> {
  const { client, bucket } = getStorage();
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) {
    throw new Error(`Storage object has no body: ${key}`);
  }
  // AWS SDK v3 streaming blob → bytes (Node, browser, and edge runtimes all support this).
  const bytes = await response.Body.transformToByteArray();
  return { bytes, contentType: response.ContentType };
}
