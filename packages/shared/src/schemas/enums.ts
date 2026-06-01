import { z } from "zod";
import type { JsonValue } from "../types/enums";

export const RoleSchema = z.enum(["admin", "member"]);

export const CallRoleSchema = z.enum(["both", "caller", "receiver"]);

export const EndReasonSchema = z.enum([
  "completed",
  "declined",
  "busy",
  "no-answer",
  "peer-disconnect",
  "ice-failed",
  "cancelled",
  "forbidden-by-role",
]);

export const AuditTargetTypeSchema = z.enum([
  "User",
  "Tenant",
  "Invitation",
  "Device",
  "ExportJob",
]);

export const AuditActionSchema = z.enum([
  "member.invite",
  "member.suspend",
  "member.remove",
  "member.role.promote",
  "member.role.demote",
  "tenant.brand.update",
  "tenant.suspend",
  "tenant.export.request",
  "tenant.export.complete",
  "tenant.export.failed",
  "device.first_join",
  "device.role.assign",
  "device.archive",
  "device.unarchive",
  "device.remove",
  "auth.login.success",
  "auth.login.fail",
  "superadmin.tenant.suspend",
  "superadmin.tenant.unsuspend",
  "superadmin.tenant.import",
  "lan.tenant.export",
  "lan.admin.login.success",
  "lan.admin.login.fail",
  "lan.admin.passphrase.reset",
  "pwa.install",
]);

// JsonValue is recursive — use z.lazy
export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.record(JsonValueSchema),
    z.array(JsonValueSchema),
  ]),
);
