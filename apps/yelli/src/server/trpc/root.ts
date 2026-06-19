import { auditRouter } from './routers/audit';
import { brandRouter } from './routers/brand';
import { breachRouter } from './routers/breach';
import { callRouter } from './routers/call';
import { devicesRouter } from './routers/devices';
import { dsrRouter } from './routers/dsr';
import { invitationsRouter } from './routers/invitations';
import { pushRouter } from './routers/push';
import { tenantsRouter } from './routers/tenants';
import { usersRouter } from './routers/users';
import { router } from './trpc';

/**
 * The merged AppRouter. NOTE the `calls` key (plural): tRPC v11 reserves `call`
 * as a router-builder key, so the call procedures are exposed as `appRouter.calls`
 * (LOCKED: tRPC AppRouter key for call procedures = `calls`). Client-side:
 * `trpc.calls.invite.useMutation()`.
 */
export const appRouter = router({
  devices: devicesRouter,
  users: usersRouter,
  calls: callRouter,
  tenants: tenantsRouter,
  invitations: invitationsRouter,
  audit: auditRouter,
  brand: brandRouter,
  push: pushRouter,
  // V32.9 compliance routers
  dsr: dsrRouter,
  breach: breachRouter,
});

export type AppRouter = typeof appRouter;
