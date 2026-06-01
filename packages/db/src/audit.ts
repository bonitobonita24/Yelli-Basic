import { Prisma, type PrismaClient } from "@prisma/client";
import type { AuditTargetType } from "@prisma/client";

/**
 * L5 — Immutable AuditLog write helper.
 * Always active in single AND multi tenancy modes (Rule 7B).
 *
 * `action` is a string from the 25 LOCKED AuditAction values defined in
 * @yelli/shared (e.g. "member.invite", "device.role.assign", "lan.tenant.export").
 * Stored as String because Prisma enums reject dot-separated values.
 *
 * `tenantId` is nullable to permit platform-level superadmin actions
 * ("superadmin.tenant.suspend" etc.).
 *
 * Pass either a transaction client (preferred — keeps audit in same tx as the
 * mutation it records) or a raw PrismaClient.
 */
export type AuditEntry = {
  tenantId: string | null;
  actorUserId: string | null;
  action: string;
  targetType: AuditTargetType;
  targetId: string | null;
  payload?: Prisma.InputJsonValue;
};

export async function writeAuditLog(
  tx: Prisma.TransactionClient | PrismaClient,
  entry: AuditEntry
): Promise<void> {
  await tx.auditLog.create({
    data: {
      tenantId: entry.tenantId,
      actorUserId: entry.actorUserId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      payload: entry.payload ?? Prisma.JsonNull,
    },
  });
}
