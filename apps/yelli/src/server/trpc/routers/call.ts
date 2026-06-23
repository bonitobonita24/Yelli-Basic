import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { EndReason, Prisma } from '@yelli/db';
import { type CallEndReason, type CallRole, callEndReasonSchema } from '@yelli/shared';

import { publishCallSignal } from '@/server/realtime/bus';

import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

/**
 * Calls router — production wiring of the Phase 3.3 `sim.callSessions` SWAP
 * BOUNDARY (PROTOTYPE.md §3 Flow A/B). Exported as `callRouter`; merged into the
 * AppRouter under the key `calls` (plural) — tRPC v11 reserves `call` as a
 * router-builder key (LOCKED).
 *
 * This is the DATA + REALTIME-fan-out half (W2a). It persists the CallSession
 * lifecycle (start → connect → end) with both call-role snapshots, enforces the
 * server-side role guard (forbidden-by-role auto-reject), and publishes each
 * lifecycle transition to the Valkey bus for cross-instance WS fan-out. The
 * WebSocket signaling server (offer/answer/ICE) that consumes those signals is
 * hosted in W2b.
 *
 * AUDIT NOTE: calls are NOT written to the L5 AuditLog. They are recorded in the
 * CallSession entity itself (PRODUCT.md §11), which the sim mirrors verbatim and
 * the schema enforces — `AuditTargetType` has no `CallSession` value, and the
 * Wave 4 §11 reconciliation removed off-spec `call.*` emissions from the sim.
 * (PROTOTYPE.md §3's "Audit: call.start" prose is stale vs the locked sim/schema;
 * flagged for a docs reconciliation — see run-19-W2a result.)
 *
 * The L6 tenant-guard (`ctx.db`) scopes every row to the caller's tenant, so a
 * cross-tenant deviceId simply resolves to NOT_FOUND. tenantId is omitted from
 * every client-facing row via CALL_SESSION_SELECT (security.md #13). On top of
 * tenant scope, the mutations enforce PARTICIPANT ownership (security.md #5,
 * IDOR-within-tenant): you may place a call only from a device you operate
 * (`device.userId === ctx.user.id`), accept only as the callee, and end only as a
 * participant — preventing a tenant member from spoofing or hijacking another's call.
 */

// Client rows never expose tenantId (internal isolation key — security.md #13).
const CALL_SESSION_SELECT = {
  id: true,
  callerDeviceId: true,
  calleeDeviceId: true,
  thirdDeviceId: true,
  callerRoleAtCall: true,
  calleeRoleAtCall: true,
  startedAt: true,
  connectedAt: true,
  endedAt: true,
  durationSec: true,
  endReason: true,
} satisfies Prisma.CallSessionSelect;

type CallSessionRow = Prisma.CallSessionGetPayload<{ select: typeof CALL_SESSION_SELECT }>;

// endReason crosses a representation boundary: the shared/client union is
// hyphenated ('no-answer'); the Prisma enum is underscored ('no_answer') because
// Prisma enum identifiers cannot contain hyphens (the DB value is re-hyphenated
// via @map). Both maps are exhaustive — a missing reason is a compile error.
const END_REASON_TO_PRISMA: Record<CallEndReason, EndReason> = {
  completed: EndReason.completed,
  declined: EndReason.declined,
  busy: EndReason.busy,
  'no-answer': EndReason.no_answer,
  'peer-disconnect': EndReason.peer_disconnect,
  'ice-failed': EndReason.ice_failed,
  cancelled: EndReason.cancelled,
  'forbidden-by-role': EndReason.forbidden_by_role,
};

const END_REASON_TO_API: Record<EndReason, CallEndReason> = {
  [EndReason.completed]: 'completed',
  [EndReason.declined]: 'declined',
  [EndReason.busy]: 'busy',
  [EndReason.no_answer]: 'no-answer',
  [EndReason.peer_disconnect]: 'peer-disconnect',
  [EndReason.ice_failed]: 'ice-failed',
  [EndReason.cancelled]: 'cancelled',
  [EndReason.forbidden_by_role]: 'forbidden-by-role',
};

/** Map a persisted row to the client shape (hyphenated endReason). */
function toApiCallSession(row: CallSessionRow): Omit<CallSessionRow, 'endReason'> & {
  endReason: CallEndReason | null;
} {
  return { ...row, endReason: row.endReason ? END_REASON_TO_API[row.endReason] : null };
}

const canCall = (role: CallRole): boolean => role === 'caller' || role === 'both';
const canReceive = (role: CallRole): boolean => role === 'receiver' || role === 'both';

const idInput = z.object({ id: z.string().min(1) });

