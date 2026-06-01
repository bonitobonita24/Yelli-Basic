import { LRUCache } from "lru-cache";
import { TRPCError } from "@trpc/server";

/**
 * In-memory rate limiter — single-instance dev/staging default.
 * For multi-instance prod: swap LRUCache for a Valkey-backed store
 * (same Limiter interface — Phase 7 transport swap, no API change).
 *
 * Tiers (locked in inputs.yml security.rate_limits + LOCKED CORS origin source):
 *   auth   — 10 req/min/IP   (login, register, reset, magic-link)
 *   api    — 120 req/min/user (authenticated tRPC procedures)
 *   public — 30 req/min/IP   (unauthenticated tRPC procedures)
 *   upload — 20 req/min/user (file upload endpoints)
 */

interface LimiterOptions {
  windowMs?: number;
  max?: number;
  uniqueTokens?: number;
}

interface Limiter {
  check: (token: string, limit?: number) => void;
}

function makeLimiter({ windowMs = 60_000, max = 60, uniqueTokens = 1000 }: LimiterOptions = {}): Limiter {
  const cache = new LRUCache<string, number[]>({
    max: uniqueTokens,
    ttl: windowMs,
  });
  return {
    check(token: string, limit?: number): void {
      const ceiling = limit ?? max;
      const now = Date.now();
      const cutoff = now - windowMs;
      const recent = (cache.get(token) ?? []).filter((t) => t > cutoff);
      if (recent.length >= ceiling) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Rate limit exceeded. Try again later.",
        });
      }
      recent.push(now);
      cache.set(token, recent);
    },
  };
}

export const rateLimiters: Record<"auth" | "api" | "public" | "upload", Limiter> = {
  auth: makeLimiter({ windowMs: 60_000, max: 10 }),
  api: makeLimiter({ windowMs: 60_000, max: 120 }),
  public: makeLimiter({ windowMs: 60_000, max: 30 }),
  upload: makeLimiter({ windowMs: 60_000, max: 20 }),
};

export type RateLimiterTier = keyof typeof rateLimiters;
