import { Worker, type JobsOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import { createRedisConnection } from '../connection';
import { QUEUE_NAMES, type QueueName, type JobDataMap } from '../queues';
import { log } from '../workers/_validate';
import { PROCESSORS } from './processors';
import { startDeviceArchiveCron } from './scheduler';

/**
 * Default job options applied to every enqueued device-archive job (and any future
 * scheduled producer). `attempts` + exponential `backoff` give automatic retry; an
 * exhausted job stays in the failed set — the de-facto DLQ — for inspection
 * (`removeOnFail` keeps the last 1000). `removeOnComplete` trims successes.
 */
const DEFAULT_JOB_OPTS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 1_000 },
};

const CONCURRENCY = 5;

export interface WorkerHost {
  stop: () => Promise<void>;
}

/** Structured-JSON failed/error logging — the DLQ observability surface for every worker. */
function attachListeners(worker: Worker, label: string): void {
  worker.on('failed', (job, err) => {
    const attemptsMade = job?.attemptsMade ?? 0;
    const attemptsMax = job?.opts.attempts ?? 1;
    log('error', 'job failed', {
      queue: label,
      jobId: job?.id ?? null,
      attemptsMade,
      attemptsMax,
      // True once retries are exhausted → the job now rests in the DLQ (failed set).
      dlq: attemptsMade >= attemptsMax,
      err: err.message,
    });
  });
  worker.on('error', (err) => {
    log('error', 'worker error', { queue: label, err: err.message });
  });
}

/** Instantiate a typed Worker for one queue, bound to its registered processor. */
function makeWorker<N extends QueueName>(name: N, connection: Redis): Worker<JobDataMap[N]> {
  const worker = new Worker<JobDataMap[N]>(name, PROCESSORS[name], { connection, concurrency: CONCURRENCY });
  attachListeners(worker, name);
  return worker;
}

/**
 * Start the BullMQ worker host: one Worker per domain queue (device-archive real;
 * the other five against their guard-wired stubs), plus the device-archive cron
 * dispatcher. Returns a `stop()` that drains workers and closes every connection.
 */
export async function startWorkerHost(): Promise<WorkerHost> {
  const connection = createRedisConnection();

  const workers: Worker[] = [
    makeWorker(QUEUE_NAMES.deviceArchive, connection),
    makeWorker(QUEUE_NAMES.tenantExport, connection),
    makeWorker(QUEUE_NAMES.softDeleteCron, connection),
    makeWorker(QUEUE_NAMES.backup, connection),
    makeWorker(QUEUE_NAMES.email, connection),
    makeWorker(QUEUE_NAMES.logoImage, connection),
  ];

  const cron = await startDeviceArchiveCron(connection, DEFAULT_JOB_OPTS);
  attachListeners(cron.dispatcherWorker, 'device-archive-dispatch');

  log('info', 'worker host ready', {
    queues: Object.values(QUEUE_NAMES),
    cron: ['device-archive (03:00 UTC)'],
  });

  return {
    stop: async () => {
      // Stop accepting work + drain in-flight jobs first, then close queues, then Redis.
      await Promise.all([...workers.map((w) => w.close()), cron.dispatcherWorker.close()]);
      await Promise.all([cron.dispatchQueue.close(), cron.deviceArchiveQueue.close()]);
      await connection.quit();
    },
  };
}
