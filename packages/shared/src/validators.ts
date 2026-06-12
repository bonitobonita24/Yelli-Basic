// Zod validators — single source of validation truth shared by tRPC procedures
// (server) and React Hook Form (client). Rules derived verbatim from
// docs/PRODUCT.md "Tenant slug rules" + "Data Entities" field constraints.

import { z } from 'zod';
import {
  CALL_END_REASONS,
  CALL_ROLES,
  EDITIONS,
  EXPORT_JOB_STATUSES,
  USER_ROLES,
  type CallEndReason,
  type CallRole,
  type Edition,
  type ExportJobStatus,
  type UserRole,
} from './enums';
import { AUDIT_ACTIONS, type AuditAction } from './audit';
import { isReservedSlug } from './config/reserved-slugs';

// ── Enum schemas ────────────────────────────────────────────────────────────
export const editionSchema = z.enum([...EDITIONS] as [Edition, ...Edition[]]);
export const callRoleSchema = z.enum([...CALL_ROLES] as [CallRole, ...CallRole[]]);
export const userRoleSchema = z.enum([...USER_ROLES] as [UserRole, ...UserRole[]]);
export const callEndReasonSchema = z.enum([...CALL_END_REASONS] as [
  CallEndReason,
  ...CallEndReason[],
]);
export const exportJobStatusSchema = z.enum([...EXPORT_JOB_STATUSES] as [
  ExportJobStatus,
  ...ExportJobStatus[],
]);
export const auditActionSchema = z.enum([...AUDIT_ACTIONS] as [AuditAction, ...AuditAction[]]);

// ── Tenant slug (Cloud signup) ──────────────────────────────────────────────
// 3–30 chars, lowercase letters/digits/hyphens, starts with a letter, ends with
// an alphanumeric, no consecutive hyphens, not reserved. Server-side authority;
// the reserved/taken rejection is generic ("slug unavailable") per V25
// anti-enumeration.
export const tenantSlugSchema = z
  .string()
  .trim()
  .min(3, 'Slug must be at least 3 characters')
  .max(30, 'Slug must be at most 30 characters')
  .regex(/^[a-z][a-z0-9-]*[a-z0-9]$/, 'slug unavailable')
  .refine((s) => !s.includes('--'), 'slug unavailable')
  .refine((s) => !isReservedSlug(s), 'slug unavailable');

// ── Display names (PRODUCT.md length caps) ──────────────────────────────────
export const tenantDisplayNameSchema = z.string().trim().min(1).max(40);
export const userDisplayNameSchema = z.string().trim().min(1).max(24);
export const deviceDisplayNameSchema = z.string().trim().min(1).max(24);

// ── Email ───────────────────────────────────────────────────────────────────
export const emailSchema = z.string().trim().toLowerCase().email();

// ── Browser fingerprint (client-generated device identity) ──────────────────
export const browserFingerprintSchema = z.string().trim().min(8).max(256);

// ── Idempotency key (offline replay queue — UUIDv7) ─────────────────────────
export const idempotencyKeySchema = z.string().uuid();
