export type Role = "admin" | "member";

export type CallRole = "both" | "caller" | "receiver";

export type EndReason =
  | "completed"
  | "declined"
  | "busy"
  | "no-answer"
  | "peer-disconnect"
  | "ice-failed"
  | "cancelled"
  | "forbidden-by-role";

export type AuditTargetType =
  | "User"
  | "Tenant"
  | "Invitation"
  | "Device"
  | "ExportJob";

export type AuditAction =
  | "member.invite"
  | "member.suspend"
  | "member.remove"
  | "member.role.promote"
  | "member.role.demote"
  | "tenant.brand.update"
  | "tenant.suspend"
  | "tenant.export.request"
  | "tenant.export.complete"
  | "tenant.export.failed"
  | "device.first_join"
  | "device.role.assign"
  | "device.archive"
  | "device.unarchive"
  | "device.remove"
  | "auth.login.success"
  | "auth.login.fail"
  | "superadmin.tenant.suspend"
  | "superadmin.tenant.unsuspend"
  | "superadmin.tenant.import"
  | "lan.tenant.export"
  | "lan.admin.login.success"
  | "lan.admin.login.fail"
  | "lan.admin.passphrase.reset"
  | "pwa.install";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [k: string]: JsonValue }
  | JsonValue[];
