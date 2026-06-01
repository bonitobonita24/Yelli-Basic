import { TRPCError } from "@trpc/server";
import { middleware } from "../trpc";

type YelliRole = "admin" | "member";

/**
 * L3 RBAC role guard — always active (per security.md L3 + DECISIONS_LOG).
 * Use AFTER `protectedProcedure` so the session is guaranteed.
 *
 *   const updateBranding = protectedProcedure
 *     .use(requireRole("admin"))
 *     .input(...)
 *     .mutation(...)
 *
 * Super-admin distinction (DECISIONS_LOG "Platform tenant slug — _pwbt"):
 *   requireRole("admin") matches BOTH tenant admins AND super-admins
 *   (super-admin = role:"admin" + tenant.slug === "_pwbt"). The platform
 *   router (D9) layers a STRICTER check via requireSuperAdmin().
 */
export function requireRole(...allowed: YelliRole[]) {
  return middleware(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Sign in required.",
      });
    }
    if (!allowed.includes(ctx.session.user.role as YelliRole)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Access denied." });
    }
    return next();
  });
}

/**
 * Super-admin specific guard — used only by the platform router (D9).
 * Identifies super-admin by tenant.slug === "_pwbt" per the locked decision.
 */
export function requireSuperAdmin() {
  return middleware(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Sign in required.",
      });
    }
    if (
      ctx.session.user.tenantSlug !== "_pwbt" ||
      ctx.session.user.role !== "admin"
    ) {
      // Generic 404 — do not leak the existence of the platform router.
      throw new TRPCError({ code: "NOT_FOUND" });
    }
    return next();
  });
}
