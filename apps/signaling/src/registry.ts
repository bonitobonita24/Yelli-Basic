import type { WebSocket } from 'ws';

import type { AuthedIdentity } from './auth';

/** A live, authenticated peer connection. */
export type Peer = {
  socket: WebSocket;
  deviceId: string;
  identity: AuthedIdentity;
};

/**
 * In-memory peer registry, partitioned by tenantId so a lookup can never cross
 * tenant boundaries (L1 isolation at the transport layer). One process instance
 * owns its locally-connected peers; cross-instance delivery is handled by the
 * Valkey bus fan-out in server.ts, never by this registry.
 *
 * Keyed `tenantId -> deviceId -> Peer`. A device reconnect replaces the prior
 * socket for that deviceId (last-writer-wins) — the caller closes the stale one.
 */
export class PeerRegistry {
  private readonly byTenant = new Map<string, Map<string, Peer>>();

  /**
   * Register a peer.
   *  - `{ ok: true, displaced }` — registered; `displaced` is a prior socket for the
   *    SAME (tenant, deviceId, user) the caller must close (e.g. a reconnect / 2nd tab).
   *  - `{ ok: false }` — REFUSED: the deviceId is already held by a DIFFERENT user in
   *    this tenant. Defense in depth (W2b-1 review): an authenticated same-tenant peer
   *    must not displace + impersonate another user's live device socket. (Full
   *    deviceId↔user binding at handshake is q-W2b-04, tied to the unbuilt
   *    device-session model — this closes the live-hijack vector without it.)
   */
  add(peer: Peer): { ok: true; displaced: Peer | null } | { ok: false; reason: 'device-in-use' } {
    const tenantId = peer.identity.tenantId;
    let tenant = this.byTenant.get(tenantId);
    if (!tenant) {
      tenant = new Map();
      this.byTenant.set(tenantId, tenant);
    }
    const existing = tenant.get(peer.deviceId) ?? null;
    if (existing && existing.identity.userId !== peer.identity.userId) {
      return { ok: false, reason: 'device-in-use' };
    }
    tenant.set(peer.deviceId, peer);
    return { ok: true, displaced: existing };
  }

  /** Remove a peer only if the registered socket is still the one we hold. */
  remove(peer: Peer): void {
    const tenant = this.byTenant.get(peer.identity.tenantId);
    if (!tenant) return;
    if (tenant.get(peer.deviceId) === peer) {
      tenant.delete(peer.deviceId);
      if (tenant.size === 0) this.byTenant.delete(peer.identity.tenantId);
    }
  }

  /** Look up a connected peer within a tenant. Never returns peers of other tenants. */
  get(tenantId: string, deviceId: string): Peer | undefined {
    return this.byTenant.get(tenantId)?.get(deviceId);
  }

  /** Does the tenant have any locally-connected peers? (drives bus subscribe/unsubscribe). */
  hasTenant(tenantId: string): boolean {
    return (this.byTenant.get(tenantId)?.size ?? 0) > 0;
  }

  /** All locally-connected peers for a user in a tenant (drives session-kill force-close). */
  forUser(tenantId: string, userId: string): Peer[] {
    const tenant = this.byTenant.get(tenantId);
    if (!tenant) return [];
    const out: Peer[] = [];
    for (const peer of tenant.values()) {
      if (peer.identity.userId === userId) out.push(peer);
    }
    return out;
  }

  /** Total locally-connected peers across all tenants (for the health heartbeat). */
  size(): number {
    let total = 0;
    for (const tenant of this.byTenant.values()) total += tenant.size;
    return total;
  }
}
