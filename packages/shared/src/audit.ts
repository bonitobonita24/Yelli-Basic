// Audit action vocabulary — §11-canonical, locked.
//
// SOURCE OF TRUTH: docs/PROTOTYPE.md §3 "Audit Vocabulary (§11-canonical)" —
// the human-signed-off Phase 3.3 contract. PRODUCT.md "Data Entities" AuditLog
// enum (line ~204) is illustrative and `etc.`-terminated; PROTOTYPE.md §3 is the
// exhaustive, locked list. HARD CONSTRAINT (Phase 4 wire sessions W4 + W1/W2/W3):
// every tRPC procedure MUST emit one of these strings verbatim so the Audit View
// screen keeps working. Do NOT add, rename, or drop an entry without a
// DECISIONS_LOG entry + matching docs/PROTOTYPE.md §3 amendment.
//
// Convention: lowercase, dot-separated. `*.batch` suffix distinguishes server-side
// mass operations (cron) from singular admin actions (Wave 9: `device.archive` vs
// `device.archive.batch`).

export const AUDIT_ACTIONS = [
  // device.*
  'device.create',
  'device.first_join',
  'device.rename',
  'device.role.assign',
  'device.archive',
  'device.archive.batch',
  'device.unarchive',
  'device.delete',

  // call.*
  'call.start',
  'call.connected',
  'call.end',

  // invitation.*
  'invitation.create',
  'invitation.resend',
  'invitation.revoke',
  'invitation.accept',

  // user.*
  'user.create',
  'user.role.promote',
  'user.role.demote',
  'user.suspend',
  'user.delete',

  // tenant.*
  'tenant.create',
  'tenant.branding.update',
  'tenant.admin.passphrase.set',
  'tenant.export.requested',
  'tenant.export.ready',
  'tenant.export.downloaded',

  // lan.admin.*
  'lan.admin.login.success',
  'lan.admin.login.fail',
  'lan.admin.logout',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Runtime membership check against the locked vocabulary. */
export function isAuditAction(value: string): value is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(value);
}
