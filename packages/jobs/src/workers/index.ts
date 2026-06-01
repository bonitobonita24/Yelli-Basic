import type { Worker } from "bullmq";
import { closeAllConnections } from "../connection.js";
import { closeAllQueues } from "../queues.js";
import { createTenantExportWorker } from "./tenant-export.worker.js";
import { createDeviceArchiveWorker } from "./device-archive.worker.js";
import { createSoftDeleteCronWorker } from "./soft-delete-cron.worker.js";
import { createBackupCronWorker } from "./backup-cron.worker.js";
import { createEmailWorker } from "./email.worker.js";
import { createLogoImageProcessingWorker } from "./logo-image-processing.worker.js";
import { log } from "./_validate.js";

/**
 * Boot every worker and wire graceful shutdown.
 * Entry point for the worker container (Phase 4 Part 7 compose runs `node dist/workers/index.js`).
 */

export interface WorkerRuntime {
  workers: ReadonlyArray<Worker>;
  shutdown: () => Promise<void>;
}

export function startAllWorkers(): WorkerRuntime {
  const workers: Worker[] = [
    createTenantExportWorker(),
    createDeviceArchiveWorker(),
    createSoftDeleteCronWorker(),
    createBackupCronWorker(),
    createEmailWorker(),
    createLogoImageProcessingWorker(),
  ];

  for (const w of workers) {
    w.on("failed", (job, err) => {
      log("error", "worker job failed", {
        queue: w.name,
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
        failedReason: err.message,
      });
    });
    w.on("completed", (job) => {
      log("info", "worker job completed", { queue: w.name, jobId: job.id });
    });
  }

  log("info", "all workers started", { count: workers.length });

  const shutdown = async (): Promise<void> => {
    log("info", "worker shutdown begin");
    await Promise.all(workers.map((w) => w.close()));
    await closeAllQueues();
    await closeAllConnections();
    log("info", "worker shutdown complete");
  };

  return { workers, shutdown };
}

/**
 * Standalone entrypoint: `node dist/workers/index.js`.
 * Wires SIGTERM + SIGINT to graceful shutdown.
 */
export async function main(): Promise<void> {
  const runtime = startAllWorkers();
  let shuttingDown = false;
  const handler = (sig: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    log("info", "signal received", { signal: sig });
    runtime
      .shutdown()
      .then(() => process.exit(0))
      .catch((err) => {
        log("error", "shutdown failed", { error: String(err) });
        process.exit(1);
      });
  };
  process.on("SIGTERM", handler);
  process.on("SIGINT", handler);
}

// Run when executed directly (not when imported).
const isEntrypoint =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "");
if (isEntrypoint) {
  void main();
}
