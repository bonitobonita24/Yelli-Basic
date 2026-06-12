import { TRPCError } from '@trpc/server';

import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

/**
 * Invitations router — member invite / verify / reset flows (create invite, accept,
 * revoke). Real procedures land in the accounts-auth Wire session. Placeholder
 * keeps the router shape.
 */
export const invitationsRouter = router({
  _placeholder: protectedProcedure.query(() => {
    throw new TRPCError({ code: 'NOT_IMPLEMENTED' });
  }),
});
