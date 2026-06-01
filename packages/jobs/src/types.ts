/**
 * Typed BullMQ job payloads for every queue.
 *
 * SECURITY (security.md Queue Safety rule 1):
 * Every payload MUST include `tenantId` AND `userId`.
 * Workers validate both before processing — reject jobs with missing values.
 *
 * NOTE on cron jobs (security.md Queue Safety rule 7):
 * Cron jobs run without HTTP request context. They iterate over all active
 * tenants explicitly; the per-tenant job they enqueue carries that tenantId.
 * The cron *trigger* itself uses `userId: "system"` and `tenantId` matches
 * the tenant being processed in that iteration.
 */

export interface TenantExportPayload {
  tenantId: string;
  userId: string;
  requestedAt: string;
  notificationEmail: string;
}

export interface DeviceArchiveCronPayload {
  tenantId: string;
  userId: "system";
  offlineThresholdDays: number;
  triggeredAt: string;
}

export interface SoftDeleteHardDeleteCronPayload {
  tenantId: string;
  userId: "system";
  thresholdDays: number;
  triggeredAt: string;
}

export interface BackupCronPayload {
  tenantId: "_pwbt";
  userId: "system";
  targetUri: string;
  triggeredAt: string;
}

export type EmailKind =
  | "invitation"
  | "verify"
  | "reset"
  | "tenant-export-ready";

export interface EmailPayload {
  tenantId: string;
  userId: string;
  kind: EmailKind;
  to: string;
  subject: string;
  templateData: Record<string, string | number | boolean>;
  idempotencyKey: string;
}

export interface LogoImageProcessingPayload {
  tenantId: string;
  userId: string;
  sourceKey: string;
  targetKey: string;
  variants: ReadonlyArray<{ width: number; height: number; format: "webp" | "png" }>;
}

export type JobPayload =
  | TenantExportPayload
  | DeviceArchiveCronPayload
  | SoftDeleteHardDeleteCronPayload
  | BackupCronPayload
  | EmailPayload
  | LogoImageProcessingPayload;

export const QUEUE_NAMES = {
  tenantExport: "tenant-export",
  deviceArchiveCron: "device-archive-cron",
  softDeleteHardDeleteCron: "soft-delete-hard-delete-cron",
  backupCron: "backup-cron",
  email: "email",
  logoImageProcessing: "logo-image-processing",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
