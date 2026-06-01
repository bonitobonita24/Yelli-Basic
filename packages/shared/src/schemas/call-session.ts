import { z } from "zod";
import { CallRoleSchema, EndReasonSchema } from "./enums.js";

export const CallSessionEntitySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  callerDeviceId: z.string().uuid(),
  calleeDeviceId: z.string().uuid(),
  callerRoleAtCall: CallRoleSchema,
  calleeRoleAtCall: CallRoleSchema,
  startedAt: z.date(),
  connectedAt: z.date().nullable(),
  endedAt: z.date(),
  durationSec: z.number().int().nonnegative().nullable(),
  endReason: EndReasonSchema,
});

export type CallSessionEntity = z.infer<typeof CallSessionEntitySchema>;
