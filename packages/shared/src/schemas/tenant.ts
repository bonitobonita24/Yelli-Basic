import { z } from "zod";
import { TenantSlugSchema } from "./tenant-slug";

export const TenantEntitySchema = z.object({
  id: z.string().uuid(),
  slug: TenantSlugSchema,
  displayName: z.string().max(40),
  logoUrl: z.string().nullable(),
  isSuspended: z.boolean(),
  adminPassphraseHash: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TenantEntity = z.infer<typeof TenantEntitySchema>;