export const callRouter = router({
  // ── Queries ──────────────────────────────────────────────────────────────
  /** Call history for the tenant, newest first (Audit/history surfaces). */
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.callSession.findMany({
      where: {},
      select: CALL_SESSION_SELECT,
      orderBy: { startedAt: 'desc' },
    });
    return rows.map(toApiCallSession);
  }),

  byId: protectedProcedure.input(idInput).query(async ({ ctx, input }) => {
    const row = await ctx.db.callSession.findUnique({
      where: { id: input.id },
      select: CALL_SESSION_SELECT,
    });
    return row ? toApiCallSession(row) : null;
  }),

  // ── Mutations ────────────────────────────────────────────────────────────
  /**
   * Place a call (Flow A). Snapshots both devices' current call-roles into the
   * session, then enforces the role guard: if the caller cannot call or the
   * callee cannot receive, the session is created AND immediately ended with
   * `forbidden-by-role` (server-reject enforcement — the row records the blocked
   * attempt). Otherwise it is returned ringing (connectedAt null).
   *
   * Optional 3rd participant (hard cap 3): pass `secondCalleeDeviceId` to ring a
   * second callee at call-start. It is written to `thirdDeviceId` and gets its own
   * `start` ring event. The role guard runs per-callee — ANY forbidden callee
   * (caller-can't-call OR either callee-can't-receive) auto-rejects the whole
   * session. The single-callee path (no `secondCalleeDeviceId`) is unchanged.
   */
  start: protectedProcedure
    .input(
      z.object({
        callerDeviceId: z.string().min(1),
        calleeDeviceId: z.string().min(1),
        secondCalleeDeviceId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const calleeIds = [input.calleeDeviceId];
      if (input.secondCalleeDeviceId) calleeIds.push(input.secondCalleeDeviceId);
      // No device may appear twice (self-call, or the same callee in both slots).
      const allIds = [input.callerDeviceId, ...calleeIds];
      if (new Set(allIds).size !== allIds.length) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'A device cannot appear twice in a call.' });
      }
      // L6 scopes every lookup to the tenant — a cross-tenant id resolves to null.
      const [caller, ...callees] = await Promise.all([
        ctx.db.device.findUnique({ where: { id: input.callerDeviceId } }),
        ...calleeIds.map((id) => ctx.db.device.findUnique({ where: { id } })),
      ]);
      if (!caller || callees.some((c) => !c)) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Caller or callee device not found.' });
      }
      const calleeDevices = callees as NonNullable<(typeof callees)[number]>[];
      // IDOR guard (security.md #5; W1a register/setDisplayName precedent): a member
      // places a call only from a device they operate — never a client-supplied
      // device they do not own. LAN-anonymous calling (device.userId === null) is a
      // separate unauthenticated path, never this protected router.
      if (caller.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only place calls from your own device.',
        });
      }

      const forbidden = !canCall(caller.callRole) || calleeDevices.some((c) => !canReceive(c.callRole));
      // calleeIds always has ≥1 entry (zod .min(1)), so calleeDevices[0] exists.
      const [callee, third] = calleeDevices;
      if (!callee) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Caller or callee device not found.' });
      }
      const now = new Date();
      const session = await ctx.db.callSession.create({
        data: {
          tenantId: ctx.tenantId,
          callerDeviceId: caller.id,
          calleeDeviceId: callee.id,
          thirdDeviceId: third?.id ?? null,
          callerRoleAtCall: caller.callRole,
          calleeRoleAtCall: callee.callRole,
          startedAt: now,
          ...(forbidden
            ? { endedAt: now, durationSec: 0, endReason: EndReason.forbidden_by_role }
            : {}),
        },
        select: CALL_SESSION_SELECT,
      });

      // Best-effort cross-instance fan-out (never blocks the mutation) — one ring
      // event per callee so each device's incoming-call query fires independently.
      for (const c of calleeDevices) {
        void publishCallSignal(ctx.tenantId, {
          sessionId: session.id,
          phase: forbidden ? 'end' : 'start',
          callerDeviceId: caller.id,
          calleeDeviceId: c.id,
          at: now.toISOString(),
        });
      }

      return toApiCallSession(session);
    }),

  /** Accept an incoming call (Flow B) — stamps connectedAt. */
  connect: protectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db.callSession.findUnique({
      where: { id: input.id },
      select: CALL_SESSION_SELECT,
    });
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Call session not found.' });
    }
    if (existing.endedAt) {
      throw new TRPCError({ code: 'CONFLICT', message: 'Call has already ended.' });
    }
    // IDOR guard: only the operator of the callee device may accept the call.
    const callee = await ctx.db.device.findUnique({ where: { id: existing.calleeDeviceId } });
    if (!callee || callee.userId !== ctx.user.id) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the call recipient can accept.' });
    }
    const session = await ctx.db.callSession.update({
      where: { id: input.id },
      data: { connectedAt: new Date() },
      select: CALL_SESSION_SELECT,
    });
    void publishCallSignal(ctx.tenantId, {
      sessionId: session.id,
      phase: 'connect',
      callerDeviceId: session.callerDeviceId,
      calleeDeviceId: session.calleeDeviceId,
      at: new Date().toISOString(),
    });
    return toApiCallSession(session);
  }),

  /**
   * Add a 3rd participant to a LIVE call (hard cap 3). Validates: session exists
   * and is live (endedAt null); the seat is open (thirdDeviceId null → else
   * `call_full`); the actor operates an existing participant device (caller or
   * callee); the new device exists in-tenant, is owned by the actor's tenant, and
   * passes the SAME receive-side role guard. Rejects self-add and adding a device
   * already in the session. On success: stamps thirdDeviceId and rings the new
   * device with a `start` signal. No new RBAC — reuses the existing call guards.
   */
  add: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1), calleeDeviceId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.callSession.findUnique({
        where: { id: input.sessionId },
        select: CALL_SESSION_SELECT,
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Call session not found.' });
      }
      if (existing.endedAt) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Call has already ended.' });
      }
      if (existing.thirdDeviceId) {
        throw new TRPCError({ code: 'CONFLICT', message: 'call_full: this call already has 3 participants.' });
      }
      // Reject adding a device already in the session (caller or callee).
      if (
        input.calleeDeviceId === existing.callerDeviceId ||
        input.calleeDeviceId === existing.calleeDeviceId
      ) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Device is already in this call.' });
      }
      // L6 scopes every lookup to the tenant — a cross-tenant id resolves to null.
      const [caller, callee, newDevice] = await Promise.all([
        ctx.db.device.findUnique({ where: { id: existing.callerDeviceId } }),
        ctx.db.device.findUnique({ where: { id: existing.calleeDeviceId } }),
        ctx.db.device.findUnique({ where: { id: input.calleeDeviceId } }),
      ]);
      if (!newDevice) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Device to add not found.' });
      }
      // IDOR guard: only a participant (operator of the caller or callee device)
      // may invite a 3rd party into the call.
      if (caller?.userId !== ctx.user.id && callee?.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only a call participant can add a device.',
        });
      }
      // Same receive-side role guard as the callee path: a device that cannot
      // receive cannot be rung into the call.
      if (!canReceive(newDevice.callRole)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'This device cannot receive calls.' });
      }
      const session = await ctx.db.callSession.update({
        where: { id: input.sessionId },
        data: { thirdDeviceId: newDevice.id },
        select: CALL_SESSION_SELECT,
      });
      // Ring the newly-added device (best-effort cross-instance fan-out).
      void publishCallSignal(ctx.tenantId, {
        sessionId: session.id,
        phase: 'start',
        callerDeviceId: session.callerDeviceId,
        calleeDeviceId: newDevice.id,
        at: new Date().toISOString(),
      });
      return toApiCallSession(session);
    }),

  /**
   * End a call (Flow B reject / hang-up / timeout). Computes durationSec from
   * connectedAt (or startedAt if never connected). Idempotent: ending an
   * already-ended session returns it unchanged.
   */
  end: protectedProcedure
    .input(idInput.extend({ reason: callEndReasonSchema }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.callSession.findUnique({
        where: { id: input.id },
        select: CALL_SESSION_SELECT,
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Call session not found.' });
      }
      // IDOR guard: only a participant (operator of the caller or callee device) may
      // end the call. Server-initiated ends (peer-disconnect / ice-failed from the
      // W2b WS server) use a separate system path, not this protected procedure.
      const [caller, callee] = await Promise.all([
        ctx.db.device.findUnique({ where: { id: existing.callerDeviceId } }),
        ctx.db.device.findUnique({ where: { id: existing.calleeDeviceId } }),
      ]);
      if (caller?.userId !== ctx.user.id && callee?.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only a call participant can end the call.' });
      }
      if (existing.endedAt) {
        return toApiCallSession(existing);
      }
      const endedAt = new Date();
      const startMs = (existing.connectedAt ?? existing.startedAt).getTime();
      const durationSec = Math.max(0, Math.round((endedAt.getTime() - startMs) / 1000));
      const session = await ctx.db.callSession.update({
        where: { id: input.id },
        data: { endedAt, durationSec, endReason: END_REASON_TO_PRISMA[input.reason] },
        select: CALL_SESSION_SELECT,
      });
      void publishCallSignal(ctx.tenantId, {
        sessionId: session.id,
        phase: 'end',
        callerDeviceId: session.callerDeviceId,
        calleeDeviceId: session.calleeDeviceId,
        at: endedAt.toISOString(),
      });
      return toApiCallSession(session);
    }),
});
