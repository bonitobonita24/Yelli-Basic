import { middleware } from '../trpc';

/**
 * Tiered rate limiting (inputs.yml security.rate_limiting):
 *   auth 10/min/ip · api 100/min/user · public 300/min/ip · upload 20/min/user.
 * Skeleton: the Wire session adds the Valkey token-bucket keyed by tier + caller
 * identity (IP for unauthenticated, userId for authenticated).
 */
export const rateLimitMiddleware = middleware(async ({ next }) => {
  // TODO (Wire): enforce the per-tier limit via Valkey before proceeding.
  return next();
});
