'use client';

/**
 * Call-engine orchestrator (B1 — device-home call-engine, Flow A).
 *
 * THE single `useSignaling` instance app-wide (q-B1 contract). Folds in the
 * Step 6 session-kill PUSH handler that previously lived in SessionKillListener
 * (now removed) so the WS socket is opened exactly once per session and shared
 * across the entire (app) tree.
 *
 * Responsibilities:
 *   • Single WebSocket (`useSignaling`) — sendOffer/Answer/ICE/Hangup; receives
 *     peer SDP/ICE + `call-signal` lifecycle + `session-invalidate` push.
 *   • RTCPeerConnection lifecycle per call session (offer → answer → ICE) plus
 *     getUserMedia and remote-stream attach to the ScreenActiveCall <video>s.
 *   • LOCKED §20 `?incoming={callSessionId}` deep-link consumer: when the URL
 *     carries that param (SW tap-through from `notificationclick` or fresh open),
 *     fetch `trpc.calls.byId`, mount `OverlayIncomingCall` with the caller's
 *     identity, then on Accept persist via `trpc.calls.connect` + sendAnswer.
 *   • Outgoing-call placement (called by PeerDirectory via the context): start
 *     trpc.calls.start, snap the role-guard (forbidden-by-role → terminal screen),
 *     getUserMedia + create offer, sendOffer, render ScreenActiveCall.
 *   • Session-kill: signOut on the unauthorized/"Session ended." push (30s SLO).
 *
 * Loading states (ui-rules Rule 11): the overlays are short-lived imperative
 * dialogs, the active-call screen owns its own terminal states; no async list
 * surfaces here ⇒ neither Skeleton nor phantom-ui applies (matches W6b posture).
 *
 * Audit policy (per B1 brief): structured pino-shaped console logs only; the
 * server's L5 AuditLog already records the lifecycle in CallSession rows.
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { CallSignalEvent, SignalKind } from '@yelli/shared';

import OverlayIncomingCall from '@/components/overlays/OverlayIncomingCall';
import ScreenActiveCall from '@/components/screens/ScreenActiveCall';
import { useSignaling } from '@/hooks/useSignaling';
import { useDeviceId } from '@/lib/device-id';
import { trpc } from '@/lib/trpc/react';

// ─── Public surface ─────────────────────────────────────────────────────────
export type CallEngineApi = {
  /** Local device id (stable per browser) — null until localStorage resolves. */
  selfDeviceId: string | null;
  /** Place a 1-on-1 call to the named peer device. Idempotent at the engine level. */
  placeCall: (peerDeviceId: string) => void;
  /** True when a call is active (engine is mid-flow). */
  busy: boolean;
};

const CallEngineContext = createContext<CallEngineApi | null>(null);

export function useCallEngine(): CallEngineApi {
  const ctx = useContext(CallEngineContext);
  if (!ctx) throw new Error('useCallEngine() must be rendered inside <CallEngineProvider>.');
  return ctx;
}

// ─── Internals ──────────────────────────────────────────────────────────────

