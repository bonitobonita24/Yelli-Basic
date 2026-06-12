import { TRPCError } from '@trpc/server';

import { prisma, tenantGuardExtension } from '@yelli/db';

import { middleware } from '../trpc';

/**
 * requireTenantMatch + L1/L6 scope (chain step 3). Derives tenantId from the
 * session and exposes an L6-guarded Prisma client (`db`) on ctx — every query
 * through it is auto-scoped to the tenant. The V25 `session.tenantId ===
 * URL.slug.tenantId` cross-check is enforced at the proxy layer; the Wire session
 * adds the resolver-level re-check + the Super-Admin (`_pwbt`) unguarded-client
 * branch (separate router, never inline here).
 */
export const tenantScopeMiddleware = middleware(async ({ ctx, next }) => {
  const user = ctx.session?.user;
  if (!user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
  }
  const tenantId = user.tenantId;
  const db = prisma.$extends(tenantGuardExtension(tenantId));
  return next({ ctx: { tenantId, db } });
});
