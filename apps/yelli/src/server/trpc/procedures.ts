import { auditMiddleware } from './middleware/audit';
import { authMiddleware } from './middleware/auth';
import { errorMiddleware } from './middleware/error';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { tenantScopeMiddleware } from './middleware/tenant-scope';
import { baseProcedure } from './trpc';

/**
 * Procedure tiers. The protected tier composes the LOCKED 5-step tRPC middleware
 * chain (DL: tRPC Middleware Chain):
 *   error (envelope) → rate-limit → auth (requireSession/requireFreshAccount)
 *   → tenant-scope (requireTenantMatch + L1/L6) → audit (L5).
 * Super-Admin (`_pwbt`) uses a separate isolated chain + unguarded client — added
 * in the Wire session, never an inline if/else inside a tenant-scoped resolver.
 */
export const publicProcedure = baseProcedure.use(errorMiddleware).use(rateLimitMiddleware);

export const protectedProcedure = publicProcedure
  .use(authMiddleware)
  .use(tenantScopeMiddleware)
  .use(auditMiddleware);
