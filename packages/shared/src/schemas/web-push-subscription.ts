import { z } from "zod";

export const WebPushSubscriptionEntitySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid().nullable(),
  userId: z.string().uuid().nullable(),
  deviceId: z.string().uuid(),
  endpoint: z.string().url(),
  p256dh: z.string(),
  auth: z.string(),
  expiresAt: z.date().nullable(),
  createdAt: z.date(),
  lastUsedAt: z.date(),
});

export type WebPushSubscriptionEntity = z.infer<typeof WebPushSubscriptionEntitySchema>;
