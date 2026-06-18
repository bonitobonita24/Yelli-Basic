'use client';

import { ArrowLeft, Mic, PhoneOff, RefreshCw, Video, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { SignalingHandle } from '@/hooks/useSignaling';
import { trpc } from '@/lib/trpc/react';

/**
 * Active-call screen (Flow A — Place / in-call). Production port of the Phase 3.3
 * `prototype/src/screens/ScreenActiveCall.tsx` (INHERIT-not-REPLACE — the
 * immersive view is reproduced with Clay tokens + lucide icons; on-dark text uses
 * Tailwind's `white` keyword utilities since there is no dedicated on-dark text
 * token — same residual-token posture as W7 deferral #4).
 *
 * V32.8 design-drift fix (B1): background changed from bg-brand-teal (#1a3a3a,
 * 4× too light) to bg-surface-dark (#0a1a1a) — the MOCKUP's intended near-black.
 * Gradient corrected to match MOCKUP: from-surface-dark-elevated via-surface-dark
 * to-primary (was from-brand-teal via-primary to-primary).
 *
 * SWAP BOUNDARY wiring (replaces the prototype's `sim.callSessions`/`sim.devices`):
 *   - `trpc.calls.byId`   — the live CallSession (also surfaces `endReason`)
 *   - `trpc.devices.byId` — the peer's display name
 *   - `trpc.calls.end`    — hang-up persistence (reason `completed`)
 *   - `useSignaling.sendHangup` — cooperative peer notify on hang-up
 *
 * Single-socket ownership: the parent app-shell (W1b call-orchestration) owns the
 * ONE `useSignaling` instance (the hook explicitly warns one socket per consumer)
 * and the RTCPeerConnection media engine (getUserMedia / offer-answer-ICE /
 * remote-stream attach). This screen consumes only the `sendHangup` slice of the
 * `SignalingHandle` contract via prop, and `onExit` for navigation — exactly the
 * controlled boundary used for the overlays. The media controls below are
 * presentational until that call-engine lands.
 *
 * forbidden-by-role (Step 4): `calls.start` server-rejects a role-blocked attempt
 * by creating the session already-ended with `endReason: 'forbidden-by-role'`.
 * This screen renders a distinct terminal state for it (vs a generic "Call ended").
 */

type Props = {
  callSessionId: string;
  /** This client's device id — used to resolve which participant is the peer. */
  selfDeviceId: string;
  /** Hang-up sender from the parent's single `useSignaling` instance. */
  signaling: Pick<SignalingHandle, 'sendHangup'>;
  /** Navigate back to the app shell (parent-owned, mirrors the prototype's `go`). */
  onExit: () => void;
};

function initials(name: string): string {
  return name
    .split(' ')
    .flatMap((n) => (n[0] ? [n[0]] : []))
    .slice(0, 2)
    .join('');
}

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Shared terminal layout for the ended / not-found / forbidden states. */
function TerminalState(props: { message: string; onExit: () => void }): React.JSX.Element {
  return (
    <div className="grid min-h-screen place-items-center bg-surface-dark p-6 text-white">
      <div className="space-y-4 text-center">
        <div className="text-base opacity-80">{props.message}</div>
        <button
          type="button"
          onClick={props.onExit}
          className="h-11 rounded-sm bg-surface px-5 text-[13px] font-semibold text-text-primary"
        >
          Back
        </button>
      </div>
    </div>
  );
}

export default function ScreenActiveCall(props: Props): React.JSX.Element {
  const { callSessionId, selfDeviceId, signaling, onExit } = props;

  const sessionQuery = trpc.calls.byId.useQuery({ id: callSessionId });
  const session = sessionQuery.data ?? null;

  const peerDeviceId = session
    ? session.callerDeviceId === selfDeviceId
      ? session.calleeDeviceId
      : session.callerDeviceId
    : '';
  const peerQuery = trpc.devices.byId.useQuery(
    { id: peerDeviceId },
    { enabled: peerDeviceId.length > 0 },
  );
  const peerName = peerQuery.data?.displayName ?? '…';

  const end = trpc.calls.end.useMutation();

  // Live elapsed timer from connectedAt (ringing shows "Ringing…").
  const connectedAtMs = session?.connectedAt ? new Date(session.connectedAt).getTime() : null;
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (connectedAtMs === null) return undefined;
    const tick = (): void =>
      setElapsed(Math.max(0, Math.round((Date.now() - connectedAtMs) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [connectedAtMs]);

  const endCall = (): void => {
    if (peerDeviceId) {
      // Cooperative peer notify via the parent's single signaling socket.
      signaling.sendHangup({ to: peerDeviceId, sessionId: callSessionId });
    }
    end.mutate({ id: callSessionId, reason: 'completed' }, { onSettled: onExit });
  };

  // ── Terminal / loading states ──────────────────────────────────────────────
  if (sessionQuery.isPending) {
    return <TerminalState message="Connecting…" onExit={onExit} />;
  }
  if (!session) {
    return <TerminalState message="Call ended or not found" onExit={onExit} />;
  }
  if (session.endReason === 'forbidden-by-role') {
    return (
      <TerminalState
        message="Call not allowed — this device can't place or receive this call."
        onExit={onExit}
      />
    );
  }
  if (session.endedAt) {
    return <TerminalState message="Call ended" onExit={onExit} />;
  }

  // ── Active call ──────────────────────────────────────────────────────────────
  const status = connectedAtMs === null ? 'Ringing…' : formatElapsed(elapsed);

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-dark text-white">
      <div className="absolute inset-0 bg-gradient-to-br from-surface-dark-elevated via-surface-dark to-primary" />

      {/* Peer avatar (remote video placeholder until the call-engine lands). */}
      <div className="absolute inset-0 grid place-items-center">
        <div
          aria-hidden
          className="grid size-32 place-items-center rounded-full bg-brand-peach text-[56px] text-primary md:size-40"
        >
          {initials(peerName)}
        </div>
      </div>

      {/* Top bar: back + peer identity + call status. */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4 py-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onExit}
            aria-label="Back"
            className="grid size-11 flex-shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20"
          >
            <ArrowLeft className="size-[18px]" />
          </button>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold md:text-base">{peerName}</span>
            <span className="truncate text-xs text-white/70">{peerName}</span>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2 rounded-full bg-white/10 px-3 py-2 backdrop-blur">
          {connectedAtMs !== null && (
            <span aria-hidden className="size-2 animate-pulse rounded-full bg-success" />
          )}
          <span className="font-mono text-[13px]" aria-live="polite">
            {status}
          </span>
        </div>
      </div>

      {/* Self picture-in-picture (local video placeholder). */}
      <div
        aria-hidden
        className="absolute bottom-32 right-4 z-10 grid h-40 w-28 place-items-center overflow-hidden rounded-lg border-2 border-white/30 bg-gradient-to-br from-brand-lavender to-brand-pink text-[40px] md:bottom-32 md:right-6 md:h-56 md:w-40"
      >
        🙂
      </div>

      {/* Call controls. Mute/camera/speaker/swap are presentational until the
          RTCPeerConnection media engine (W1b call-engine) is wired. */}
      <div className="absolute bottom-0 left-0 right-0 z-10 grid place-items-center p-4 md:p-6">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-3 backdrop-blur-lg md:gap-3">
          <button
            type="button"
            onClick={() => undefined}
            aria-label="Mute microphone"
            className="grid size-11 place-items-center rounded-full bg-white/15 hover:bg-white/25 md:size-12"
          >
            <Mic className="size-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => undefined}
            aria-label="Toggle camera"
            className="grid size-11 place-items-center rounded-full bg-white/15 hover:bg-white/25 md:size-12"
          >
            <Video className="size-[18px]" />
          </button>
          <button
            type="button"
            onClick={endCall}
            disabled={end.isPending}
            aria-label="End call"
            className="grid h-11 w-14 place-items-center rounded-full bg-destructive hover:bg-error-strong disabled:opacity-60 md:h-12 md:w-16"
          >
            <PhoneOff className="size-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => undefined}
            aria-label="Toggle speaker"
            className="grid size-11 place-items-center rounded-full bg-white/15 hover:bg-white/25 md:size-12"
          >
            <Volume2 className="size-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => undefined}
            aria-label="Swap picture-in-picture"
            className="grid size-11 place-items-center rounded-full bg-white/15 hover:bg-white/25 md:size-12"
          >
            <RefreshCw className="size-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
