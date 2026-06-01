import { z } from "zod";
// AuditTargetType not needed in this router (audit.list is read-only, no withAudit call)
import { prisma } from "@yelli/db";
import { router, protectedProcedure } from "../trpc";
import { requireRole } from "../middleware/rbac";
import { requireTenant } from "../middleware/tenant";

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const auditRouter = router({
  /**
   * Returns paginated audit log entries for the current tenant.
   * Admin-only. Ordered newest-first.
   *
   * PLATFORM: rows (action prefixed "PLATFORM:") are only visible when the
   * current tenant is _pwbt — tenantId scoping filters them for all others.
   */
  list: protectedProcedure
    .use(requireTenant())
    .use(requireRole("admin"))
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.string().optional(),
        /** Filter by action prefix, e.g. "call." or "tenant.branding." */
        actionPrefix: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.session!.user!.tenantId!;

      const items = await prisma.auditLog.findMany({
        where: {
          tenantId,
          ...(input.actionPrefix
            ? { action: { startsWith: input.actionPrefix } }
            : {}),
          ...(input.cursor ? { id: { lt: input.cursor } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        select: {
          id: true,
          action: true,
          targetType: true,
          targetId: true,
          actorUserId: true,
          payload: true,
          createdAt: true,
        },
      });

      const hasMore = items.length > input.limit;
      const page = hasMore ? items.slice(0, input.limit) : items;

      return {
        items: page,
        nextCursor: hasMore ? page[page.length - 1]?.id : undefined,
      };
    }),
});
