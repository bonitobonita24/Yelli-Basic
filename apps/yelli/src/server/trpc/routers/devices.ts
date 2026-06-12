import { TRPCError } from '@trpc/server';

import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

/**
 * Devices router — LAN device identity + lifecycle (register, list directory,
 * archive, assign call role). Real procedures land in W1 (Wire A). The placeholder
 * keeps the router shape + protectedProcedure wiring; replace it in the Wire session.
 */
export const devicesRouter = router({
  _placeholder: protectedProcedure.query(() => {
    throw new TRPCError({ code: 'NOT_IMPLEMENTED' });
  }),
});
