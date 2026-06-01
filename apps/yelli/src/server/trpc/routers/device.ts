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

export const deviceRouter = router({
  /**
   * Registers a new device for the current user in this tenant.
   * Default callRole is "both" per Prisma schema default (LOCKED Calling Model).
   * Rate-limited. Audited.
   */
  register: protectedProcedure
    .use(requireTenant())
    .use(rateLimit("api"))
    .use(withAudit("device.register", AuditTargetType.Device))
    .input(
      z.object({
        displayName: z
          .string()
          .min(1, "Device name must be at least 1 character")
          .max(40, "Device name must be at most 40 characters"),
        fingerprint: z
          .string()
          .min(16, "Fingerprint too short")
          .max(128, "Fingerprint too long"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sanitizedDisplayName = sanitizePlainText(input.displayName);

      const device = await prisma.device.create({
        data: {
          tenantId: ctx.session!.user!.tenantId,
          userId: ctx.session!.user!.id,
          displayName: sanitizedDisplayName,
          browserFingerprint: input.fingerprint,
          // callRole defaults to "both" per schema @default (LOCKED Calling Model)
        },
        select: {
          id: true,
          tenantId: true,
          userId: true,
          displayName: true,
          callRole: true,
          browserFingerprint: true,
          archivedAt: true,
          createdAt: true,
        },
      });

      return device;
    }),

  /**
   * Lists non-archived devices for the current tenant.
   * Paginated (cursor-based).
   */
  list: protectedProcedure
    .use(requireTenant())
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor } = input;

      const items = await prisma.device.findMany({
        where: {
          tenantId: ctx.session!.user!.tenantId,
          archivedAt: null,
        },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userId: true,
          displayName: true,
          callRole: true,
          lastSeenAt: true,
          createdAt: true,
        },
      });

      let nextCursor: string | undefined;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.id;
      }

      return { items, nextCursor };
    }),

  /**
   * Archives a device (soft-delete). Requires admin.
   * Defense-in-depth: verifies device belongs to tenant before update.
   * Rate-limited. Audited.
   */
  archive: protectedProcedure
    .use(requireTenant())
    .use(requireRole("admin"))
    .use(rateLimit("api"))
    .use(withAudit("device.archive", AuditTargetType.Device))
    .input(z.object({ deviceId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.device.findFirst({
        where: {
          id: input.deviceId,
          tenantId: ctx.session!.user!.tenantId,
        },
        select: { id: true, archivedAt: true },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Device not found." });
      }

      if (existing.archivedAt !== null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Device is already archived.",
        });
      }

      const updated = await prisma.device.update({
        where: {
          id: input.deviceId,
          tenantId: ctx.session!.user!.tenantId,
        },
        data: { archivedAt: new Date() },
        select: { id: true, archivedAt: true },
      });

      return updated;
    }),

  /**
   * Unarchives a device. Requires admin.
   * Rate-limited. Audited.
   * TODO Phase 7: orphan check — if ownerUser was hard-deleted during archival,
   *   block unarchive and require admin to reassign device to a valid user
   *   (LOCKED Device Lifecycle — Step 4).
   */
  unarchive: protectedProcedure
    .use(requireTenant())
    .use(requireRole("admin"))
    .use(rateLimit("api"))
    .use(withAudit("device.unarchive", AuditTargetType.Device))
    .input(z.object({ deviceId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.device.findFirst({
        where: {
          id: input.deviceId,
          tenantId: ctx.session!.user!.tenantId,
        },
        select: { id: true, archivedAt: true, userId: true },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Device not found." });
      }

      if (existing.archivedAt === null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Device is not archived.",
        });
      }

      const updated = await prisma.device.update({
        where: {
          id: input.deviceId,
          tenantId: ctx.session!.user!.tenantId,
        },
        data: { archivedAt: null },
        select: { id: true, archivedAt: true, callRole: true },
      });

      return updated;
    }),

  /**
   * Sets a device's callRole. Requires admin.
   * Rate-limited. Audited.
   * TODO Phase 7: publish role-change broadcast to Valkey pub/sub channel
   *   `tenant:{tenantId}:device-role` so connected WebSocket clients update
   *   their local role cache in real time (LOCKED Jobs + Queues — Step 5).
   */
  setCallRole: protectedProcedure
    .use(requireTenant())
    .use(requireRole("admin"))
    .use(rateLimit("api"))
    .use(withAudit("device.callRole.set", AuditTargetType.Device))
    .input(
      z.object({
        deviceId: z.string().min(1),
        callRole: z.enum(["caller", "receiver", "both"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Defense-in-depth: verify device belongs to tenant
      const existing = await prisma.device.findFirst({
        where: {
          id: input.deviceId,
          tenantId: ctx.session!.user!.tenantId,
        },
        select: { id: true },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Device not found." });
      }

      const updated = await prisma.device.update({
        where: {
          id: input.deviceId,
          tenantId: ctx.session!.user!.tenantId,
        },
        data: {
          callRole: input.callRole,
          assignedRoleAt: new Date(),
        },
        select: { id: true, callRole: true, assignedRoleAt: true },
      });

      return updated;
    }),
});
