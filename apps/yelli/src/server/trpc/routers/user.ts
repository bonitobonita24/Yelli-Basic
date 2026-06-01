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

export const userRouter = router({
  /**
   * Returns the current authenticated user's profile.
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: ctx.session!.user!.id },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        tenantId: true,
        isSuspended: true,
      },
    });
    return user;
  }),

  /**
   * Updates the current user's own display name.
   * Rate-limited. Audited.
   */
  update: protectedProcedure
    .use(rateLimit("api"))
    .use(withAudit("user.update", AuditTargetType.User))
    .input(
      z.object({
        displayName: z
          .string()
          .min(1, "Display name must be at least 1 character")
          .max(80, "Display name must be at most 80 characters")
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

      const sanitized = sanitizePlainText(input.displayName);

      const updated = await prisma.user.update({
        where: { id: ctx.session!.user!.id },
        data: { displayName: sanitized },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          tenantId: true,
          isSuspended: true,
        },
      });

      return updated;
    }),

  /**
   * Lists paginated members of the current tenant.
   * Requires: admin role.
   */
  list: protectedProcedure
    .use(requireTenant())
    .use(requireRole("admin"))
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor } = input;

      const items = await prisma.user.findMany({
        where: { tenantId: ctx.session!.user!.tenantId },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          isSuspended: true,
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
   * Sets a user's role within the current tenant.
   * Requires: admin role. Enforces last-admin guard and self-demotion block.
   * Rate-limited. Audited.
   * TODO Phase 7: publish `session.invalidate` to Valkey pub/sub for 30s SLO
   *   (LOCKED Jobs + Queues — Step 5 WebSocket+Valkey role broadcast).
   */
  roleSet: protectedProcedure
    .use(requireTenant())
    .use(requireRole("admin"))
    .use(rateLimit("api"))
    .use(withAudit("user.role.set", AuditTargetType.User))
    .input(
      z.object({
        userId: z.string().min(1),
        role: z.enum(["admin", "member"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { userId, role } = input;
      const tenantId = ctx.session!.user!.tenantId;

      // Block self-demotion
      if (userId === ctx.session!.user!.id && role === "member") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "You cannot demote yourself. Transfer admin to another user first.",
        });
      }

      const updated = await prisma.$transaction(async (tx) => {
        // Last-admin guard when demoting admin → member
        if (role === "member") {
          const adminCount = await tx.user.count({
            where: { tenantId, role: "admin", isSuspended: false },
          });
          if (adminCount <= 1) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message:
                "Cannot demote the last admin. Assign another admin first.",
            });
          }
        }

        return tx.user.update({
          where: { id: userId, tenantId },
          data: {
            role,
            // Increment securityVersion so any active session for this user
            // is invalidated at next request (V28 session invalidation pattern)
            securityVersion: { increment: 1 },
          },
          select: { id: true, role: true, securityVersion: true },
        });
      });

      return updated;
    }),

  /**
   * Suspends a tenant member.
   * Requires: admin role. Enforces last-admin guard and self-suspension block.
   * Rate-limited. Audited.
   * TODO Phase 7: publish `session.invalidate` to Valkey pub/sub for 30s SLO
   *   (LOCKED Jobs + Queues — Step 5 WebSocket+Valkey role broadcast).
   */
  suspend: protectedProcedure
    .use(requireTenant())
    .use(requireRole("admin"))
    .use(rateLimit("api"))
    .use(withAudit("user.suspend", AuditTargetType.User))
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = input;
      const tenantId = ctx.session!.user!.tenantId;

      if (userId === ctx.session!.user!.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot suspend your own account.",
        });
      }

      const updated = await prisma.$transaction(async (tx) => {
        // Last-admin guard: block suspending if target is the last non-suspended admin
        const target = await tx.user.findUniqueOrThrow({
          where: { id: userId, tenantId },
          select: { role: true },
        });

        if (target.role === "admin") {
          const adminCount = await tx.user.count({
            where: { tenantId, role: "admin", isSuspended: false },
          });
          if (adminCount <= 1) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Cannot suspend the last active admin.",
            });
          }
        }

        return tx.user.update({
          where: { id: userId, tenantId },
          data: {
            isSuspended: true,
            securityVersion: { increment: 1 },
          },
          select: { id: true, isSuspended: true },
        });
      });

      return updated;
    }),

  /**
   * Unsuspends a tenant member.
   * Requires: admin role.
   * Rate-limited. Audited.
   */
  unsuspend: protectedProcedure
    .use(requireTenant())
    .use(requireRole("admin"))
    .use(rateLimit("api"))
    .use(withAudit("user.unsuspend", AuditTargetType.User))
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const updated = await prisma.user.update({
        where: {
          id: input.userId,
          tenantId: ctx.session!.user!.tenantId,
        },
        data: { isSuspended: false },
        select: { id: true, isSuspended: true },
      });
      return updated;
    }),
});
