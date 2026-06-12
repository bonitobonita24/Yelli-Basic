import { TRPCError } from '@trpc/server';

import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

/**
 * Audit router — read-only AuditLog view (paginated, tenant-scoped, filter by
 * action prefix). Real procedures land in the admin-console Wire session.
 * Placeholder keeps the router shape.
 */
export const auditRouter = router({
  _placeholder: protectedProcedure.query(() => {
    throw new TRPCError({ code: 'NOT_IMPLEMENTED' });
  }),
});
