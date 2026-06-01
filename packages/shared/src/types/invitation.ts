export interface Invitation {
  id: string;
  tenantId: string;
  invitedByUserId: string;
  email: string;
  tokenHash: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}
