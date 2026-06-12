import { Prisma, prisma } from '@yelli/db';
import type { AuditAction } from '@yelli/shared';

import { middleware } from '../trpc';

/**
 * Mirror of the schema enum (AuditTargetType). Prisma enums are plain string
 * unions, so a value typed against this local copy is assignable to the generated
 * `targetType` field — and keeping it local avoids importing the generated enum.
 */
type AuditTargetType = 'User' | 'Tenant' | 'Invitation' | 'Device' | 'ExportJob';

/**
 * Request-scoped audit recorder injected onto ctx by the L5 audit middleware.
 * The §11-canonical `action` is supplied verbatim by the caller (HARD CONSTRAINT —
 * @yelli/shared AUDIT_ACTIONS); the recorder binds tenantId + actorUserId from the
 * authenticated session so call-sites can't get them wrong.
 */
export type RecordAudit = (
  action: AuditAction,
  target: { type: AuditTargetType; id?: string | null },
  payload?: Prisma.InputJsonValue,
) => Promise<void>;

/**
 * L5 immutable AuditLog (chain step 5 — runs after auth + tenant-scope, so the
 * session identity is resolved). It does NOT auto-write a generic row: the
 * §11-canonical action string is procedure-specific and the row must be atomic
 * with its mutation, so the established pattern (W1a/W2a/W3) is a per-procedure
 * write. Instead the middleware INJECTS a tenant+actor-bound `recordAudit` helper
 * onto ctx for every protected call — the sanctioned write path that mutations use
 * (brand.update is the first adopter). AuditLog is excluded from the L6 guard, so
 * the recorder writes through the base client with tenantId passed explicitly.
 */
export const auditMiddleware = middleware(async ({ ctx, next }) => {
  const actorUserId = ctx.session?.user?.id ?? null;
  const tenantId = ctx.session?.user?.tenantId ?? null;

  const recordAudit: RecordAudit = async (action, target, payload) => {
    await prisma.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action,
        targetType: target.type,
        targetId: target.id ?? null,
        ...(payload !== undefined ? { payload } : {}),
      },
    });
  };

  return next({ ctx: { recordAudit } });
});
