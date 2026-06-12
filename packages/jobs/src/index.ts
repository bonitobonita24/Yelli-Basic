// @yelli/jobs — public barrel.
// BullMQ queue DEFINITIONS + worker payload guards + worker STUBS for the 6
// queues (LOCKED: Jobs + Queues / Database Backup). The wiring session
// instantiates the Queues, Workers, and cron schedulers from these definitions.

export { createRedisConnection } from './connection';
export {
  QUEUE_NAMES,
  createQueue,
  type QueueName,
  type BaseJobData,
  type DeviceArchiveJobData,
  type SoftDeleteCronJobData,
  type TenantExportJobData,
  type BackupJobData,
  type EmailJobData,
  type LogoImageJobData,
  type JobDataMap,
} from './queues';
export { assertTenantUser, assertSystemJob, log, type LogLevel } from './workers/_validate';
export { processDeviceArchive } from './workers/device-archive';
export { processTenantExport } from './workers/tenant-export';
export { processSoftDeleteCron } from './workers/soft-delete-cron';
export { processBackup } from './workers/backup';
export { processEmail } from './workers/email';
export { processLogoImage } from './workers/logo-image';
