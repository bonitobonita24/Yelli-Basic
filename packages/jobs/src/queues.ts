import { Queue, type JobsOptions } from "bullmq";
import { getConnection } from "./connection.js";
import {
  QUEUE_NAMES,
  type TenantExportPayload,
  type DeviceArchiveCronPayload,
  type SoftDeleteHardDeleteCronPayload,
  type BackupCronPayload,
  type EmailPayload,
  type LogoImageProcessingPayload,
} from "./types.js";

/**
 * Default job options applied to every queue.
 * Per security.md Queue Safety rule 4: idempotent + retried on failure + DLQ.
 * `removeOnComplete: false` keeps the last 1000 successful jobs visible;
 * `removeOnFail: false` keeps ALL failed jobs (DLQ inspection).
 */
const DEFAULT_JOB_OPTS: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: false,
};

function makeQueue<T>(name: string): Queue<T> {
  return new Queue<T>(name, {
    connection: getConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTS,
  });
}

export const queues = {
  tenantExport: makeQueue<TenantExportPayload>(QUEUE_NAMES.tenantExport),
  deviceArchiveCron: makeQueue<DeviceArchiveCronPayload>(QUEUE_NAMES.deviceArchiveCron),
  softDeleteHardDeleteCron: makeQueue<SoftDeleteHardDeleteCronPayload>(
    QUEUE_NAMES.softDeleteHardDeleteCron
  ),
  backupCron: makeQueue<BackupCronPayload>(QUEUE_NAMES.backupCron),
  email: makeQueue<EmailPayload>(QUEUE_NAMES.email),
  logoImageProcessing: makeQueue<LogoImageProcessingPayload>(
    QUEUE_NAMES.logoImageProcessing
  ),
} as const;

/**
 * Gracefully close every queue. Call from SIGTERM handler BEFORE
 * closeAllConnections() so pending writes flush first.
 */
export async function closeAllQueues(): Promise<void> {
  await Promise.all(Object.values(queues).map((q) => q.close()));
}
