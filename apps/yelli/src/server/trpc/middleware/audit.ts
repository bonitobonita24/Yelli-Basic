import { middleware } from '../trpc';

/**
 * L5 immutable AuditLog (chain step). Skeleton: the Wire session writes audit
 * rows on mutation success via `writeAuditLog()` from @yelli/db, using the
 * §11-canonical action vocabulary from @yelli/shared (member.* / device.* /
 * tenant.* / auth.* / superadmin.* / lan.* / pwa.*).
 */
export const auditMiddleware = middleware(async ({ next }) => {
  // TODO (Wire): on mutation success, writeAuditLog({ tenantId, userId, action, ... }).
  return next();
});
