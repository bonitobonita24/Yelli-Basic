import { Worker, type Job } from "bullmq";
import { createWorkerConnection } from "../connection.js";
import { QUEUE_NAMES, type DeviceArchiveCronPayload } from "../types.js";
import { assertTenantUser, log } from "./_validate.js";

/**
 * device-archive-cron — daily 03:00 UTC, 90-day offline threshold.
 * DECISIONS_LOG: "LOCKED: Device Lifecycle". Per-tenant scoped per V25 cron rule.
 */
export function createDeviceArchiveWorker(): Worker<DeviceArchiveCronPayload> {
  return new Worker<DeviceArchiveCronPayload>(
    QUEUE_NAMES.deviceArchiveCron,
    async (job: Job<DeviceArchiveCronPayload>) => {
      assertTenantUser(job.data);
      log("info", "device-archive start", {
        jobId: job.id,
        tenantId: job.data.tenantId,
        offlineThresholdDays: job.data.offlineThresholdDays,
      });
      // TODO Phase 5: scan Device WHERE lastSeenAt < threshold AND tenantId=X → set archivedAt.
      return { status: "stub", archivedCount: 0 };
    },
    {
      connection: createWorkerConnection(),
      concurrency: 1,
      lockDuration: 300_000,
    }
  );
}
