import type { BaseJobData } from '../queues';

/**
 * Centralized worker payload guard (LOCKED: Worker payload guard convention).
 *
 * EVERY @yelli/jobs worker imports `assertTenantUser` and calls it at the TOP of
 * its BullMQ processor — BEFORE any other logic — per security.md Queue Safety
 * rule 1+2 (tenantId + userId required on every job, validated server-side,
 * rejected if missing). Centralizing the guard prevents drift.
 */
export function assertTenantUser(data: unknown): asserts data is BaseJobData {
  const d = data as { tenantId?: unknown; userId?: unknown } | null;
  if (
    typeof d !== 'object' ||
    d === null ||
    typeof d.tenantId !== 'string' ||
    d.tenantId.length === 0 ||
    typeof d.userId !== 'string' ||
    d.userId.length === 0
  ) {
    throw new Error(
      'Invalid job payload: non-empty tenantId and userId are required (security.md Queue Safety).',
    );
  }
}

/**
 * Stricter guard for the whole-DB backup-cron worker (LOCKED exception).
 *
 * The backup worker operates on the ENTIRE database, not a single tenant, so it
 * must carry the platform system identity: tenantId === '_pwbt' && userId ===
 * 'system'. Any other payload is rejected.
 */
export function assertSystemJob(
  data: unknown,
): asserts data is { tenantId: '_pwbt'; userId: 'system' } {
  const d = data as { tenantId?: unknown; userId?: unknown } | null;
  if (typeof d !== 'object' || d === null || d.tenantId !== '_pwbt' || d.userId !== 'system') {
    throw new Error("Invalid system job payload: requires tenantId '_pwbt' + userId 'system'.");
  }
}

export type LogLevel = 'info' | 'warn' | 'error';

/**
 * Structured-JSON logger shared by all workers
 * (operations.observability.format = structured-json — LOCKED).
 */
export function log(level: LogLevel, msg: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ level, msg, ...fields });
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}
