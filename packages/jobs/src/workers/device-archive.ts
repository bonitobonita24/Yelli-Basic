import type { Job } from 'bullmq';
import { prisma } from '@yelli/db';
import { assertTenantUser, log } from './_validate';
import { QUEUE_NAMES, type DeviceArchiveJobData } from '../queues';

/** Devices unseen for ≥ this many days are auto-archived (LOCKED 90-day offline threshold). */
const ARCHIVE_AFTER_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * device-archive worker — daily 03:00 UTC cron (LOCKED: Jobs + Queues [Step 5]).
 *
 * The scheduler enqueues ONE job per tenant (security.md Queue Safety cron rule:
 * cron jobs have no request/session/tenant context, so they MUST iterate tenants
 * explicitly and scope every query to a single tenantId). This processor therefore
 * scopes every query to `job.data.tenantId` explicitly — defense-in-depth, since it
 * runs on the base (unguarded) PrismaClient outside the tRPC L6 request guard.
 *
 * Behavior (Phase 3.3 `sim.repo.archive(olderThanDays)` SWAP BOUNDARY, PROTOTYPE.md
 * Flow G): set `archivedAt` on every device of this tenant that is not already
 * archived AND was last seen ≥ 90 days ago. When ≥1 device is archived, write a
 * SINGLE `device.archive.batch` AuditLog row — the Wave-9 mass-cron action, distinct
 * from the singular admin `device.archive` (PROTOTYPE.md §3 / @yelli/shared
 * AUDIT_ACTIONS, HARD CONSTRAINT) — with payload `{ count, olderThanDays }` (verbatim
 * sim shape, Audit View fidelity). actorUserId is null (system cron, no human actor).
 *
 * Auto-unarchive on reconnect is handled by the device register/heartbeat path
 * (devices router `unarchive`), NOT here.
 */
export async function processDeviceArchive(job: Job<DeviceArchiveJobData>): Promise<void> {
  assertTenantUser(job.data);
  const { tenantId } = job.data;
  const cutoff = new Date(Date.now() - ARCHIVE_AFTER_DAYS * DAY_MS);

  const archived = await prisma.$transaction(async (tx) => {
    const result = await tx.device.updateMany({
      where: { tenantId, archivedAt: null, lastSeenAt: { lt: cutoff } },
      data: { archivedAt: new Date() },
    });
    if (result.count === 0) return 0;
    // AuditLog is L6-guard-excluded → tenantId is passed explicitly (security.md #10).
    // Batch cron emit: actor null, target null (no single device), Wave-9 verbatim payload.
    await tx.auditLog.create({
      data: {
        tenantId,
        actorUserId: null,
        action: 'device.archive.batch',
        targetType: 'Device',
        targetId: null,
        payload: { count: result.count, olderThanDays: ARCHIVE_AFTER_DAYS },
      },
    });
    return result.count;
  });

  // Per-tenant audit trail (security.md cron rule 7: log each tenant iteration).
  log('info', 'device-archive sweep complete', {
    queue: QUEUE_NAMES.deviceArchive,
    jobId: job.id,
    tenantId,
    archived,
    olderThanDays: ARCHIVE_AFTER_DAYS,
  });
}
