import { describe, expect, it } from 'vitest';

import { canInitiateCall, tenantIdFromChannel, BUS_CHANNELS } from '@yelli/shared';

import { CallAuthorizer } from './authorizer';

const startEvent = (sessionId: string, caller: string, callee: string) =>
  ({
    kind: 'call-signal' as const,
    sessionId,
    phase: 'start' as const,
    callerDeviceId: caller,
    calleeDeviceId: callee,
    at: '2026-06-12T00:00:00.000Z',
  });

describe('CallAuthorizer', () => {
  it('only the authorized caller may initiate an offer', () => {
    const a = new CallAuthorizer();
    a.applyBusEvent(startEvent('s1', 'devA', 'devB'));
    expect(a.canInitiate('devA', 'devB', 's1')).toBe(true);
    // Wrong direction (callee initiating) is rejected.
    expect(a.canInitiate('devB', 'devA', 's1')).toBe(false);
    // Unknown session is rejected.
    expect(a.canInitiate('devA', 'devB', 'nope')).toBe(false);
  });

  it('relays answer/ice either direction within the authorized pair only', () => {
    const a = new CallAuthorizer();
    a.applyBusEvent(startEvent('s1', 'devA', 'devB'));
    expect(a.canRelay('devB', 'devA', 's1')).toBe(true);
    expect(a.canRelay('devA', 'devB', 's1')).toBe(true);
    expect(a.canRelay('devA', 'devC', 's1')).toBe(false); // outsider
    expect(a.canRelay('devA', 'devA', 's1')).toBe(false); // self
  });

  it('an `end` event closes authorization', () => {
    const a = new CallAuthorizer();
    a.applyBusEvent(startEvent('s1', 'devA', 'devB'));
    a.applyBusEvent({ ...startEvent('s1', 'devA', 'devB'), phase: 'end' });
    expect(a.canInitiate('devA', 'devB', 's1')).toBe(false);
  });

  it('authorizations expire after the TTL', () => {
    let clock = 1_000;
    const a = new CallAuthorizer(100, () => clock);
    a.applyBusEvent(startEvent('s1', 'devA', 'devB'));
    expect(a.canInitiate('devA', 'devB', 's1')).toBe(true);
    clock += 101;
    expect(a.canInitiate('devA', 'devB', 's1')).toBe(false);
  });
});

describe('shared realtime contract', () => {
  it('canInitiateCall matches the caller/both call-roles', () => {
    expect(canInitiateCall('caller')).toBe(true);
    expect(canInitiateCall('both')).toBe(true);
    expect(canInitiateCall('receiver')).toBe(false);
  });

  it('tenantIdFromChannel inverts BUS_CHANNELS', () => {
    const ch = BUS_CHANNELS.callSignal('tenant-123');
    expect(tenantIdFromChannel(ch)).toBe('tenant-123');
    expect(tenantIdFromChannel('not-a-bus-channel')).toBeNull();
  });
});
