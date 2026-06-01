import { Worker, type Job } from "bullmq";
import { createWorkerConnection } from "../connection";
import { QUEUE_NAMES, type LogoImageProcessingPayload } from "../types";
import { assertTenantUser, log } from "./_validate";

/**
 * logo-image-processing — generate webp/png variants from uploaded branding logo.
 * DECISIONS_LOG: "LOCKED: Jobs + Queues" (logo image processing).
 * Real impl uses sharp; Phase 5 wires it.
 */
export function createLogoImageProcessingWorker(): Worker<LogoImageProcessingPayload> {
  return new Worker<LogoImageProcessingPayload>(
    QUEUE_NAMES.logoImageProcessing,
    async (job: Job<LogoImageProcessingPayload>) => {
      assertTenantUser(job.data);
      log("info", "logo-image-processing start", {
        jobId: job.id,
        tenantId: job.data.tenantId,
        sourceKey: job.data.sourceKey,
        variantCount: job.data.variants.length,
      });
      // TODO Phase 5: download source from S3 → sharp resize → upload variants.
      return { status: "stub", variantsGenerated: 0 };
    },
    {
      connection: createWorkerConnection(),
      concurrency: 4,
      lockDuration: 120_000,
    }
  );
}
