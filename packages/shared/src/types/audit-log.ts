import type { AuditAction, AuditTargetType, JsonValue } from "./enums";

export interface AuditLog {
  id: string;
  tenantId: string | null;
  actorUserId: string | null;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  payload: JsonValue;
  createdAt: Date;
}
