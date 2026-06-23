'use client';

import { ArrowLeft, Mic, MicOff, MonitorUp, MonitorX, PhoneOff, UserPlus, Video, VideoOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useCallEngine } from '@/components/call/CallEngineProvider';
import type { SignalingHandle } from '@/hooks/useSignaling';
import { trpc } from '@/lib/trpc/react';

/**
 * Active-call screen (Flow A — in-call) — now a MESH participant grid (up to 3
 * faces) + any number of live screen-share panels (spec §7). Production port of
 * the Phase 3.3 prototype, extended for three-way calling + screen sharing.
 *
 * INHERIT-not-REPLACE: keeps the Clay-token immersive shell (bg-surface-dark,
 * lucide icons, on-dark `white` utilities — same residual-token posture as W7).
 * Visual/Clay polish of the new grid is a SEPARATE later phase.
 *
 * Media wiring: the parent `CallEngineProvider` owns the ONE `useSignaling`
 * instance + the `CallMesh` engine. This screen reads `useCallEngine()` for the
 * participant set, per-peer media, and local/screen streams, attaching each to a
 * `<video>` via `srcObject`. Mic/cam toggles mutate the local tracks; Present is
 * shown only when `canPresent` (desktop getDisplayMedia).
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

/** A single <video> tile that attaches a MediaStream by srcObject. */
function StreamVideo(props: {
  stream: MediaStream | null | undefined;
  muted?: boolean;
  label?: string;
  className?: string;
}): React.JSX.Element {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = props.stream ?? null;
  }, [props.stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={props.muted}
      aria-label={props.label}
      className={props.className}
    />
  );
}

/** Face tile — video when a stream is present, otherwise an avatar placeholder. */
function FaceTile(props: {
  name: string;
  stream: MediaStream | null | undefined;
  muted?: boolean;
  isSelf?: boolean;
}): React.JSX.Element {
  return (
    <div className="relative grid aspect-video min-h-[120px] place-items-center overflow-hidden rounded-lg border border-white/15 bg-surface-dark-elevated">
      {props.stream ? (
        <StreamVideo
          stream={props.stream}
          muted={props.muted}
          label={`${props.name} video`}
          className="h-full w-full bg-black object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="grid size-20 place-items-center rounded-full bg-brand-peach text-3xl text-primary"
        >
          {initials(props.name) || '🙂'}
        </div>
      )}
      <span className="absolute bottom-1.5 left-1.5 max-w-[80%] truncate rounded bg-black/50 px-1.5 py-0.5 text-[11px] text-white">
        {props.name}
        {props.isSelf ? ' (you)' : ''}
      </span>
    </div>
  );
}

