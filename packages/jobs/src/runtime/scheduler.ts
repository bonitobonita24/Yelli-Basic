import { Queue, Worker, type JobsOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import { prisma } from '@yelli/db';
import { QUEUE_NAMES } from '../queues';
import { createQueue } from '../queues';
import { log } from '../workers/_validate';

/**
 * Internal infra queue (NOT a domain queue in QUEUE_NAMES). The daily device-archive
 * cron tick lands here; the dispatcher worker below fans it out to ONE `device-archive`
 * job per non-suspended tenant — because the W5a processor is per-tenant and security.md
 * cron rule 7 mandates explicit per-tenant iteration (cron has no tenant context).
 */
const DEVICE_ARCHIVE_DISPATCH_QUEUE = 'device-archive-dispatch';
const DEVICE_ARCHIVE_SCHEDULER_ID = 'device-archive-daily';

/**
 * 03:00:00 UTC every day (sec min hour day month weekday). LOCKED Step 5 schedule.
 * `tz: 'UTC'` makes "03:00 UTC" explicit regardless of the host timezone.
 */
const DEVICE_ARCHIVE_CRON = '0 0 3 * * *';

export interface CronHandles {
  dispatchQueue: Queue;
  deviceArchiveQueue: Queue;
  dispatcherWorker: Worker;
}

/**
 * Register the device-archive daily cron + its fan-out dispatcher.
 *
 * `upsertJobScheduler` is idempotent — re-running the host re-asserts the schedule
 * without creating duplicates. The dispatcher worker reads non-suspended tenants and
 * bulk-enqueues a `{ tenantId, userId: 'system' }` job per tenant onto the real
 * `device-archive` queue, which `processDeviceArchive` (W5a) then handles per tenant.
 *
 * Only device-archive is scheduled here — it is the only implemented cron processor.
 * `backup` (02:00 UTC, Step 7) and `soft-delete-cron` (Step 5) stay UNSCHEDULED until
 * their bodies land (W5e / the deferred schema session), to avoid daily failing ticks.
 */
export async function startDeviceArchiveCron(
  connection: Redis,
  jobOpts: JobsOptions,
): Promise<CronHandles> {
  const deviceArchiveQueue = createQueue(QUEUE_NAMES.deviceArchive, connection);
  const dispatchQueue = new Queue(DEVICE_ARCHIVE_DISPATCH_QUEUE, { connection });

  const dispatcherWorker = new Worker(
    DEVICE_ARCHIVE_DISPATCH_QUEUE,
    async () => {
      // Base (unguarded) client — Tenant is L6-excluded; this is system cron, not a
      // tenant-scoped request. Per-tenant scoping is enforced inside processDeviceArchive.
      const tenants = await prisma.tenant.findMany({
        where: { isSuspended: false },
        select: { id: true },
      });
      if (tenants.length === 0) {
        log('info', 'device-archive cron tick — no active tenants', {
          queue: QUEUE_NAMES.deviceArchive,
        });
        return;
      }
      await deviceArchiveQueue.addBulk(
        tenants.map((t) => ({
          name: 'archive',
          data: { tenantId: t.id, userId: 'system' },
          opts: jobOpts,
        })),
      );
      log('info', 'device-archive cron fanned out', {
        queue: QUEUE_NAMES.deviceArchive,
        tenants: tenants.length,
      });
    },
    { connection, concurrency: 1 },
  );

  await dispatchQueue.upsertJobScheduler(
    DEVICE_ARCHIVE_SCHEDULER_ID,
    { pattern: DEVICE_ARCHIVE_CRON, tz: 'UTC' },
    { name: 'tick', data: {}, opts: { removeOnComplete: true, removeOnFail: 100 } },
  );

  return { dispatchQueue, deviceArchiveQueue, dispatcherWorker };
}
