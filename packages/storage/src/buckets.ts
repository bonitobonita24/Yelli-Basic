/**
 * Bucket name registry (typed).
 * Names match inputs.yml `storage.buckets`.
 *
 * Lifecycle (DECISIONS_LOG "LOCKED: Database Backup" + Step 7):
 *   uploads — versioned, no TTL (yelli-prod-uploads)
 *   backups — 30-day expiry, Glacier IR after 7 days (yelli-backups-prod)
 *   exports — 24-hour expiry (yelli-tenant-exports)
 *
 * Lifecycle policies live in deploy/aws/s3-lifecycle.json (Phase 7 task).
 */

export const BUCKETS = {
  uploads: "yelli-prod-uploads",
  backups: "yelli-backups-prod",
  exports: "yelli-tenant-exports",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];
export type BucketKey = keyof typeof BUCKETS;

export function bucketFor(key: BucketKey): BucketName {
  return BUCKETS[key];
}
