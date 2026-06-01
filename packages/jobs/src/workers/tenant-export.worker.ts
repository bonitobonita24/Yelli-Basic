import { Worker, type Job } from "bullmq";
import { createWorkerConnection } from "../connection.js";
import { QUEUE_NAMES, type TenantExportPayload } from "../types.js";
import { assertTenantUser, log } from "./_validate.js";

/**
 * tenant-export — bundle tenant JSON → S3 → signed 24h URL email.
 * DECISIONS_LOG: "LOCKED: Jobs + Queues" (rate-limited 1/tenant/24h).
 * Real implementation: Phase 5 Feature Update.
 */
export function createTenantExportWorker(): Worker<TenantExportPayload> {
  return new Worker<TenantExportPayload>(
    QUEUE_NAMES.tenantExport,
    async (job: Job<TenantExportPayload>) => {
      assertTenantUser(job.data);
      log("info", "tenant-export start", {
        jobId: job.id,
        tenantId: job.data.tenantId,
        userId: job.data.userId,
      });
      // TODO Phase 5: bundle + S3 upload + signed URL + email queue enqueue.
      return { status: "stub", message: "Phase 5 will implement" };
    },
    {
      connection: createWorkerConnection(),
      concurrency: 1,
      lockDuration: 60_000,
    }
  );
}
