import { router } from "./trpc";
import { tenantRouter } from "./routers/tenant";
import { userRouter } from "./routers/user";
import { deviceRouter } from "./routers/device";
import { callRouter } from "./routers/call";
import { brandingRouter } from "./routers/branding";
import { auditRouter } from "./routers/audit";
import { platformRouter } from "./routers/platform";

/**
 * Merged AppRouter — single source of truth for all server-side tRPC procedures.
 * Consumed by:
 *   - src/app/api/trpc/[trpc]/route.ts (HTTP handler — D10)
 *   - src/lib/trpc-client.ts (concrete-typed client)
 *   - packages/api-client (consumers pass AppRouter as the generic parameter)
 */
export const appRouter = router({
  tenant: tenantRouter,
  user: userRouter,
  device: deviceRouter,
  calls: callRouter,
  branding: brandingRouter,
  audit: auditRouter,
  platform: platformRouter,
});

export type AppRouter = typeof appRouter;
