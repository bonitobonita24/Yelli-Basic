import { TRPCError } from '@trpc/server';

import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

/**
 * Users router — account profile + member directory (self profile, display name).
 * Real procedures land in the accounts-auth Wire session. Placeholder keeps the
 * router shape + protectedProcedure wiring.
 */
export const usersRouter = router({
  _placeholder: protectedProcedure.query(() => {
    throw new TRPCError({ code: 'NOT_IMPLEMENTED' });
  }),
});
