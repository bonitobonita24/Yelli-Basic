import { TRPCError } from '@trpc/server';

import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

/**
 * Brand router — tenant branding (display name + logo upload/processing via the
 * logo-image job + packages/storage MIME whitelist). Real procedures land in the
 * branding Wire session. Placeholder keeps the router shape.
 */
export const brandRouter = router({
  _placeholder: protectedProcedure.query(() => {
    throw new TRPCError({ code: 'NOT_IMPLEMENTED' });
  }),
});