const ICE_SERVERS: RTCIceServer[] = [
  // Open public STUN servers — sufficient for LAN/same-NAT and most home networks.
  // A TURN fallback for symmetric-NAT/restrictive cases is a separate deploy concern
  // (PRODUCT.md non-goals — Open Relay TURN listed in deploy memory).
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

type IncomingFrame = {
  from: string;
  sessionId: string;
  kind: SignalKind;
  data: unknown;
};

/** Light structured logger (pino-shaped) for audit-equivalent observability. */
function log(
  level: 'info' | 'warn' | 'error',
  msg: string,
  fields?: Record<string, unknown>,
): void {
  const entry = { level, msg, t: new Date().toISOString(), ...fields };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn') console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

async function fetchWsToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/ws-token', { method: 'GET', cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as { token?: string | null };
    return body.token ?? null;
  } catch {
    return null;
  }
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function CallEngineProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const selfDeviceId = useDeviceId();

  // Single WebSocket. Late-bound so we can reference `signaling.sendOffer` etc.
  // from RTCPeerConnection event handlers without circular refs.
  const signalingRef = useRef<{
    sendOffer: (i: { to: string; sessionId: string; data: unknown }) => boolean;
    sendAnswer: (i: { to: string; sessionId: string; data: unknown }) => boolean;
    sendIceCandidate: (i: { to: string; sessionId: string; data: unknown }) => boolean;
    sendHangup: (i: { to: string; sessionId: string; data?: unknown }) => boolean;
  } | null>(null);

  // Active call state. Only one call at a time (PRODUCT.md §3 single-flow).
  const [activeCallSessionId, setActiveCallSessionId] = useState<string | null>(null);
  const [incomingCallSessionId, setIncomingCallSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // RTCPeerConnection per active call. Map keyed by sessionId in case of races,
  // but in steady state only ever has one entry.
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  // Pending peer device id per session — needed for ICE/sendAnswer addressing.
  const peerOfSessionRef = useRef<Map<string, string>>(new Map());
  // Self media stream (one local capture shared across calls in the same lifecycle).
  const localStreamRef = useRef<MediaStream | null>(null);
  // Pending remote candidates (arrive before remoteDescription is set).
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const startMutation = trpc.calls.start.useMutation();
  const connectMutation = trpc.calls.connect.useMutation();
  const endMutation = trpc.calls.end.useMutation();

  // ── §20 deep-link: ?incoming=<callSessionId> ───────────────────────────────
  const incomingParam = searchParams?.get('incoming') ?? null;
  // Resolve the incoming session into a real CallSession (security + freshness).
  const incomingQuery = trpc.calls.byId.useQuery(
    { id: incomingParam ?? '' },
    { enabled: Boolean(incomingParam), refetchInterval: 5_000 },
  );
  // Lookup the caller device for the incoming overlay.
  const incomingCallerDeviceId = incomingQuery.data?.callerDeviceId ?? '';
  const callerQuery = trpc.devices.byId.useQuery(
    { id: incomingCallerDeviceId },
    { enabled: incomingCallerDeviceId.length > 0 },
  );

  // ── Local helpers ──────────────────────────────────────────────────────────
  const closeCall = useCallback(
    (sessionId: string) => {
      const pc = pcsRef.current.get(sessionId);
      if (pc) {
        try {
          pc.close();
        } catch {
          /* noop */
        }
        pcsRef.current.delete(sessionId);
      }
      peerOfSessionRef.current.delete(sessionId);
      pendingIceRef.current.delete(sessionId);
      if (activeCallSessionId === sessionId) setActiveCallSessionId(null);
      if (incomingCallSessionId === sessionId) setIncomingCallSessionId(null);
    },
    [activeCallSessionId, incomingCallSessionId],
  );

  const teardownAll = useCallback(() => {
    for (const id of Array.from(pcsRef.current.keys())) closeCall(id);
    const local = localStreamRef.current;
    if (local) {
      for (const t of local.getTracks()) t.stop();
      localStreamRef.current = null;
    }
  }, [closeCall]);

  // Acquire (or reuse) the local mic+camera stream.
  const ensureLocalStream = useCallback(async (): Promise<MediaStream | null> => {
    if (localStreamRef.current) return localStreamRef.current;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      log('error', 'call.media.getUserMedia.failed', { error: String(err) });
      return null;
    }
  }, []);

  // Construct an RTCPeerConnection wired for `sessionId` with peer `peerDeviceId`.
  const makePc = useCallback((sessionId: string, peerDeviceId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerOfSessionRef.current.set(sessionId, peerDeviceId);
    pcsRef.current.set(sessionId, pc);

    pc.onicecandidate = (ev): void => {
      if (!ev.candidate) return;
      const send = signalingRef.current?.sendIceCandidate;
      if (!send) return;
      send({ to: peerDeviceId, sessionId, data: ev.candidate.toJSON() });
    };

    pc.ontrack = (ev): void => {
      // ScreenActiveCall remote-stream attach is via the <video> ref it owns
      // (looked up by [data-remote-stream-target]); we set srcObject directly.
      const target = document.querySelector<HTMLVideoElement>('[data-remote-stream-target]');
      if (target && ev.streams[0]) target.srcObject = ev.streams[0];
    };

    pc.oniceconnectionstatechange = (): void => {
      if (
        pc.iceConnectionState === 'failed' ||
        pc.iceConnectionState === 'disconnected' ||
        pc.iceConnectionState === 'closed'
      ) {
        log('warn', 'call.ice.degraded', { sessionId, state: pc.iceConnectionState });
      }
    };

    return pc;
  }, []);

  // Drain any ICE candidates that arrived before the remoteDescription was set.
  const drainPendingIce = useCallback(async (sessionId: string): Promise<void> => {
    const pending = pendingIceRef.current.get(sessionId);
    if (!pending || pending.length === 0) return;
    const pc = pcsRef.current.get(sessionId);
    if (!pc) return;
    for (const cand of pending) {
      try {
        await pc.addIceCandidate(cand);
      } catch (err) {
        log('warn', 'call.ice.add.failed', { sessionId, error: String(err) });
      }
    }
    pendingIceRef.current.delete(sessionId);
  }, []);

  // ── Signal frame router ────────────────────────────────────────────────────
  const handleSignal = useCallback(
    async (frame: IncomingFrame): Promise<void> => {
      const { from, sessionId, kind, data } = frame;
      log('info', 'call.signal.in', { sessionId, kind, from });

      if (kind === 'offer') {
        // Incoming call — the §20 deep-link overlay handles user consent. The
        // SDP is buffered onto the PC the moment the user Accepts (see acceptIncoming).
        // If we receive an offer for a session we haven't surfaced yet (race with
        // the call-signal `start` arriving first or both racing), surface now.
        setIncomingCallSessionId(sessionId);
        peerOfSessionRef.current.set(sessionId, from);
        // Stash the offer so acceptIncoming() can apply it.
        pendingOffersRef.current.set(sessionId, data as RTCSessionDescriptionInit);
        return;
      }
      if (kind === 'answer') {
        const pc = pcsRef.current.get(sessionId);
        if (!pc) return;
        try {
          await pc.setRemoteDescription(
            new RTCSessionDescription(data as RTCSessionDescriptionInit),
          );
          await drainPendingIce(sessionId);
        } catch (err) {
          log('error', 'call.answer.apply.failed', { sessionId, error: String(err) });
        }
        return;
      }
      if (kind === 'ice') {
        const pc = pcsRef.current.get(sessionId);
        const cand = data as RTCIceCandidateInit;
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(cand);
          } catch (err) {
            log('warn', 'call.ice.add.failed', { sessionId, error: String(err) });
          }
        } else {
          const list = pendingIceRef.current.get(sessionId) ?? [];
          list.push(cand);
          pendingIceRef.current.set(sessionId, list);
        }
        return;
      }
      if (kind === 'hangup') {
        log('info', 'call.peer.hangup', { sessionId });
        closeCall(sessionId);
        return;
      }
    },
    [closeCall, drainPendingIce],
  );

  // Pending incoming SDP offers, awaiting user Accept (Flow B).
  const pendingOffersRef = useRef<Map<string, RTCSessionDescriptionInit>>(new Map());

  const handleCallSignal = useCallback(
    (ev: CallSignalEvent) => {
      // `start` involving us as callee surfaces the ring overlay. `end` from
      // the server (peer hung up via tRPC) tears down.
      if (ev.phase === 'start' && ev.calleeDeviceId === selfDeviceId) {
        setIncomingCallSessionId(ev.sessionId);
        peerOfSessionRef.current.set(ev.sessionId, ev.callerDeviceId);
      }
      if (ev.phase === 'end') closeCall(ev.sessionId);
    },
    [closeCall, selfDeviceId],
  );

  // ── Signaling instance (THE one) ──────────────────────────────────────────
  const signalingCallbacks = useMemo(
    () => ({
      onSignal: handleSignal,
      onCallSignal: handleCallSignal,
      onPeerOffline: (deviceId: string) => log('warn', 'call.peer.offline', { deviceId }),
      onError: (e: { code: string; message: string }) =>
        log('warn', 'signaling.error', { code: e.code, message: e.message }),
      onSessionKill: () => {
        teardownAll();
        // Mode-aware redirect (mirrors AppShell sign-out / app-context.isCloudSession):
        // a force-logged-out Cloud / account-mode user returns to the `/login` account
        // form; a LAN-anonymous admin returns to the `/admin/login` passphrase page.
        // Previously hardcoded to `/admin/login`, which dumped Cloud users on the LAN
        // passphrase screen with no way back to account login (cb9b406 follow-up).
        // Safe to depend on `session`: useSignaling reads callbacks via a ref, so a new
        // callback identity does NOT tear down / reconnect the socket.
        void signOut({ callbackUrl: session?.user ? '/login' : '/admin/login' });
      },
    }),
    [handleSignal, handleCallSignal, teardownAll, session],
  );

  const signaling = useSignaling({
    deviceId: selfDeviceId,
    getToken: fetchWsToken,
    enabled: Boolean(session && selfDeviceId),
    callbacks: signalingCallbacks,
  });
  signalingRef.current = signaling;

  // ── Public API: place a call ───────────────────────────────────────────────
  const placeCall = useCallback(
    (peerDeviceId: string): void => {
      if (!selfDeviceId) {
        log('warn', 'call.place.noSelf', {});
        return;
      }
      if (busy) {
        log('warn', 'call.place.busy', { peerDeviceId });
        return;
      }
      if (peerDeviceId === selfDeviceId) {
        log('warn', 'call.place.selfCall', {});
        return;
      }
      setBusy(true);
      log('info', 'call.place.start', { peerDeviceId });

      startMutation.mutate(
        { callerDeviceId: selfDeviceId, calleeDeviceId: peerDeviceId },
        {
          onSuccess: async (session) => {
            // Server-side role guard already ran. forbidden-by-role → the session
            // comes back already-ended; show it and let the user dismiss.
            if (session.endReason === 'forbidden-by-role') {
              setActiveCallSessionId(session.id);
              setBusy(false);
              log('info', 'call.place.forbidden', { sessionId: session.id });
              return;
            }
            const pc = makePc(session.id, peerDeviceId);
            const stream = await ensureLocalStream();
            if (stream) for (const t of stream.getTracks()) pc.addTrack(t, stream);
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              signalingRef.current?.sendOffer({
                to: peerDeviceId,
                sessionId: session.id,
                data: offer,
              });
              setActiveCallSessionId(session.id);
            } catch (err) {
              log('error', 'call.offer.failed', { sessionId: session.id, error: String(err) });
              closeCall(session.id);
            } finally {
              setBusy(false);
            }
          },
          onError: (err) => {
            log('error', 'call.start.tRPC.failed', { error: err.message });
            setBusy(false);
          },
        },
      );
    },
    [busy, closeCall, ensureLocalStream, makePc, selfDeviceId, startMutation],
  );

  // ── Accept / Reject the §20 incoming overlay ───────────────────────────────
  const acceptIncoming = useCallback(async (): Promise<void> => {
    const sessionId = incomingCallSessionId;
    if (!sessionId) return;
    const peerDeviceId = peerOfSessionRef.current.get(sessionId);
    if (!peerDeviceId) return;
    setBusy(true);
    log('info', 'call.accept.start', { sessionId });

    try {
      // Persist accept (server stamps connectedAt + emits 'connect' on the bus).
      await connectMutation.mutateAsync({ id: sessionId });
      const pc = pcsRef.current.get(sessionId) ?? makePc(sessionId, peerDeviceId);
      const offerSdp = pendingOffersRef.current.get(sessionId);
      const stream = await ensureLocalStream();
      if (stream) for (const t of stream.getTracks()) pc.addTrack(t, stream);
      if (offerSdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
        pendingOffersRef.current.delete(sessionId);
        await drainPendingIce(sessionId);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        signalingRef.current?.sendAnswer({ to: peerDeviceId, sessionId, data: answer });
      }
      setActiveCallSessionId(sessionId);
      setIncomingCallSessionId(null);
      // Clear the §20 deep-link param so a refresh doesn't re-prompt.
      if (incomingParam === sessionId) router.replace('/');
    } catch (err) {
      log('error', 'call.accept.failed', { sessionId, error: String(err) });
    } finally {
      setBusy(false);
    }
  }, [
    connectMutation,
    drainPendingIce,
    ensureLocalStream,
    incomingCallSessionId,
    incomingParam,
    makePc,
    router,
  ]);

  const rejectIncoming = useCallback((): void => {
    const sessionId = incomingCallSessionId;
    if (!sessionId) return;
    const peerDeviceId = peerOfSessionRef.current.get(sessionId);
    setBusy(true);
    log('info', 'call.reject.start', { sessionId });

    endMutation.mutate(
      { id: sessionId, reason: 'declined' },
      {
        onSettled: () => {
          if (peerDeviceId) {
            signalingRef.current?.sendHangup({ to: peerDeviceId, sessionId });
          }
          pendingOffersRef.current.delete(sessionId);
          closeCall(sessionId);
          if (incomingParam === sessionId) router.replace('/');
          setBusy(false);
        },
      },
    );
  }, [closeCall, endMutation, incomingCallSessionId, incomingParam, router]);

  // Activate the §20 deep-link overlay when the param resolves to a fresh,
  // still-ringing session targeted at us.
  useEffect(() => {
    if (!incomingParam) return;
    const data = incomingQuery.data;
    if (!data) return;
    if (data.endedAt) {
      // Ended already (timeout / declined elsewhere) — clear the param silently.
      if (incomingParam === data.id) router.replace('/');
      return;
    }
    if (data.calleeDeviceId !== selfDeviceId) {
      // The deep link is not for this browser (different device on same account).
      router.replace('/');
      return;
    }
    setIncomingCallSessionId(data.id);
    peerOfSessionRef.current.set(data.id, data.callerDeviceId);
  }, [incomingParam, incomingQuery.data, router, selfDeviceId]);

  // Tear everything down on unmount.
  useEffect(() => () => teardownAll(), [teardownAll]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const api = useMemo<CallEngineApi>(
    () => ({ selfDeviceId, placeCall, busy }),
    [selfDeviceId, placeCall, busy],
  );

  const showIncoming = incomingCallSessionId !== null && activeCallSessionId === null;
  const callerName = callerQuery.data?.displayName ?? 'Someone';
  const callerDeviceLabel = callerQuery.data?.displayName ?? 'a device';

  return (
    <CallEngineContext.Provider value={api}>
      {children}
      {showIncoming && (
        <OverlayIncomingCall
          callerName={callerName}
          callerDeviceName={callerDeviceLabel}
          onAccept={() => void acceptIncoming()}
          onReject={rejectIncoming}
          busy={busy}
        />
      )}
      {activeCallSessionId && selfDeviceId && signalingRef.current && (
        <div className="fixed inset-0 z-50">
          <ScreenActiveCall
            callSessionId={activeCallSessionId}
            selfDeviceId={selfDeviceId}
            signaling={{ sendHangup: signalingRef.current.sendHangup }}
            onExit={() => closeCall(activeCallSessionId)}
          />
          {/* Hidden remote-stream attach point — populated by pc.ontrack. */}
          <video
            data-remote-stream-target
            autoPlay
            playsInline
            className="pointer-events-none absolute inset-0 -z-10 h-full w-full bg-brand-teal object-cover opacity-0"
          />
        </div>
      )}
    </CallEngineContext.Provider>
  );
}
