import { TRPCError } from "@trpc/server";
import { middleware } from "../trpc";
import { rateLimiters, type RateLimiterTier } from "@/server/lib/rate-limit";

/**
 * Rate limit middleware factory. Pick a tier per procedure:
 *
 *   const loginProcedure = publicProcedure
 *     .use(rateLimit("auth"))
 *     .input(...)
 *     .mutation(...)
 *
 *   const listDevicesProcedure = protectedProcedure
 *     .use(rateLimit("api"))
 *     ...
 *
 * Token resolution:
 *   - "api" + "upload" tiers → keyed by session.user.id (per-user limits)
 *   - "auth" + "public" tiers → keyed by ip (per-IP limits — anonymous)
 *
 * If neither is available, falls back to the literal "unknown" bucket
 * (worst-case: shared bucket for all unidentified traffic).
 */
export function rateLimit(tier: RateLimiterTier) {
  return middleware(({ ctx, next }) => {
    let token: string;
    if (tier === "api" || tier === "upload") {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Sign in required.",
        });
      }
      token = `user:${userId}`;
    } else {
      token = `ip:${ctx.ip ?? "unknown"}`;
    }
    rateLimiters[tier].check(token);
    return next();
  });
}
