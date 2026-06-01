import { z } from "zod";
import { AuditActionSchema, AuditTargetTypeSchema, JsonValueSchema } from "./enums.js";

export const AuditLogEntitySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid().nullable(),
  actorUserId: z.string().uuid().nullable(),
  action: AuditActionSchema,
  targetType: AuditTargetTypeSchema,
  targetId: z.string().uuid(),
  payload: JsonValueSchema,
  createdAt: z.date(),
});

export type AuditLogEntity = z.infer<typeof AuditLogEntitySchema>;
