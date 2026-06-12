import { middleware } from '../trpc';

/**
 * Production error handling (security.md): never leak internal details, stack
 * traces, or table names to the client. Skeleton: logs failures server-side; the
 * Wire session adds structured logging (GlitchTip/Sentry) + generic client-facing
 * messages via the tRPC errorFormatter.
 */
export const errorMiddleware = middleware(async ({ next }) => {
  const result = await next();
  if (!result.ok) {
    // TODO (Wire): structured server-side log of result.error (cause/stack) only.
  }
  return result;
});
