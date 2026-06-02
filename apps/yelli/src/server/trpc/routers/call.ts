import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { AuditTargetType, CallRole, EndReason } from "@prisma/client";
import { prisma } from "@yelli/db";
import { router, protectedProcedure } from "../trpc";
import { requireTenant } from "../middleware/tenant";
import { rateLimit } from "../middleware/rate-limit-mw";
import { withAudit } from "../middleware/audit-log";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findActiveDevice(userId: string, tenantId: string) {
  return prisma.device.findFirst({
    where: {
      userId,
      tenantId,
      archivedAt: null,
    },
    select: { id: true, callRole: true },
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const callRouter = router({
  /**
   * Initiate a call from the current user's active device to another user's active device.
   *
   * Enforces calling-model rule: a device with callRole=receiver cannot originate a call.
   * TODO Phase 7: fan-out incoming-call signal via Valkey pub/sub WS + enqueue Web Push job.
   */
  invite: protectedProcedure
    .use(requireTenant())
    .use(rateLimit("api"))
    .use(withAudit("call.invite", AuditTargetType.User))
    .input(
      z.object({
        calleeUserId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const callerId = ctx.session!.user!.id;
      const tenantId = ctx.session!.user!.tenantId!;

      // Snapshot caller device
      const callerDevice = await findActiveDevice(callerId, tenantId);
      if (!callerDevice) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No active device found for caller.",
        });
      }

      // Defense-in-depth: receiver-only devices cannot originate calls (LOCKED calling model)
      if (callerDevice.callRole === CallRole.receiver) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "forbidden_by_role: receiver devices cannot originate calls.",
        });
      }

      // Snapshot callee device
      const calleeDevice = await findActiveDevice(input.calleeUserId, tenantId);
      if (!calleeDevice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active device found for callee.",
        });
      }

      const now = new Date();

      const session = await prisma.callSession.create({
        data: {
          tenantId,
          callerDeviceId: callerDevice.id,
          calleeDeviceId: calleeDevice.id,
          callerRoleAtCall: callerDevice.callRole,
          calleeRoleAtCall: calleeDevice.callRole,
          startedAt: now,
          connectedAt: null,
          endedAt: now, // placeholder — updated on end/accept/reject; non-nullable in schema
          durationSec: null,
          endReason: EndReason.cancelled, // default; overwritten on explicit end
        },
        select: { id: true },
      });

      return { callSessionId: session.id };
    }),

  /**
   * Callee accepts the call — sets connectedAt.
   * TODO Phase 7: signal acceptance via Valkey pub/sub WS.
   */
  accept: protectedProcedure
    .use(requireTenant())
    .use(rateLimit("api"))
    .use(withAudit("call.accept", AuditTargetType.User))
    .input(
      z.object({
        callSessionId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id;
      const tenantId = ctx.session!.user!.tenantId!;

      const callSession = await prisma.callSession.findFirst({
        where: { id: input.callSessionId, tenantId },
        select: {
          id: true,
          calleeDeviceId: true,
          calleeDevice: { select: { userId: true } },
        },
      });

      if (!callSession) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Call session not found." });
      }

      if (callSession.calleeDevice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the callee can accept." });
      }

      await prisma.callSession.update({
        where: { id: input.callSessionId },
        data: { connectedAt: new Date() },
      });

      return { accepted: true };
    }),

  /**
   * Callee rejects the call.
   * TODO Phase 7: signal rejection via Valkey pub/sub WS.
   */
  reject: protectedProcedure
    .use(requireTenant())
    .use(rateLimit("api"))
    .use(withAudit("call.reject", AuditTargetType.User))
    .input(
      z.object({
        callSessionId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id;
      const tenantId = ctx.session!.user!.tenantId!;

      const callSession = await prisma.callSession.findFirst({
        where: { id: input.callSessionId, tenantId },
        select: {
          id: true,
          calleeDevice: { select: { userId: true } },
        },
      });

      if (!callSession) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Call session not found." });
      }

      if (callSession.calleeDevice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the callee can reject." });
      }

      const now = new Date();
      await prisma.callSession.update({
        where: { id: input.callSessionId },
        data: { endedAt: now, endReason: EndReason.declined },
      });

      return { rejected: true };
    }),

  /**
   * Either party ends the call.
   * TODO Phase 7: signal end via Valkey pub/sub WS.
   */
  end: protectedProcedure
    .use(requireTenant())
    .use(rateLimit("api"))
    .use(withAudit("call.end", AuditTargetType.User))
    .input(
      z.object({
        callSessionId: z.string().min(1),
        endReason: z.nativeEnum(EndReason),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id;
      const tenantId = ctx.session!.user!.tenantId!;

      const callSession = await prisma.callSession.findFirst({
        where: { id: input.callSessionId, tenantId },
        include: {
          callerDevice: { select: { userId: true } },
          calleeDevice: { select: { userId: true } },
        },
      });

      if (!callSession) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Call session not found." });
      }

      const isCaller = callSession.callerDevice.userId === userId;
      const isCallee = callSession.calleeDevice.userId === userId;

      if (!isCaller && !isCallee) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not a participant of this call." });
      }

      const now = new Date();
      const durationSec = Math.floor(
        (now.getTime() - callSession.startedAt.getTime()) / 1000
      );

      await prisma.callSession.update({
        where: { id: input.callSessionId },
        data: {
          endedAt: now,
          durationSec,
          endReason: input.endReason,
        },
      });

      return { ended: true, durationSec };
    }),

  /**
   * Returns paginated call history for the current user (caller or callee).
   */
  history: protectedProcedure
    .use(requireTenant())
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(25),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id;
      const tenantId = ctx.session!.user!.tenantId!;

      // Find devices owned by this user in this tenant
      const userDevices = await prisma.device.findMany({
        where: { userId, tenantId },
        select: { id: true },
      });
      const deviceIds = userDevices.map((d) => d.id);

      const cursorClause = input.cursor ? { id: { lt: input.cursor } } : {};

      const items = await prisma.callSession.findMany({
        where: {
          tenantId,
          OR: [
            { callerDeviceId: { in: deviceIds } },
            { calleeDeviceId: { in: deviceIds } },
          ],
          ...cursorClause,
        },
        orderBy: { startedAt: "desc" },
        take: input.limit + 1,
        select: {
          id: true,
          callerDeviceId: true,
          calleeDeviceId: true,
          callerRoleAtCall: true,
          calleeRoleAtCall: true,
          startedAt: true,
          connectedAt: true,
          endedAt: true,
          durationSec: true,
          endReason: true,
        },
      });

      const hasMore = items.length > input.limit;
      const page = hasMore ? items.slice(0, input.limit) : items;
      const lastItem = page[page.length - 1];

      return {
        items: page,
        nextCursor: hasMore && lastItem ? lastItem.id : undefined,
      };
    }),

  /**
   * Callee-side poll: returns the current ringing CallSession (if any) targeting any
   * of the calling user's active devices. Used by IncomingCallModal hook.
   *
   * "Ringing" = connectedAt is NULL AND endedAt is within 1s of startedAt (the invite
   * placeholder, untouched by accept/reject/end) AND startedAt > now - 30s.
   *
   * Prisma cannot compare two columns natively without raw SQL, so the endedAt≈startedAt
   * check is done in JS after the candidate fetch. The narrow time window keeps the
   * candidate set tiny (≤ active inviters in the last 30s).
   *
   * TODO Phase 7 sub-feature 3d-2: replace polling with Valkey pub/sub WS subscription.
   */
  pending: protectedProcedure
    .use(requireTenant())
    .query(async ({ ctx }) => {
      const userId = ctx.session!.user!.id;
      const tenantId = ctx.session!.user!.tenantId!;

      const userDevices = await prisma.device.findMany({
        where: { userId, tenantId, archivedAt: null },
        select: { id: true },
      });
      const deviceIds = userDevices.map((d) => d.id);
      if (deviceIds.length === 0) return null;

      const ringingThreshold = new Date(Date.now() - 30_000);

      const candidates = await prisma.callSession.findMany({
        where: {
          tenantId,
          calleeDeviceId: { in: deviceIds },
          connectedAt: null,
          startedAt: { gte: ringingThreshold },
        },
        orderBy: { startedAt: "desc" },
        take: 5,
        include: {
          callerDevice: {
            select: {
              displayName: true,
              owner: { select: { displayName: true, email: true } },
            },
          },
        },
      });

      const ringing = candidates.find(
        (c) => Math.abs(c.endedAt.getTime() - c.startedAt.getTime()) < 1000,
      );
      if (!ringing) return null;

      return {
        callSessionId: ringing.id,
        callerDisplayName:
          ringing.callerDevice.displayName ??
          ringing.callerDevice.owner?.displayName ??
          ringing.callerDevice.owner?.email ??
          "Unknown",
        startedAt: ringing.startedAt,
      };
    }),
});
