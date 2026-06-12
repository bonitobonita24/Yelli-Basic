import { Redis } from 'ioredis';

import {
  BUS_CHANNELS,
  type BusEvent,
  type CallSignalEvent,
  type RoleChangeEvent,
  type SessionInvalidateEvent,
} from '@yelli/shared';

// Re-export the realtime contract so existing importers of this module
// (`@/server/realtime/bus`) keep their import paths. The definitions now live
// in @yelli/shared (W2b) — the single source of truth shared with apps/signaling.
export {
  BUS_CHANNELS,
  type BusEvent,
  type CallSignalEvent,
  type RoleChangeEvent,
  type SessionInvalidateEvent,
};

/**
 * Valkey (MIT Redis fork) pub/sub bus — the cross-instance realtime data plane.
 *
 * Two responsibilities, both serving the multi-instance signaling topology that
 * the W2b WebSocket server will host:
 *   1. Cross-instance fan-out — a call-signal / role-change published on one app
 *      instance reaches the WS connections held by every other instance. The sim
 *      (Phase 3.3) used in-memory state for this (PROTOTYPE.md §3 "Known fakes");
 *      production replaces it with Valkey pub/sub.
 *   2. Session-kill (30s SLO) — when a user's role/tenant/status changes, every
 *      instance must drop that user's live session within 30s (LOCKED, Step 6
 *      "hybrid pull+push session-kill"). We do BOTH: an immediate `publish` (push)
 *      AND a 30s-TTL key (pull) so an instance that missed the push still picks it
 *      up on its next ≤30s poll. The DB `securityVersion` remains the source of
 *      truth; this bus only accelerates propagation.
 *
 * Best-effort by design: a broadcast that fails to reach Valkey is logged, never
 * thrown — it must not fail the mutation that triggered it (the pull-cache + DB
 * version are the durable backstops). All publishes no-op when REDIS_URL is unset
 * (build / unit-test contexts), so importing this module is always side-effect-free.
 *
 * NO WebSocket server is hosted here — that is W2b. This module is the transport
 * the W2b signaler subscribes to (`createBusSubscriber`), independent of whichever
 * WS topology W2b chooses.
 */

/** LOCKED 30s session-kill SLO (Step 6 — hybrid pull+push). */
const SESSION_INVALIDATE_TTL_SEC = 30;

const sessionInvalidateKey = (tenantId: string, userId: string): string =>
  `yelli:tenant:${tenantId}:sess-inval:${userId}`;

// Lazy publisher singleton. ioredis is pinned to 5.10.1 via the root
// pnpm.overrides (deduped with bullmq's bundled instance). maxRetriesPerRequest:
// null mirrors the @yelli/jobs connection contract.
let publisher: Redis | null = null;

function getPublisher(): Redis | null {
  const url = process.env['REDIS_URL'];
  if (!url) return null; // No Valkey configured → publishes become no-ops.
  if (!publisher) {
    publisher = new Redis(url, { maxRetriesPerRequest: null });
    publisher.on('error', (err) => console.error('[realtime-bus] publisher error:', err.message));
  }
  return publisher;
}

async function publish(channel: string, event: BusEvent): Promise<void> {
  const pub = getPublisher();
  if (!pub) return;
  try {
    await pub.publish(channel, JSON.stringify(event));
  } catch (err) {
    console.error('[realtime-bus] publish failed on', channel, '—', (err as Error).message);
  }
}

/** Broadcast a call lifecycle signal for cross-instance WS fan-out (best-effort). */
export function publishCallSignal(
  tenantId: string,
  event: Omit<CallSignalEvent, 'kind'>,
): Promise<void> {
  return publish(BUS_CHANNELS.callSignal(tenantId), { kind: 'call-signal', ...event });
}

/** Broadcast a device call-role change so peers re-evaluate who can call whom (best-effort). */
export function publishRoleChange(
  tenantId: string,
  event: Omit<RoleChangeEvent, 'kind'>,
): Promise<void> {
  return publish(BUS_CHANNELS.roleChange(tenantId), { kind: 'role-change', ...event });
}

/**
 * Push + pull session-kill. Publishes the invalidation (immediate) AND writes a
 * 30s-TTL key (so a missed push is still caught within the SLO). Best-effort.
 */
export async function publishSessionInvalidate(
  tenantId: string,
  event: Omit<SessionInvalidateEvent, 'kind'>,
): Promise<void> {
  const pub = getPublisher();
  if (!pub) return;
  const payload: SessionInvalidateEvent = { kind: 'session-invalidate', ...event };
  try {
    await Promise.all([
      pub.publish(BUS_CHANNELS.sessionInvalidate(tenantId), JSON.stringify(payload)),
      pub.set(
        sessionInvalidateKey(tenantId, event.userId),
        String(event.securityVersion),
        'EX',
        SESSION_INVALIDATE_TTL_SEC,
      ),
    ]);
  } catch (err) {
    console.error('[realtime-bus] session-invalidate failed —', (err as Error).message);
  }
}

/**
 * Pull-side session-kill check (the 30s backstop). Returns the securityVersion an
 * instance must require for this user, or null if no recent invalidation. Callers
 * compare it against the JWT-embedded version and force re-auth on mismatch.
 */
export async function getInvalidatedSecurityVersion(
  tenantId: string,
  userId: string,
): Promise<number | null> {
  const pub = getPublisher();
  if (!pub) return null;
  try {
    const value = await pub.get(sessionInvalidateKey(tenantId, userId));
    return value === null ? null : Number(value);
  } catch (err) {
    console.error('[realtime-bus] invalidation lookup failed —', (err as Error).message);
    return null;
  }
}

/**
 * Dedicated subscriber connection for the W2b WebSocket signaling server. A
 * Redis connection in subscriber mode cannot issue normal commands, so the WS
 * server owns a separate instance: `.subscribe(BUS_CHANNELS.callSignal(tenantId))`
 * then handle the `'message'` event. The caller owns its lifecycle.
 */
export function createBusSubscriber(): Redis {
  const url = process.env['REDIS_URL'];
  if (!url) {
    throw new Error('REDIS_URL is not set — cannot create a realtime-bus subscriber.');
  }
  return new Redis(url, { maxRetriesPerRequest: null });
}
