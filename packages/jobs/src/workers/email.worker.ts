import { Worker, type Job } from "bullmq";
import { createWorkerConnection } from "../connection";
import { QUEUE_NAMES, type EmailPayload } from "../types";
import { assertTenantUser, log } from "./_validate";

/**
 * email — invitation, verify, reset, tenant-export-ready.
 * DECISIONS_LOG: "LOCKED: Jobs + Queues".
 * security.md Queue Safety rule 4: idempotent via payload.idempotencyKey.
 * Real send: Phase 5 wires SMTP/transactional provider.
 */
export function createEmailWorker(): Worker<EmailPayload> {
  return new Worker<EmailPayload>(
    QUEUE_NAMES.email,
    async (job: Job<EmailPayload>) => {
      assertTenantUser(job.data);
      if (typeof job.data.idempotencyKey !== "string" || job.data.idempotencyKey.length === 0) {
        throw new Error("email payload missing idempotencyKey");
      }
      log("info", "email start", {
        jobId: job.id,
        tenantId: job.data.tenantId,
        kind: job.data.kind,
        idempotencyKey: job.data.idempotencyKey,
      });
      // TODO Phase 5: render template + SMTP send.
      return { status: "stub", messageId: null };
    },
    {
      connection: createWorkerConnection(),
      concurrency: 10,
      lockDuration: 60_000,
    }
  );
}
