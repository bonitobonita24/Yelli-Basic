import { S3Client } from "@aws-sdk/client-s3";

/**
 * S3Client factory.
 *
 * Dev: MinIO (forcePathStyle + custom endpoint).
 * Prod: AWS S3 (forcePathStyle off, region required).
 *
 * Env contract:
 *   STORAGE_ENDPOINT       — http://localhost:PORT (dev MinIO) | undefined (prod)
 *   STORAGE_REGION         — required in all envs (e.g. us-east-1)
 *   STORAGE_ACCESS_KEY     — required
 *   STORAGE_SECRET_KEY     — required
 *   STORAGE_FORCE_PATH_STYLE — "true" forces path-style addressing (dev MinIO)
 */

let client: S3Client | null = null;

export function getStorageClient(): S3Client {
  if (client) return client;

  const region = process.env.STORAGE_REGION;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY;
  const secretAccessKey = process.env.STORAGE_SECRET_KEY;
  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "STORAGE_REGION, STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY are required"
    );
  }

  const endpoint = process.env.STORAGE_ENDPOINT;
  const forcePathStyle =
    process.env.STORAGE_FORCE_PATH_STYLE === "true" || Boolean(endpoint);

  client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle,
  });
  return client;
}

/** Reset cached client — call from test setup or after env mutation. */
export function resetStorageClient(): void {
  client = null;
}
