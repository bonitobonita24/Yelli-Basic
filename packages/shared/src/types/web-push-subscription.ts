export interface WebPushSubscription {
  id: string;
  tenantId: string | null;
  userId: string | null;
  deviceId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expiresAt: Date | null;
  createdAt: Date;
  lastUsedAt: Date;
}