/** Compact picker that lists online peers not already in the call. */
function AddPersonPicker(props: {
  excludeIds: string[];
  onPick: (deviceId: string) => void;
  onClose: () => void;
}): React.JSX.Element {
  const listQuery = trpc.devices.list.useQuery(undefined, { refetchInterval: 15_000 });
  const candidates = (listQuery.data ?? []).filter(
    (d) => !props.excludeIds.includes(d.id) && d.archivedAt === null,
  );
  return (
    <div className="absolute inset-x-0 bottom-24 z-20 mx-auto w-[min(92%,28rem)] rounded-lg border border-white/15 bg-surface-dark-elevated p-3 text-white shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">Add someone</span>
        <button type="button" onClick={props.onClose} className="text-xs text-white/70 hover:text-white">
          Close
        </button>
      </div>
      {candidates.length === 0 ? (
        <p className="py-2 text-xs text-white/60">No other devices available.</p>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {candidates.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => props.onPick(d.id)}
                className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-white/10"
              >
                <span
                  aria-hidden
                  className="grid size-7 flex-shrink-0 place-items-center rounded-full bg-brand-lavender text-[11px] font-semibold text-text-primary"
                >
                  {initials(d.displayName)}
                </span>
                <span className="truncate">{d.displayName || 'Unnamed device'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ScreenActiveCall(props: Props): React.JSX.Element {
  const { callSessionId, selfDeviceId, signaling, onExit } = props;
  const engine = useCallEngine();

  const sessionQuery = trpc.calls.byId.useQuery({ id: callSessionId });
  const session = sessionQuery.data ?? null;

  const end = trpc.calls.end.useMutation();

  // Resolve display names for every participant device.
  const devicesQuery = trpc.devices.list.useQuery(undefined, { refetchInterval: 30_000 });
  const nameOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of devicesQuery.data ?? []) map.set(d.id, d.displayName || 'Unnamed device');
    return (id: string): string => map.get(id) ?? '…';
  }, [devicesQuery.data]);

  // Local mic/cam toggle state (mutates the local MediaStream tracks).
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  const localStream = engine.localStream;
  useEffect(() => {
    if (!localStream) return;
    for (const t of localStream.getAudioTracks()) t.enabled = micOn;
  }, [localStream, micOn]);
  useEffect(() => {
    if (!localStream) return;
    for (const t of localStream.getVideoTracks()) t.enabled = camOn;
  }, [localStream, camOn]);

  // Live elapsed timer from connectedAt (ringing shows "Ringing…").
  const connectedAtMs = session?.connectedAt ? new Date(session.connectedAt).getTime() : null;
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (connectedAtMs === null) return undefined;
    const tick = (): void => setElapsed(Math.max(0, Math.round((Date.now() - connectedAtMs) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [connectedAtMs]);

  const endCall = (): void => {
    // Notify every remote participant cooperatively, then persist.
    for (const peerId of engine.remoteMedia.map((m) => m.deviceId)) {
      signaling.sendHangup({ to: peerId, sessionId: callSessionId });
    }
    end.mutate({ id: callSessionId, reason: 'completed' }, { onSettled: onExit });
  };

  // ── Terminal / loading states ──────────────────────────────────────────────
  if (sessionQuery.isPending) return <TerminalState message="Connecting…" onExit={onExit} />;
  if (!session) return <TerminalState message="Call ended or not found" onExit={onExit} />;
  if (session.endReason === 'forbidden-by-role') {
    return (
      <TerminalState
        message="Call not allowed — this device can't place or receive this call."
        onExit={onExit}
      />
    );
  }
  if (session.endedAt) return <TerminalState message="Call ended" onExit={onExit} />;

  // ── Active call ──────────────────────────────────────────────────────────────
  const status = connectedAtMs === null ? 'Ringing…' : formatElapsed(elapsed);

  // Collect screen panels: local screen + every remote screen stream.
  const screenPanels: { id: string; label: string; stream: MediaStream | undefined; isSelf: boolean }[] = [];
  if (engine.screenStream) {
    screenPanels.push({ id: engine.screenStream.id, label: 'Your screen', stream: engine.screenStream, isSelf: true });
  }
  for (const rm of engine.remoteMedia) {
    for (const sid of rm.screenStreamIds) {
      screenPanels.push({ id: sid, label: `${nameOf(rm.deviceId)}'s screen`, stream: engine.getStream(sid), isSelf: false });
    }
  }

  const remotePresent = engine.remoteMedia.length > 0;
  const participantCount = engine.participants.length || (remotePresent ? engine.remoteMedia.length + 1 : 1);
  const callFull = participantCount >= 3;
  const excludeIds = [selfDeviceId, ...engine.remoteMedia.map((m) => m.deviceId)];

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-surface-dark text-white">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-surface-dark-elevated via-surface-dark to-primary" />

      {/* Top bar: back + call status. */}
      <div className="relative z-10 flex items-center justify-between px-4 py-4 md:px-6">
        <button
          type="button"
          onClick={onExit}
          aria-label="Back"
          className="grid size-11 flex-shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20"
        >
          <ArrowLeft className="size-[18px]" />
        </button>
        <div className="flex flex-shrink-0 items-center gap-2 rounded-full bg-white/10 px-3 py-2 backdrop-blur">
          {connectedAtMs !== null && (
            <span aria-hidden className="size-2 animate-pulse rounded-full bg-success" />
          )}
          <span className="font-mono text-[13px]" aria-live="polite">
            {status}
          </span>
        </div>
      </div>

      {/* Main stage: screen panels (if any) above the face strip. */}
      <div className="relative z-10 flex flex-1 flex-col gap-3 overflow-y-auto px-3 pb-28 md:px-6">
        {screenPanels.length > 0 && (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${Math.min(screenPanels.length, 2)}, minmax(0, 1fr))` }}
            aria-label="Shared screens"
          >
            {screenPanels.map((panel) => (
              <div
                key={panel.id}
                className="relative overflow-hidden rounded-lg border border-white/15 bg-black"
              >
                <StreamVideo
                  stream={panel.stream}
                  muted={panel.isSelf}
                  label={panel.label}
                  className="max-h-[50vh] w-full bg-black object-contain"
                />
                <span className="absolute bottom-1.5 left-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[11px] text-white">
                  {panel.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Face tiles: self + each remote participant's camera. */}
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${Math.min(Math.max(participantCount, 1), 2)}, minmax(0, 1fr))`,
          }}
          aria-label="Participants"
        >
          <FaceTile name={nameOf(selfDeviceId)} stream={localStream} muted isSelf />
          {engine.remoteMedia.map((rm) => (
            <FaceTile
              key={rm.deviceId}
              name={nameOf(rm.deviceId)}
              stream={rm.camStreamId ? engine.getStream(rm.camStreamId) : null}
            />
          ))}
        </div>

        {!remotePresent && (
          <p className="text-center text-xs text-white/60">Waiting for the other side to connect…</p>
        )}
      </div>

      {showPicker && (
        <AddPersonPicker
          excludeIds={excludeIds}
          onPick={(id) => {
            engine.addToCall(id);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Call controls. */}
      <div className="absolute bottom-0 left-0 right-0 z-10 grid place-items-center p-4 md:p-6">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-3 backdrop-blur-lg md:gap-3">
          <button
            type="button"
            onClick={() => setMicOn((v) => !v)}
            aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
            aria-pressed={!micOn}
            className="grid size-11 place-items-center rounded-full bg-white/15 hover:bg-white/25 md:size-12"
          >
            {micOn ? <Mic className="size-[18px]" /> : <MicOff className="size-[18px]" />}
          </button>
          <button
            type="button"
            onClick={() => setCamOn((v) => !v)}
            aria-label={camOn ? 'Turn camera off' : 'Turn camera on'}
            aria-pressed={!camOn}
            className="grid size-11 place-items-center rounded-full bg-white/15 hover:bg-white/25 md:size-12"
          >
            {camOn ? <Video className="size-[18px]" /> : <VideoOff className="size-[18px]" />}
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
          {engine.canPresent && (
            <button
              type="button"
              onClick={() => (engine.isPresenting ? engine.stopPresenting() : engine.startPresenting())}
              aria-label={engine.isPresenting ? 'Stop presenting' : 'Present your screen'}
              aria-pressed={engine.isPresenting}
              className="grid size-11 place-items-center rounded-full bg-white/15 hover:bg-white/25 md:size-12"
            >
              {engine.isPresenting ? <MonitorX className="size-[18px]" /> : <MonitorUp className="size-[18px]" />}
            </button>
          )}
          {!callFull && (
            <button
              type="button"
              onClick={() => setShowPicker((v) => !v)}
              aria-label="Add person to call"
              aria-pressed={showPicker}
              className="grid size-11 place-items-center rounded-full bg-white/15 hover:bg-white/25 md:size-12"
            >
              <UserPlus className="size-[18px]" />
            </button>
          )}
        </div>
        {!engine.canPresent && (
          <p className="mt-2 text-center text-[11px] text-white/50">
            Screen sharing is available on desktop browsers only.
          </p>
        )}
      </div>
    </div>
  );
}
