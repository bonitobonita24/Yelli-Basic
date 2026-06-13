import type { Job } from 'bullmq';
import { prisma } from '@yelli/db';
import { getSignedObjectUrl, putTenantExport } from '@yelli/storage';
import { assertTenantUser, log } from './_validate';
import { QUEUE_NAMES, type TenantExportJobData } from '../queues';

/** Signed-URL TTL — LOCKED 24h (Jobs + Queues [Step 5]; matches `tenant-exports/` bucket lifecycle). */
const EXPORT_URL_TTL_SECONDS = 24 * 60 * 60;

/**
 * tenant-export worker — Flow I (#15: GDPR/DPA tenant data export).
 *
 * Assembles a tenant-scoped JSON bundle (Tenant + Users + Devices + Invitations +
 * AuditLog + CallSession, all filtered by tenantId) → uploads it to S3/MinIO under
 * `exports/<tenantId>/<exportJobId>.json` via @yelli/storage (REUSING the provisioned
 * branding-upload creds — no new credential) → presigns a 24h GET URL with
 * @aws-sdk/s3-request-presigner → persists `signedUrl`/`expiresAt`/`payloadBytes` and
 * flips the ExportJob row to `ready` (Flow I admin export-list surfaces the link).
 *
 * Tenant scoping (security.md DB Safety #9): this worker runs on the base, UNGUARDED
 * PrismaClient outside the tRPC L6 request guard, so EVERY query is scoped to
 * `job.data.tenantId` explicitly — defense-in-depth IDOR isolation. Secret columns
 * (`User.passwordHash`, `Invitation.tokenHash`) are OMITTED — an export must never
 * carry credential material (security.md: no passwords/tokens in plaintext anywhere).
 *
 * Audit policy (W5b brief; device-archive / W5c / W5d precedent): structured-JSON
 * completion/failure logs ONLY — NO AuditLog row, NO AUDIT_ACTIONS vocab change. The
 * `tenant.export.requested` / `.ready` / `.downloaded` rows (already in AUDIT_ACTIONS)
 * are the router's concern at request/markDownloaded time; this worker is storage
 * infrastructure. Logs carry counts + the internal storage key only — NEVER the signed
 * URL or any PII.
 *
 * Failure: `ExportJobStatus` has no `failed` value, so on any throw the row stays
 * `processing` and BullMQ `attempts:3` + exponential backoff → DLQ (the host `failed`
 * listener is the surfaced signal); a re-request produces a fresh job.
 *
 * Delivery gap (surface, do not paper over — W5c verify/reset precedent): the LOCKED
 * `EmailJobData` has no `export` kind / URL field, so emailing the link would require
 * editing the LOCKED `queues.ts` + the email worker (out of W5b scope). The signed URL
 * is therefore delivered IN-APP via `ExportJob.signedUrl` (the column exists for exactly
 * this; Flow I's admin export list reads it). The PRODUCT.md "emails the link" leg is
 * deferred to a future export-email session.
 */
export async function processTenantExport(job: Job<TenantExportJobData>): Promise<void> {
  assertTenantUser(job.data);
  const { tenantId, exportJobId } = job.data;

  try {
    // 1. Load + claim the ExportJob row, scoped by {id, tenantId} (IDOR guard).
    const exportJob = await prisma.exportJob.findFirst({
      where: { id: exportJobId, tenantId },
      select: { id: true },
    });
    if (!exportJob) {
      // Row deleted / wrong tenant mid-flight → warn + no-op, no DLQ spam (device-archive precedent).
      log('warn', 'tenant-export: ExportJob not found for tenant — skipping', {
        queue: QUEUE_NAMES.tenantExport,
        jobId: job.id,
        tenantId,
        exportJobId,
      });
      return;
    }

    await prisma.exportJob.updateMany({
      where: { id: exportJobId, tenantId },
      data: { status: 'processing' },
    });

    // 2. Gather tenant-scoped data. Every query scoped by tenantId. Secret columns
    //    (User.passwordHash, Invitation.tokenHash) are excluded via explicit `select` —
    //    an export must never carry credential material (security.md: no passwords/tokens
    //    in plaintext anywhere).
    const [tenant, users, devices, invitations, auditLogs, callSessions] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.user.findMany({
        where: { tenantId },
        select: {
          id: true,
          tenantId: true,
          email: true,
          emailVerifiedAt: true,
          displayName: true,
          role: true,
          isSuspended: true,
          securityVersion: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.device.findMany({ where: { tenantId } }),
      prisma.invitation.findMany({
        where: { tenantId },
        select: {
          id: true,
          tenantId: true,
          invitedByUserId: true,
          email: true,
          expiresAt: true,
          acceptedAt: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } }),
      prisma.callSession.findMany({ where: { tenantId }, orderBy: { startedAt: 'asc' } }),
    ]);

    // 3. Build the JSON bundle.
    const counts = {
      users: users.length,
      devices: devices.length,
      invitations: invitations.length,
      auditLogs: auditLogs.length,
      callSessions: callSessions.length,
    };
    const bundle = {
      schemaVersion: 1,
      exportJobId,
      tenantId,
      generatedAt: new Date().toISOString(),
      tenant,
      users,
      devices,
      invitations,
      auditLogs,
      callSessions,
      counts,
    };
    const bytes = Buffer.from(JSON.stringify(bundle), 'utf8');

    // 4. Upload to S3/MinIO (reuses branding-upload storage creds — same bucket, exports/ prefix).
    const { key } = await putTenantExport({ tenantId, exportJobId, bytes });

    // 5. Presign a 24h GET URL (LOCKED signed-URL TTL).
    const signedUrl = await getSignedObjectUrl(key, EXPORT_URL_TTL_SECONDS);

    // 6. Flip the ExportJob row to `ready` + persist URL / expiry / size (scoped by {id, tenantId}).
    const now = Date.now();
    const updated = await prisma.exportJob.updateMany({
      where: { id: exportJobId, tenantId },
      data: {
        status: 'ready',
        readyAt: new Date(now),
        expiresAt: new Date(now + EXPORT_URL_TTL_SECONDS * 1000),
        signedUrl,
        payloadBytes: bytes.byteLength,
      },
    });
    if (updated.count === 0) {
      // Row vanished after upload — object is in storage but no row to point at it. Warn, no-op.
      log(
        'warn',
        'tenant-export: ExportJob vanished before ready update — object uploaded, row not updated',
        {
          queue: QUEUE_NAMES.tenantExport,
          jobId: job.id,
          tenantId,
          exportJobId,
          storageKey: key,
        },
      );
      return;
    }

    // Structured-JSON completion log ONLY — NO AuditLog (W5b audit policy). No signed URL / no PII.
    log('info', 'tenant-export complete', {
      queue: QUEUE_NAMES.tenantExport,
      jobId: job.id,
      tenantId,
      exportJobId,
      storageKey: key,
      payloadBytes: bytes.byteLength,
      ttlSeconds: EXPORT_URL_TTL_SECONDS,
      ...counts,
    });
  } catch (err) {
    // Emit the failure log (message only — never the URL or PII) then rethrow → DLQ
    // (W5c/W5d precedent). Row stays `processing`; ExportJobStatus has no `failed` value.
    log('error', 'tenant-export failed', {
      queue: QUEUE_NAMES.tenantExport,
      jobId: job.id,
      tenantId,
      exportJobId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
