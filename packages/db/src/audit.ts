import { Prisma, type PrismaClient } from '@prisma/client';
import type { AuditTargetType } from '@prisma/client';

/**
 * L5 — Immutable AuditLog write helper.
 * Always active in single AND multi tenancy modes (Rule 7B).
 *
 * `action` is one of the 29 §11-canonical AuditAction strings defined in
 * @yelli/shared AUDIT_ACTIONS (e.g. "device.role.assign", "call.start",
 * "lan.admin.login.success"). Stored as String because Prisma enums reject
 * dot-separated values.
 *
 * `tenantId` and `targetId` are nullable to permit platform-level superadmin
 * actions and targetless events (e.g. "lan.admin.login.success", "pwa.install").
 *
 * Pass either a transaction client (preferred — keeps the audit write in the same
 * tx as the mutation it records) or a raw PrismaClient.
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
  entry: AuditEntry,
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
