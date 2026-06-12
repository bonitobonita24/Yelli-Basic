import { describe, expect, it } from 'vitest';
import type { WebSocket } from 'ws';

import type { AuthedIdentity } from './auth';
import { PeerRegistry, type Peer } from './registry';

// Sockets are irrelevant to the registry's authorization logic — stub them.
const sock = () => ({}) as unknown as WebSocket;
const id = (tenantId: string, userId: string): AuthedIdentity => ({
  tenantId,
  userId,
  role: 'member',
});
const peer = (tenantId: string, userId: string, deviceId: string): Peer => ({
  socket: sock(),
  deviceId,
  identity: id(tenantId, userId),
});

describe('PeerRegistry', () => {
  it('refuses to displace a device held by a DIFFERENT user (no hijack)', () => {
    const r = new PeerRegistry();
    expect(r.add(peer('t1', 'userA', 'devX')).ok).toBe(true);
    const attacker = r.add(peer('t1', 'userB', 'devX'));
    expect(attacker.ok).toBe(false);
    // The legitimate owner is still registered.
    expect(r.get('t1', 'devX')?.identity.userId).toBe('userA');
  });

  it('allows the SAME user to reconnect a device (returns the displaced socket)', () => {
    const r = new PeerRegistry();
    const first = peer('t1', 'userA', 'devX');
    r.add(first);
    const second = r.add(peer('t1', 'userA', 'devX'));
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.displaced).toBe(first);
  });

  it('partitions by tenant — a deviceId in t1 never resolves in t2', () => {
    const r = new PeerRegistry();
    r.add(peer('t1', 'userA', 'devX'));
    expect(r.get('t2', 'devX')).toBeUndefined();
    // Same deviceId string in a different tenant is independent and allowed.
    expect(r.add(peer('t2', 'userZ', 'devX')).ok).toBe(true);
  });

  it('forUser returns only that user’s peers; size + tenant cleanup track removal', () => {
    const r = new PeerRegistry();
    const p1 = peer('t1', 'userA', 'devX');
    const p2 = peer('t1', 'userA', 'devY');
    r.add(p1);
    r.add(p2);
    expect(r.forUser('t1', 'userA')).toHaveLength(2);
    expect(r.size()).toBe(2);
    r.remove(p1);
    r.remove(p2);
    expect(r.hasTenant('t1')).toBe(false);
    expect(r.size()).toBe(0);
  });
});
