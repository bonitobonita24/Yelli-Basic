import { TRPCError } from '@trpc/server';

import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

/**
 * Tenants router — tenancy + membership (members list, role promote/demote with
 * last-admin guard, transfer-admin, suspend, tenant.export). Real procedures land
 * in the tenancy-members Wire session. Placeholder keeps the router shape.
 */
export const tenantsRouter = router({
  _placeholder: protectedProcedure.query(() => {
    throw new TRPCError({ code: 'NOT_IMPLEMENTED' });
  }),
});
