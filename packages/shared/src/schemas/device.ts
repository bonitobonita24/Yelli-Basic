import { z } from "zod";
import { CallRoleSchema } from "./enums";

export const DeviceEntitySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  displayName: z.string().max(24),
  callRole: CallRoleSchema,
  browserFingerprint: z.string(),
  assignedRoleAt: z.date().nullable(),
  lastSeenAt: z.date(),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
});

export type DeviceEntity = z.infer<typeof DeviceEntitySchema>;
