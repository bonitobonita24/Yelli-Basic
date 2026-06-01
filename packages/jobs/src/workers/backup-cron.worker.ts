import { Worker, type Job } from "bullmq";
import { createWorkerConnection } from "../connection";
import { QUEUE_NAMES, type BackupCronPayload } from "../types";
import { log } from "./_validate";

/**
 * backup-cron — daily 02:00 UTC, pg_dump → s3://yelli-backups-prod/postgres/.
 * DECISIONS_LOG: "LOCKED: Database Backup".
 * Runs in `_pwbt` platform tenant (not per-tenant — backup is whole-DB).
 */
export function createBackupCronWorker(): Worker<BackupCronPayload> {
  return new Worker<BackupCronPayload>(
    QUEUE_NAMES.backupCron,
    async (job: Job<BackupCronPayload>) => {
      // backup-cron skips assertTenantUser — uses fixed _pwbt + system userId by design.
      if (job.data.tenantId !== "_pwbt") {
        throw new Error("backup-cron only runs in _pwbt platform tenant");
      }
      if (job.data.userId !== "system") {
        throw new Error("backup-cron only runs as system user");
      }
      log("info", "backup-cron start", {
        jobId: job.id,
        targetUri: job.data.targetUri,
      });
      // TODO Phase 5: spawn pg_dump --format=custom --compress=9 → S3 upload.
      return { status: "stub", bytesWritten: 0 };
    },
    {
      connection: createWorkerConnection(),
      concurrency: 1,
      lockDuration: 1_800_000, // 30 min — pg_dump can be slow on large DBs
    }
  );
}
