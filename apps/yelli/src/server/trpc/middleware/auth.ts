import { TRPCError } from '@trpc/server';

import { middleware } from '../trpc';

/**
 * requireSession + requireFreshAccount (chain steps 1-2). Account freshness
 * (securityVersion / isSuspended) is enforced in the Auth.js jwt callback on
 * every call (LOCKED V28). The 30s Valkey freshness cache lands in the Wire
 * session.
 */
export const authMiddleware = middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
  }
  return next({ ctx: { user: ctx.session.user } });
});
