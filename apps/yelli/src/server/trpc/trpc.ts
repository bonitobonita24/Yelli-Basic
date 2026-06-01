import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { Session } from "@/server/auth/session";
import { getServerSession } from "@/server/auth/session";

/**
 * tRPC v11 root.
 * Context carries the (re-validated) Auth.js session, request headers, and
 * a derived client IP for rate limiting. Procedures compose from here:
 *
 *   publicProcedure    — no auth, rate-limited as "public"
 *   protectedProcedure — requires session.user, rate-limited as "api"
 *
 * Tenant + RBAC + audit are LAYERED on top via middleware/* (D6b).
 * Super-admin (_pwbt) router uses its own chain in routers/platform.ts (D9).
 */

export interface TRPCContext {
  session: Session | null;
  headers: Headers;
  ip: string | null;
}

interface CreateContextOptions {
  headers: Headers;
}

function extractIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

export async function createTRPCContext(
  opts: CreateContextOptions,
): Promise<TRPCContext> {
  const session = await getServerSession();
  return {
    session,
    headers: opts.headers,
    ip: extractIp(opts.headers),
  };
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const middleware = t.middleware;
export const procedure = t.procedure;

/**
 * Base public procedure — no auth, rate-limited as "public".
 * Use for: landing health checks, signup, Turnstile-protected login form
 * (the auth check happens INSIDE the procedure via signIn(), not via middleware).
 */
export const publicProcedure = t.procedure;

/**
 * Base protected procedure — requires a valid session.user (post-re-validation).
 * The session callback in auth/config.ts already blanks out user on stale
 * securityVersion / suspension → here we just gate.
 *
 * Tenant guard + RBAC + audit are added by composing middleware/* (D6b).
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in required." });
  }
  return next();
});
