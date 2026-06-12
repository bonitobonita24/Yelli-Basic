import { Queue, type QueueOptions } from 'bullmq';
import type { Redis } from 'ioredis';

/**
 * The 6 BullMQ queues (LOCKED: Jobs + Queues [Step 5] + Database Backup [Step 7]).
 * Names are the canonical queue identifiers (inputs.yml jobs.queues); BullMQ job
 * payloads carry their own event names (e.g. `tenant.export`).
 */
export const QUEUE_NAMES = {
  deviceArchive: 'device-archive',
  tenantExport: 'tenant-export',
  softDeleteCron: 'soft-delete-cron',
  backup: 'backup',
  email: 'email',
  logoImage: 'logo-image',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Base payload — security.md Queue Safety rule 1+2: EVERY job carries tenantId +
 * userId, validated server-side by `assertTenantUser` before any work runs.
 */
export interface BaseJobData {
  tenantId: string;
  userId: string;
  /** UUIDv7 idempotency key — server dedups replayed jobs (LOCKED PWA replay queue). */
  idempotencyKey?: string;
}

/**
 * device-archive — cron daily 03:00 UTC. The scheduler enqueues ONE job per
 * tenant (V25 cron rule: iterate tenants explicitly), so the payload is
 * tenant-scoped and passes `assertTenantUser` (userId = the system actor).
 */
export type DeviceArchiveJobData = BaseJobData;

/** soft-delete-cron — 7-day soft-delete → hard-delete sweep, enqueued per tenant. */
export type SoftDeleteCronJobData = BaseJobData;

/** tenant-export — JSON bundle → S3/MinIO → signed 24h URL email (1/tenant/24h). */
export interface TenantExportJobData extends BaseJobData {
  /** The ExportJob row id this worker fulfils. */
  exportJobId: string;
}

/**
 * backup — whole-DB pg_dump (LOCKED Database Backup). Not tenant-scoped: it
 * operates on the entire database, so it carries the platform system identity
 * and is validated by the stricter `assertSystemJob` guard.
 */
export interface BackupJobData extends BaseJobData {
  tenantId: '_pwbt';
  userId: 'system';
}

/** email — transactional invitation / verify / reset. */
export interface EmailJobData extends BaseJobData {
  kind: 'invitation' | 'verify' | 'reset';
  to: string;
  token: string;
}

/** logo-image — tenant branding logo resize + format (PNG/JPEG only — LOCKED MIME whitelist). */
export interface LogoImageJobData extends BaseJobData {
  /** Storage key of the uploaded original to process. */
  storageKey: string;
}

/** Static map: queue name → its job payload type. */
export interface JobDataMap {
  'device-archive': DeviceArchiveJobData;
  'tenant-export': TenantExportJobData;
  'soft-delete-cron': SoftDeleteCronJobData;
  backup: BackupJobData;
  email: EmailJobData;
  'logo-image': LogoImageJobData;
}

/**
 * Create a typed BullMQ Queue. DEFINITIONS only — the BullMQ wiring session
 * instantiates the Queues, Workers, and cron schedulers. The connection is
 * injected (no eager Redis connection at import time).
 */
export function createQueue<N extends QueueName>(
  name: N,
  connection: Redis,
  options: Omit<QueueOptions, 'connection'> = {},
): Queue<JobDataMap[N]> {
  return new Queue<JobDataMap[N]>(name, { connection, ...options });
}
