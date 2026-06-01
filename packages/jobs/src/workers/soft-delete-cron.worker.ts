import { Worker, type Job } from "bullmq";
import { createWorkerConnection } from "../connection.js";
import { QUEUE_NAMES, type SoftDeleteHardDeleteCronPayload } from "../types.js";
import { assertTenantUser, log } from "./_validate.js";

/**
 * soft-delete-hard-delete-cron — daily 04:00 UTC.
 * Hard-delete records soft-deleted > 7 days ago.
 * DECISIONS_LOG: "LOCKED: Jobs + Queues" (7-day soft-delete hard-delete cron).
 */
export function createSoftDeleteCronWorker(): Worker<SoftDeleteHardDeleteCronPayload> {
  return new Worker<SoftDeleteHardDeleteCronPayload>(
    QUEUE_NAMES.softDeleteHardDeleteCron,
    async (job: Job<SoftDeleteHardDeleteCronPayload>) => {
      assertTenantUser(job.data);
      log("info", "soft-delete-cron start", {
        jobId: job.id,
        tenantId: job.data.tenantId,
        thresholdDays: job.data.thresholdDays,
      });
      // TODO Phase 5: hard-delete rows WHERE deletedAt < threshold AND tenantId=X.
      return { status: "stub", deletedCount: 0 };
    },
    {
      connection: createWorkerConnection(),
      concurrency: 1,
      lockDuration: 300_000,
    }
  );
}
