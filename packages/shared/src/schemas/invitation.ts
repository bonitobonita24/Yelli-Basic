import { z } from "zod";

export const InvitationEntitySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  invitedByUserId: z.string().uuid(),
  email: z.string().email(),
  tokenHash: z.string(),
  expiresAt: z.date(),
  acceptedAt: z.date().nullable(),
  createdAt: z.date(),
});

export type InvitationEntity = z.infer<typeof InvitationEntitySchema>;
