import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { AuditTargetType } from "@prisma/client";
import { prisma } from "@yelli/db";
import { router, protectedProcedure } from "../trpc";
import { requireRole } from "../middleware/rbac";
import { requireTenant } from "../middleware/tenant";
import { rateLimit } from "../middleware/rate-limit-mw";
import { withAudit } from "../middleware/audit-log";
import { sanitizePlainText } from "@/server/lib/sanitize";

export const tenantRouter = router({
  /**
   * Returns the caller's current tenant.
   * Requires: authenticated session + resolved tenant context.
   */
  me: protectedProcedure
    .use(requireTenant())
    .query(async ({ ctx }) => {
      // After requireTenant(), ctx.session.user is guaranteed non-null
      const tenant = await prisma.tenant.findUniqueOrThrow({
        where: { id: ctx.session!.user!.tenantId },
        select: {
          id: true,
          slug: true,
          displayName: true,
          logoUrl: true,
          isSuspended: true,
        },
      });
      return tenant;
    }),

  /**
   * Updates tenant display name.
   * Requires: admin role. Rate-limited. Audited.
   */
  update: protectedProcedure
    .use(requireTenant())
    .use(requireRole("admin"))
    .use(rateLimit("api"))
    .use(withAudit("tenant.update", AuditTargetType.Tenant))
    .input(
      z.object({
        displayName: z
          .string()
          .min(1, "Display name must be at least 1 character")
          .max(60, "Display name must be at most 60 characters")
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.displayName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No fields provided for update.",
        });
      }

      const tenantId = ctx.session!.user!.tenantId;
      const sanitizedDisplayName = sanitizePlainText(input.displayName);

      await prisma.tenant.update({
        where: { id: tenantId },
        data: { displayName: sanitizedDisplayName },
      });

      // Re-fetch for return value (defensive — avoids returning stale data)
      const updated = await prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: {
          id: true,
          slug: true,
          displayName: true,
          logoUrl: true,
          isSuspended: true,
        },
      });

      return updated;
    }),
});
