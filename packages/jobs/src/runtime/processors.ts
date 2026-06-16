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
 * All six processors now carry their real worker bodies (W5a device-archive,
 * W5b tenant-export, W5c email, W5d logo-image, W5e backup, plus soft-delete-cron).
 * Two of them still fail fast by design when their runtime prerequisites are
 * absent rather than fabricating behaviour (Brain q-80-S2-01 posture): `backup`
 * throws when `BACKUP_S3` is unconfigured (owner-deferred — see DECISIONS_LOG),
 * and `email` throws for the `verify`/`reset` kinds that have no producer yet
 * (Phase-7 magic-link / email-link providers — DECISIONS_LOG line 204). Such a
 * job lands in the failed set (the de-facto DLQ), surfacing the gap instead of
 * hiding it. The `invitation` email path and every other worker run for real.
 */
export const PROCESSORS: { [N in QueueName]: Processor<N> } = {
  [QUEUE_NAMES.deviceArchive]: processDeviceArchive,
  [QUEUE_NAMES.tenantExport]: processTenantExport,
  [QUEUE_NAMES.softDeleteCron]: processSoftDeleteCron,
  [QUEUE_NAMES.backup]: processBackup,
  [QUEUE_NAMES.email]: processEmail,
  [QUEUE_NAMES.logoImage]: processLogoImage,
};
