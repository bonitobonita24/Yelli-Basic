import type { CallSignalEvent } from '@yelli/shared';

/**
 * Relay authorization — the signaler's defense-in-depth call guard.
 *
 * The AUTHORITATIVE call setup + role-guard (Device.callRole → `forbidden-by-role`)
 * happens in the W2a `calls.start` tRPC procedure (authenticated, L1-L6). It
 * publishes a `call-signal { phase:'start', sessionId, callerDeviceId,
 * calleeDeviceId }` onto the tenant bus. The signaler treats that as the ONLY
 * authorization to relay WebRTC media for a session:
 *
 *   • an `offer` is accepted only from the authorized CALLER toward the
 *     authorized CALLEE (mirrors the L36 "non-caller roles rejected" rule
 *     without this stateless server needing the device's callRole);
 *   • `answer` / `ice` flow either direction between the authorized pair;
 *   • anything else is rejected.
 *
 * Sessions auto-expire (no `end` received) so a dropped call cannot leave a
 * stale authorization open forever.
 */

type AuthorizedCall = {
  callerDeviceId: string;
  calleeDeviceId: string;
  at: number;
};

const DEFAULT_TTL_MS = 2 * 60 * 1000; // 2 min — generous vs the 30s no-answer dismiss.

export class CallAuthorizer {
  private readonly sessions = new Map<string, AuthorizedCall>();

  constructor(
    private readonly ttlMs: number = DEFAULT_TTL_MS,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Apply a bus call-signal: `start` opens authorization, `end` closes it. */
  applyBusEvent(event: CallSignalEvent): void {
    if (event.phase === 'end') {
      this.sessions.delete(event.sessionId);
      return;
    }
    // start | connect (re)affirm the authorized pair.
    this.sessions.set(event.sessionId, {
      callerDeviceId: event.callerDeviceId,
      calleeDeviceId: event.calleeDeviceId,
      at: this.now(),
    });
  }

  private live(sessionId: string): AuthorizedCall | null {
    const call = this.sessions.get(sessionId);
    if (!call) return null;
    if (this.now() - call.at > this.ttlMs) {
      this.sessions.delete(sessionId);
      return null;
    }
    return call;
  }

  /** May `from` send an OFFER to `to` for this session? Only the authorized caller→callee. */
  canInitiate(fromDeviceId: string, toDeviceId: string, sessionId: string): boolean {
    const call = this.live(sessionId);
    return (
      call !== null &&
      call.callerDeviceId === fromDeviceId &&
      call.calleeDeviceId === toDeviceId
    );
  }

  /** May `from` relay an answer/ice/hangup to `to`? Either direction within the authorized pair. */
  canRelay(fromDeviceId: string, toDeviceId: string, sessionId: string): boolean {
    const call = this.live(sessionId);
    if (!call) return false;
    const pair = new Set([call.callerDeviceId, call.calleeDeviceId]);
    return pair.has(fromDeviceId) && pair.has(toDeviceId) && fromDeviceId !== toDeviceId;
  }

  /** Drop expired authorizations (called opportunistically). */
  sweep(): void {
    const cutoff = this.now() - this.ttlMs;
    for (const [sessionId, call] of this.sessions) {
      if (call.at < cutoff) this.sessions.delete(sessionId);
    }
  }
}
