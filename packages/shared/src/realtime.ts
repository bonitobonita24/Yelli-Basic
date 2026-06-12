// Realtime contract — the single source of truth shared by the Valkey pub/sub
// bus (apps/yelli/src/server/realtime/bus.ts) and the standalone WebSocket
// signaling server (apps/signaling). Promoted here in W2b so both producer
// (the `calls` tRPC router) and consumer (the WS signaler) bind to ONE
// definition of the tenant-scoped channels + wire messages — no drift on a
// tenant-isolation-critical surface (DECISIONS_LOG L13/L30/L36).

import { z } from 'zod';

import { CALL_ROLES, type CallRole, type UserRole } from './enums';

// ─── Valkey pub/sub bus (cross-instance fan-out + session-kill) ──────────────

/** Tenant-scoped channel names — every event is isolated to its tenant. */
export const BUS_CHANNELS = {
  callSignal: (tenantId: string): string => `yelli:tenant:${tenantId}:call-signal`,
  roleChange: (tenantId: string): string => `yelli:tenant:${tenantId}:role-change`,
  sessionInvalidate: (tenantId: string): string => `yelli:tenant:${tenantId}:session-invalidate`,
} as const;

/** The shared channel prefix — also used to derive the tenantId from a channel. */
export const BUS_CHANNEL_PREFIX = 'yelli:tenant:' as const;

/** Inverse of BUS_CHANNELS — recover the tenantId a subscribed channel belongs to. */
export function tenantIdFromChannel(channel: string): string | null {
  if (!channel.startsWith(BUS_CHANNEL_PREFIX)) return null;
  const rest = channel.slice(BUS_CHANNEL_PREFIX.length);
  const sep = rest.indexOf(':');
  return sep === -1 ? null : rest.slice(0, sep);
}

/** Call lifecycle signal — produced by the `calls` router, consumed by the WS server. */
export type CallSignalEvent = {
  kind: 'call-signal';
  sessionId: string;
  phase: 'start' | 'connect' | 'end';
  callerDeviceId: string;
  calleeDeviceId: string;
  at: string;
};

/** Device call-role change — producer is `devices.setRole` (W1a; wired in a follow-up). */
export type RoleChangeEvent = {
  kind: 'role-change';
  deviceId: string;
  from: CallRole;
  to: CallRole;
  at: string;
};

/** Session-kill — producer is user role/suspend changes (W3 user routers, still placeholders). */
export type SessionInvalidateEvent = {
  kind: 'session-invalidate';
  userId: string;
  securityVersion: number;
  at: string;
};

export type BusEvent = CallSignalEvent | RoleChangeEvent | SessionInvalidateEvent;

// ─── WebSocket signaling wire protocol (client ⇄ signaling server) ───────────
// 1-on-1 WebRTC peer-to-peer, signaling-only (no media) — DECISIONS_LOG L36.
// The server validates every inbound frame with these zod schemas; the W2b-2
// client hook (useSignaling) builds outbound frames from the same types.

/** WebRTC SDP/ICE negotiation kind. An `offer` is a call INITIATION — role-guarded. */
export const SIGNAL_KINDS = ['offer', 'answer', 'ice', 'hangup'] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

/** Server→client error codes. `forbidden_by_role` is the role-guard rejection (defense in depth). */
export const SIGNAL_ERROR_CODES = [
  'unauthorized',
  'forbidden_by_role',
  'bad_request',
  'peer_not_found',
  'rate_limited',
] as const;
export type SignalErrorCode = (typeof SIGNAL_ERROR_CODES)[number];

/** Client → server: authenticate the socket. `token` is the Auth.js session JWT (W1b). */
export const helloMessageSchema = z
  .object({
    type: z.literal('hello'),
    token: z.string().min(1),
    deviceId: z.string().min(1),
  })
  .strict();

/** Client → server: relay a WebRTC SDP/ICE frame to a peer device in the same tenant. */
export const signalMessageSchema = z
  .object({
    type: z.literal('signal'),
    to: z.string().min(1),
    sessionId: z.string().min(1),
    kind: z.enum(SIGNAL_KINDS),
    // Opaque SDP/ICE payload — the server never inspects media, only routes it.
    data: z.unknown(),
  })
  .strict();

/** Client → server: liveness keepalive. */
export const pingMessageSchema = z.object({ type: z.literal('ping') }).strict();

export const clientMessageSchema = z.discriminatedUnion('type', [
  helloMessageSchema,
  signalMessageSchema,
  pingMessageSchema,
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type HelloMessage = z.infer<typeof helloMessageSchema>;
export type SignalMessage = z.infer<typeof signalMessageSchema>;

/** Server → client messages (discriminated on `type`). */
export type ServerMessage =
  // `role` is the server-verified ACCOUNT role (from the Auth.js JWT). The device
  // call-role (caller/receiver/both) is the client's own state — see canInitiateCall.
  | { type: 'ready'; deviceId: string; role: UserRole }
  | { type: 'signal'; from: string; sessionId: string; kind: SignalKind; data: unknown }
  | { type: 'call-signal'; event: CallSignalEvent }
  | { type: 'peer-offline'; deviceId: string }
  | { type: 'error'; code: SignalErrorCode; message: string }
  | { type: 'pong' };

/** Roles permitted to INITIATE a call (send an `offer`). DECISIONS_LOG L36. */
export function canInitiateCall(role: CallRole): boolean {
  return role === 'caller' || role === 'both';
}

// Re-export so a consumer can iterate valid roles without a second import.
export { CALL_ROLES };

// ─── Signaling health heartbeat (read by GET /_pwbt/health `signaling` field) ─

/** Valkey key the signaling server refreshes with a short TTL; health reads it. */
export const SIGNALING_HEARTBEAT_KEY = 'yelli:signaling:heartbeat' as const;

/** Default heartbeat refresh + freshness TTL (seconds). Overridable via env. */
export const SIGNALING_HEARTBEAT_TTL_SEC = 30;

export type SignalingHeartbeat = {
  at: string;
  peers: number;
  pid: number;
};
