import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { type Prisma, AuditTargetType, writeAuditLog } from "@yelli/db";
import { platformPrisma } from "@/server/lib/platform-prisma";
import { router, protectedProcedure } from "../trpc";
import { requireSuperAdmin } from "../middleware/rbac";
import { rateLimit } from "../middleware/rate-limit-mw";

/**
 * Super-Admin platform router.
 *
 * Locked invariants (DECISIONS_LOG):
 *   - tenant.slug === "_pwbt" identifies super-admin (per "Platform tenant slug — _pwbt")
 *   - Uses dedicated platformPrisma (NO tenant-guard extension) per "tRPC Middleware Chain"
 *   - All actions prefixed "PLATFORM:" in AuditLog per security.md Superadmin rule #2
 *   - Generic NOT_FOUND on auth failure to avoid revealing this router exists
 *
 * Procedures:
 *   listTenants      — paginated list of all tenants (id, slug, displayName, isSuspended, createdAt)
 *   getTenant        — single tenant detail
 *   suspendTenant    — set tenant.isSuspended = true
 *   unsuspendTenant  — set tenant.isSuspended = false
 *   importTenant     — TODO Phase 7: LAN→Cloud bundle import (scripts/export-lan-tenant.sh + /_pwbt/import)
 */

const superAdminBase = protectedProcedure
  .use(requireSuperAdmin())
  .use(rateLimit("api"));

// Helper: every platform mutation writes an AuditLog with PLATFORM: prefix.
async function logPlatformAction(opts: {
  actorUserId: string;
  action: string; // already prefixed "PLATFORM:"
  targetType: AuditTargetType;
  targetId: string | null;
  payload?: Record<string, unknown>;
}) {
  await writeAuditLog(platformPrisma, {
    tenantId: null, // platform-level rows have no tenant
    actorUserId: opts.actorUserId,
    action: opts.action,
    targetType: opts.targetType,
    targetId: opts.targetId,
    ...(opts.payload
      ? { payload: opts.payload as Prisma.InputJsonValue }
      : {}),
  });
}

export const platformRouter = router({
  listTenants: superAdminBase
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const items = await platformPrisma.tenant.findMany({
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          slug: true,
          displayName: true,
          isSuspended: true,
          createdAt: true,
        },
      });
      const hasMore = items.length > input.limit;
      const trimmed = hasMore ? items.slice(0, input.limit) : items;
      const last = trimmed[trimmed.length - 1];
      return {
        items: trimmed,
        nextCursor: hasMore && last ? last.id : null,
      };
    }),

  getTenant: superAdminBase
    .input(z.object({ tenantId: z.string() }))
    .query(async ({ input }) => {
      const tenant = await platformPrisma.tenant.findUnique({
        where: { id: input.tenantId },
        select: {
          id: true,
          slug: true,
          displayName: true,
          logoUrl: true,
          isSuspended: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { users: true, devices: true } },
        },
      });
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND" });
      return tenant;
    }),

  suspendTenant: superAdminBase
    .input(z.object({ tenantId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await platformPrisma.tenant.update({
        where: { id: input.tenantId },
        data: { isSuspended: true },
        select: { id: true, slug: true, isSuspended: true },
      });
      await logPlatformAction({
        actorUserId: ctx.session!.user.id,
        action: "PLATFORM:tenant.suspend",
        targetType: AuditTargetType.Tenant,
        targetId: updated.id,
        payload: { slug: updated.slug },
      });
      return updated;
    }),

  unsuspendTenant: superAdminBase
    .input(z.object({ tenantId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await platformPrisma.tenant.update({
        where: { id: input.tenantId },
        data: { isSuspended: false },
        select: { id: true, slug: true, isSuspended: true },
      });
      await logPlatformAction({
        actorUserId: ctx.session!.user.id,
        action: "PLATFORM:tenant.unsuspend",
        targetType: AuditTargetType.Tenant,
        targetId: updated.id,
        payload: { slug: updated.slug },
      });
      return updated;
    }),

  importTenant: superAdminBase
    .input(
      z.object({
        bundle: z.string(), // base64 JSON bundle — schema TBD
        assumeSlug: z
          .string()
          .regex(/^[a-z][a-z0-9-]*[a-z0-9]$/)
          .min(3)
          .max(30),
      }),
    )
    .mutation(async () => {
      // TODO Phase 7: implement LAN→Cloud import per LOCKED LAN → Cloud Migration.
      // - Validate bundle signature
      // - Single Prisma transaction: tenant + users + devices + branding + auditLog
      // - V25 cross-checks throughout
      // - Audit: PLATFORM:tenant.import
      throw new TRPCError({
        code: "NOT_IMPLEMENTED" as never,
        message: "LAN tenant import not yet implemented (Phase 7).",
      });
    }),
});
