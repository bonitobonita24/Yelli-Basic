import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomBytes } from "node:crypto";
import { getStorageClient } from "./client";
import { bucketFor, type BucketKey } from "./buckets";
import { validateBrandingUpload, type ValidatedFile } from "./validate";

/**
 * Tenant-scoped upload.
 *
 * security.md File Upload Safety rule 4+5: random filename + tenantId prefix.
 * Path: ${tenantId}/${entityType}/${randomFilename}.${ext}
 *
 * Caller MUST supply tenantId from server session (NEVER from client input)
 * — see security.md Agent Prohibitions rule 11+13 + tenant-middleware-safety rule.
 */

export interface UploadInput {
  bucketKey: BucketKey;
  tenantId: string;
  entityType: string; // e.g. "branding", "user-avatar"
  declaredMime: string;
  bytes: Uint8Array;
}

export interface UploadResult {
  bucket: string;
  key: string;
  mime: string;
  bytes: number;
}

function randomFilename(): string {
  return randomBytes(16).toString("hex");
}

function assertSafeTenantId(tenantId: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(tenantId)) {
    throw new Error("tenantId contains unsafe characters");
  }
  if (tenantId.length > 64) {
    throw new Error("tenantId too long");
  }
}

function assertSafeEntityType(entityType: string): void {
  if (!/^[a-z][a-z0-9-]*$/.test(entityType)) {
    throw new Error("entityType must be lowercase kebab-case");
  }
}

export async function uploadBrandingImage(input: UploadInput): Promise<UploadResult> {
  assertSafeTenantId(input.tenantId);
  assertSafeEntityType(input.entityType);

  const validated: ValidatedFile = validateBrandingUpload({
    bytes: input.bytes,
    declaredMime: input.declaredMime,
  });

  const bucket = bucketFor(input.bucketKey);
  const key = `${input.tenantId}/${input.entityType}/${randomFilename()}.${validated.ext}`;

  await getStorageClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: validated.bytes,
      ContentType: validated.mime,
      // Defense-in-depth: never let a stored file get served with an executable type
      CacheControl: "private, max-age=0, no-store",
    })
  );

  return {
    bucket,
    key,
    mime: validated.mime,
    bytes: validated.bytes.length,
  };
}
