import { TRPCError } from "@trpc/server";
import { middleware } from "../trpc";

/**
 * L1 tenant guard — confirms the authenticated session carries tenantId.
 *
 * The V25 anti-tenant-switching cross-check (URL slug == session.tenantId) is
 * enforced at the Next.js middleware layer (src/middleware.ts, D10). This tRPC
 * middleware is the second line of defense: any authenticated procedure that
 * needs tenant scoping must use this middleware to surface tenantId onto ctx.
 *
 * Compose AFTER protectedProcedure (which guarantees session.user is non-null).
 *
 *   const listDevices = protectedProcedure
 *     .use(requireTenant())
 *     .query(({ ctx }) => prisma.device.findMany({ where: { tenantId: ctx.tenantId } }))
 */
export function requireTenant() {
  return middleware(({ ctx, next }) => {
    const tenantId = ctx.session?.user?.tenantId;
    if (!tenantId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Tenant context missing.",
      });
    }
    return next({
      ctx: {
        ...ctx,
        tenantId,
        tenantSlug: ctx.session?.user?.tenantSlug ?? null,
      },
    });
  });
}
