import { TRPCError } from "@trpc/server";
import { middleware } from "../trpc";

/**
 * V28 / security.md Auth Defaults #6 — session freshness check.
 *
 * The Auth.js v5 session() callback (src/server/auth/config.ts) already re-reads
 * User.securityVersion + isSuspended on every session lookup and blanks out the
 * session.user on stale values. This middleware is the second line of defense:
 *   - If we got here with no session.user → caller skipped protectedProcedure (bug).
 *   - If securityVersion is missing entirely → JWT was minted before V28 rollout.
 *
 * Phase 7 TODO: front this with a 30s Valkey cache keyed by sessionId to avoid
 * the DB hit on every request (locked in DECISIONS_LOG.md "tRPC Middleware Chain"
 * step 2 "requireFreshAccount via 30s Valkey cache"). For now, the session()
 * callback already does the DB read once per session lookup.
 */
export function requireFreshAccount() {
  return middleware(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in required." });
    }
    if (typeof ctx.session.user.securityVersion !== "number") {
      // JWT was minted before V28 added the field → force re-auth.
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in required." });
    }
    return next();
  });
}
