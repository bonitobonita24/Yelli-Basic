import { z } from "zod";
import { RoleSchema } from "./enums.js";

export const UserEntitySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  email: z.string().email(),
  emailVerifiedAt: z.date().nullable(),
  passwordHash: z.string(),
  displayName: z.string().max(24),
  role: RoleSchema,
  isSuspended: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastLoginAt: z.date().nullable(),
});

export type UserEntity = z.infer<typeof UserEntitySchema>;
