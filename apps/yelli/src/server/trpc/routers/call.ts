import { TRPCError } from '@trpc/server';

import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

/**
 * Call router — WebRTC signaling surface (invite, accept, reject, end + role
 * guard). Real procedures land in the calling Wire session. Exported as
 * `callRouter`; merged into the AppRouter under the key `calls` (plural) per
 * LOCKED: tRPC AppRouter key for call procedures = `calls` (tRPC v11 reserves
 * `call` as a router-builder key). Placeholder keeps the router shape.
 */
export const callRouter = router({
  _placeholder: protectedProcedure.query(() => {
    throw new TRPCError({ code: 'NOT_IMPLEMENTED' });
  }),
});
