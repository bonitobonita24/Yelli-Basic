import type { Job } from 'bullmq';
import { QUEUE_NAMES, type QueueName, type JobDataMap } from '../queues';
import { processDeviceArchive } from '../workers/device-archive';
import { processTenantExport } from '../workers/tenant-export';
import { processSoftDeleteCron } from '../workers/soft-delete-cron';
import { processBackup } from '../workers/backup';
import { processEmail } from '../workers/email';
import { processLogoImage } from '../workers/logo-image';

/** A BullMQ processor bound to one queue's payload type. */
export type Processor<N extends QueueName> = (job: Job<JobDataMap[N]>) => Promise<void>;

/**
 * Static registry: queue name → its processor.
 *
 * `device-archive` carries the real W5a body; the other five are the S3 guard-wired
 * STUBS (they `throw NotImplemented` until their own W5b–W5e sessions fill them).
 * Registering Workers against the stubs is deliberate (Brain q-80-S2-01): an enqueued
 * job fails fast + lands in the failed set (the de-facto DLQ) rather than piling up
 * silently — surfacing the missing implementation instead of hiding it.
 */
export const PROCESSORS: { [N in QueueName]: Processor<N> } = {
  [QUEUE_NAMES.deviceArchive]: processDeviceArchive,
  [QUEUE_NAMES.tenantExport]: processTenantExport,
  [QUEUE_NAMES.softDeleteCron]: processSoftDeleteCron,
  [QUEUE_NAMES.backup]: processBackup,
  [QUEUE_NAMES.email]: processEmail,
  [QUEUE_NAMES.logoImage]: processLogoImage,
};
