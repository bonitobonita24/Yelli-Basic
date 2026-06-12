// Domain enums — derived verbatim from docs/PRODUCT.md "Data Entities".
// Each is exposed as a readonly tuple (for runtime iteration / Zod) plus a
// derived union type. These are the contract for packages/db (S2), the tRPC
// routers (S4 + W1-W4), and the prototype-to-production swap.

/** Deployment edition. PRODUCT.md "Tenancy Model" — one codebase, two editions. */
export const EDITIONS = ['lan', 'cloud'] as const;
export type Edition = (typeof EDITIONS)[number];

/** Device.callRole — admin-assigned only; default `receiver` on first join. */
export const CALL_ROLES = ['both', 'caller', 'receiver'] as const;
export type CallRole = (typeof CALL_ROLES)[number];

/** User.role — account-level role within a tenant. */
export const USER_ROLES = ['admin', 'member'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** CallSession.endReason — PRODUCT.md CallSession entity. */
export const CALL_END_REASONS = [
  'completed',
  'declined',
  'busy',
  'no-answer',
  'peer-disconnect',
  'ice-failed',
  'cancelled',
  'forbidden-by-role',
] as const;
export type CallEndReason = (typeof CALL_END_REASONS)[number];

/** ExportJob lifecycle — PRODUCT.md tenant-export flow + prototype sim. */
export const EXPORT_JOB_STATUSES = ['queued', 'processing', 'ready', 'expired'] as const;
export type ExportJobStatus = (typeof EXPORT_JOB_STATUSES)[number];

/** AuditLog.targetType — PRODUCT.md AuditLog entity. */
export const AUDIT_TARGET_TYPES = ['User', 'Tenant', 'Invitation', 'Device', 'ExportJob'] as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];
