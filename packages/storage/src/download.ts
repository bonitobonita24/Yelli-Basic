import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorageClient } from "./client.js";
import { bucketFor, type BucketKey } from "./buckets.js";

/**
 * Signed-URL download with tenant verification.
 *
 * security.md File Upload Safety rule 8:
 *   - Storage paths embed tenantId as the FIRST path segment
 *   - Caller's session tenantId MUST match the storage key prefix
 *   - On mismatch → throw 404-equivalent (do not confirm file exists)
 *
 * Default expiry: 15 minutes (uploads). Caller may override for exports (24h).
 */

export interface SignedUrlInput {
  bucketKey: BucketKey;
  storageKey: string;       // full path: ${tenantId}/${entityType}/${filename}
  sessionTenantId: string;  // from authenticated session
  expiresInSeconds?: number;
}

export class StorageAccessError extends Error {
  constructor() {
    super("Not found"); // intentionally generic — security.md rule 8
    this.name = "StorageAccessError";
  }
}

export async function getBrandingSignedUrl(input: SignedUrlInput): Promise<string> {
  const firstSlash = input.storageKey.indexOf("/");
  if (firstSlash <= 0) {
    throw new StorageAccessError();
  }
  const keyTenantId = input.storageKey.slice(0, firstSlash);
  if (keyTenantId !== input.sessionTenantId) {
    // Mismatch → treat as if file doesn't exist (do not leak existence)
    throw new StorageAccessError();
  }

  const bucket = bucketFor(input.bucketKey);
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: input.storageKey });
  return getSignedUrl(getStorageClient(), cmd, {
    expiresIn: input.expiresInSeconds ?? 15 * 60,
  });
}

/**
 * Long-lived signed URL for tenant exports (24h per DECISIONS_LOG).
 */
export async function getExportSignedUrl(input: {
  storageKey: string;
  sessionTenantId: string;
}): Promise<string> {
  return getBrandingSignedUrl({
    bucketKey: "exports",
    storageKey: input.storageKey,
    sessionTenantId: input.sessionTenantId,
    expiresInSeconds: 24 * 60 * 60,
  });
}
