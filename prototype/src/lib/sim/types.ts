// Simulated entity types — verbatim shapes from docs/PRODUCT.md.
// All timestamps are ISO 8601 strings; sim never exposes Date objects across the boundary.

export type Edition = 'lan' | 'cloud';

export type PrototypeMode = {
  edition: Edition;
  /** LAN can be anonymous or run in account-mode (multi-user with login). */
  lanAccountMode?: boolean;
};

export type CallRole = 'both' | 'caller' | 'receiver';

export type Device = {
  id: string;
  tenantId: string;
  userId: string | null;
  displayName: string;
  callRole: CallRole;
  browserFingerprint: string;
  assignedRoleAt: string | null;
  lastSeenAt: string;
  archivedAt: string | null;
  createdAt: string;
};

export type CallEndReason =
  | 'completed'
  | 'declined'
  | 'busy'
  | 'no-answer'
  | 'peer-disconnect'
  | 'ice-failed'
  | 'cancelled'
  | 'forbidden-by-role';

export type CallSession = {
  id: string;
  tenantId: string;
  callerDeviceId: string;
  calleeDeviceId: string;
  callerRoleAtCall: CallRole;
  calleeRoleAtCall: CallRole;
  startedAt: string;
  connectedAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  endReason: CallEndReason | null;
};

export type UserRole = 'admin' | 'member';

export type User = {
  id: string;
  tenantId: string;
  email: string;
  emailVerifiedAt: string | null;
  displayName: string;
  role: UserRole;
  isSuspended: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export type Tenant = {
  id: string;
  slug: string;
  displayName: string;
  logoUrl: string | null;
  isSuspended: boolean;
  /** Sim never stores a real hash — only the boolean flag. */
  hasAdminPassphrase: boolean;
  createdAt: string;
};

export type AdminSession = {
  tenantId: string;
  issuedAt: string;
};

export type Invitation = {
  id: string;
  tenantId: string;
  invitedByUserId: string;
  email: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

export type ExportJobStatus = 'queued' | 'processing' | 'ready' | 'expired';

export type ExportJob = {
  id: string;
  tenantId: string;
  requestedByUserId: string | null;
  status: ExportJobStatus;
  requestedAt: string;
  readyAt: string | null;
  expiresAt: string | null;
  signedUrl: string | null;
  downloadedAt: string | null;
  payloadBytes: number | null;
};

export type AuditLog = {
  id: string;
  tenantId: string | null;
  actorUserId: string | null;
  action: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

/** Table names — single source of truth for storage keys. */
export const TABLES = {
  devices: 'devices',
  callSessions: 'callSessions',
  users: 'users',
  tenants: 'tenants',
  invitations: 'invitations',
  auditLog: 'auditLog',
  adminSession: 'adminSession',
  tenantExports: 'tenantExports',
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];
