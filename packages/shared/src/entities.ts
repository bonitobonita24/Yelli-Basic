// Domain entity types — derived verbatim from docs/PRODUCT.md "Data Entities".
//
// Timestamps are `Date` (Prisma DateTime runtime shape; survives tRPC transport
// via superjson). The Phase 3.3 prototype used ISO strings at its sim boundary;
// the production swap (W1-W4) consumes Prisma rows directly, so `Date` is the
// production contract. The 8 domain models below map 1:1 to the Prisma schema
// authored in S2; Auth.js v5 owns Session / VerificationToken / Account separately.

import type {
  AuditTargetType,
  CallEndReason,
  CallRole,
  ExportJobStatus,
  UserRole,
} from './enums.js';
import type { AuditAction } from './audit.js';

/** Tenant — one per Cloud org; one implicit `slug="default"` row in LAN mode. */
export interface Tenant {
  id: string;
  slug: string;
  displayName: string; // <= 40 chars
  logoUrl: string | null; // S3/MinIO path
  isSuspended: boolean;
  /** Argon2id hash — populated only in LAN anonymous mode (null in Cloud / LAN account mode). */
  adminPassphraseHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  tenantId: string;
  email: string; // unique within tenant
  emailVerifiedAt: Date | null;
  passwordHash: string; // Argon2id via Auth.js v5
  displayName: string; // <= 24 chars
  role: UserRole;
  isSuspended: boolean;
  /** Incremented on role/tenant/status/password change; Auth.js session() callback
   *  invalidates the session when the JWT-embedded version differs (security.md §AUTH #6). */
  securityVersion: number;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface Device {
  id: string;
  tenantId: string;
  userId: string | null; // null in LAN anonymous mode
  displayName: string; // <= 24 chars; locked after first set when global rename-lock is ON
  callRole: CallRole; // admin-assigned only; default `receiver`
  browserFingerprint: string; // client-generated, persisted to localStorage
  assignedRoleAt: Date | null;
  lastSeenAt: Date;
  archivedAt: Date | null; // set when device is 90 days offline
  createdAt: Date;
}

export interface Invitation {
  id: string;
  tenantId: string;
  invitedByUserId: string;
  email: string; // invitee
  tokenHash: string; // one-way hash; raw token only in the email
  expiresAt: Date; // 7 days from creation
  acceptedAt: Date | null;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  tenantId: string | null; // null for super-admin actions
  actorUserId: string | null; // null for system events (e.g. device.first_join)
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string | null; // null for targetless events (LOCKED: AuditLog.targetId nullability)
  payload: Record<string, unknown>; // minimal context, no sensitive data
  createdAt: Date;
}

export interface CallSession {
  id: string;
  tenantId: string;
  callerDeviceId: string;
  calleeDeviceId: string;
  callerRoleAtCall: CallRole; // snapshot at invite time
  calleeRoleAtCall: CallRole; // snapshot at invite time
  startedAt: Date; // when ringing began
  connectedAt: Date | null; // null if never connected
  endedAt: Date | null;
  durationSec: number | null; // computed; null until ended
  endReason: CallEndReason | null;
}

export interface WebPushSubscription {
  id: string;
  tenantId: string | null; // null for LAN anon
  userId: string | null; // null for LAN anon
  deviceId: string;
  endpoint: string; // Web Push endpoint URL
  p256dh: string;
  auth: string;
  expiresAt: Date | null;
  createdAt: Date;
  lastUsedAt: Date;
}

export interface ExportJob {
  id: string;
  tenantId: string;
  requestedByUserId: string | null;
  status: ExportJobStatus;
  requestedAt: Date;
  readyAt: Date | null;
  expiresAt: Date | null; // signed URL TTL (24h)
  signedUrl: string | null;
  downloadedAt: Date | null;
  payloadBytes: number | null;
}
