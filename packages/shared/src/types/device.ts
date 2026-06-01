import type { CallRole } from "./enums";

export interface Device {
  id: string;
  tenantId: string;
  userId: string | null;
  displayName: string;
  callRole: CallRole;
  browserFingerprint: string;
  assignedRoleAt: Date | null;
  lastSeenAt: Date;
  archivedAt: Date | null;
  createdAt: Date;
}
