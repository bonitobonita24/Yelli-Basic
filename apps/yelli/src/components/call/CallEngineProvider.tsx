'use client';

/**
 * Call-engine orchestrator (B1 — device-home call-engine, Flow A) — now a full
 * MESH engine supporting up to 3 participants + screen sharing (spec 2026-06-24).
 *
 * THE single `useSignaling` instance app-wide (q-B1 contract). Folds in the
 * Step 6 session-kill PUSH handler so the WS socket is opened exactly once per
 * session and shared across the entire (app) tree.
 *
 * The heavy lifting — one `RTCPeerConnection` per (session, peer), glare
 * avoidance, present-signal classification, per-peer teardown — lives in the
 * framework-agnostic `CallMesh` engine (`./call-mesh`). This provider is a thin
 * React shell that: instantiates the mesh once, subscribes to its immutable
 * snapshot, forwards inbound signaling frames into it, and exposes the
 * `CallEngineApi` consumed by PeerDirectory + ScreenActiveCall.
 *
 * Responsibilities:
 *   • Single WebSocket (`useSignaling`) — offer/answer/ICE/hangup/present; receives
 *     peer SDP/ICE + `call-signal` lifecycle + `session-invalidate` push.
 *   • LOCKED §20 `?incoming={callSessionId}` deep-link consumer.
 *   • Group placement (1–2 callees), add-mid-call (ring a 3rd), present/stop.
 *   • Session-kill: signOut on the unauthorized/"Session ended." push (30s SLO).
 *
 * Audit policy: structured pino-shaped console logs only; the server's L5
 * AuditLog already records the lifecycle in CallSession rows.
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

import type { CallSignalEvent, PresentSignal, SignalKind } from '@yelli/shared';

import OverlayIncomingCall from '@/components/overlays/OverlayIncomingCall';
import ScreenActiveCall from '@/components/screens/ScreenActiveCall';
import { useSignaling } from '@/hooks/useSignaling';
import { useDeviceId } from '@/lib/device-id';
import { trpc } from '@/lib/trpc/react';

import {
  CallMesh,
  type MeshSnapshot,
  type RemoteParticipantMedia,
} from './call-mesh';

// ─── Public surface ─────────────────────────────────────────────────────────
export type { RemoteParticipantMedia } from './call-mesh';

export type CallEngineApi = {
  /** Local device id (stable per browser) — null until localStorage resolves. */
  selfDeviceId: string | null;
  /** True when a call is active (engine is mid-flow). */
  busy: boolean;
  /** Participant device ids in the active call INCLUDING self (1..3). [] when idle. */
  participants: string[];
  /** Per-peer inbound media classification for the active call (excludes self). */
  remoteMedia: RemoteParticipantMedia[];
  /** Resolve a streamId to its live MediaStream for `<video>.srcObject` attach. */
  getStream: (streamId: string) => MediaStream | undefined;
  /** Local mic+cam stream (for the self tile), or null. */
  localStream: MediaStream | null;
  /** Local screen-share stream when presenting, or null. */
  screenStream: MediaStream | null;
  isPresenting: boolean;
  /** True only when getDisplayMedia is available (desktop). UI hides Present otherwise. */
  canPresent: boolean;
  /** Place a call. Accepts one peer (1-on-1) or two (group, cap 3). */
  placeCall: (peers: string | string[]) => void;
  /** Add a 3rd participant to the active call (rings them). No-op if full/not in a call. */
  addToCall: (peerDeviceId: string) => void;
  startPresenting: () => void;
  stopPresenting: () => void;
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
  // A TURN fallback for symmetric-NAT/restrictive cases is a separate deploy concern.
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

/** getDisplayMedia is desktop-only (unsupported on iOS/Android browsers). */
function displayMediaAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getDisplayMedia)
  );
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

const EMPTY_SNAPSHOT: MeshSnapshot = { participants: [], remoteMedia: [], isPresenting: false };

// ─── Provider ───────────────────────────────────────────────────────────────

export function CallEngineProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const selfDeviceId = useDeviceId();

  // Single WebSocket. Late-bound so we can reference `signaling.sendOffer` etc.
  // from mesh callbacks without circular refs.
  const signalingRef = useRef<{
    sendOffer: (i: { to: string; sessionId: string; data: unknown }) => boolean;
    sendAnswer: (i: { to: string; sessionId: string; data: unknown }) => boolean;
    sendIceCandidate: (i: { to: string; sessionId: string; data: unknown }) => boolean;
    sendHangup: (i: { to: string; sessionId: string; data?: unknown }) => boolean;
    sendPresent: (i: { to: string; sessionId: string; data: unknown }) => boolean;
  } | null>(null);

  // Active call state. Only one call at a time (PRODUCT.md §3 single-flow).
  const [activeCallSessionId, setActiveCallSessionId] = useState<string | null>(null);
  // Mirror of activeCallSessionId for stable callbacks (signal router) that must
  // read the latest value without re-subscribing — same ref-discipline as the mesh.
  const activeCallSessionIdRef = useRef<string | null>(null);
  activeCallSessionIdRef.current = activeCallSessionId;
  const [incomingCallSessionId, setIncomingCallSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Immutable render snapshot emitted by the mesh.
  const [meshState, setMeshState] = useState<MeshSnapshot>(EMPTY_SNAPSHOT);

  const canPresent = useMemo(() => displayMediaAvailable(), []);

  // Pending incoming SDP offers, awaiting user Accept (Flow B). Keyed by sessionId
  // (offer arrives from the caller before the overlay is accepted).
  const pendingOffersRef = useRef<Map<string, RTCSessionDescriptionInit>>(new Map());
  // Caller device per incoming session (for accept/reject addressing).
  const incomingPeerRef = useRef<Map<string, string>>(new Map());

  const startMutation = trpc.calls.start.useMutation();
  const connectMutation = trpc.calls.connect.useMutation();
  const endMutation = trpc.calls.end.useMutation();
  const addMutation = trpc.calls.add.useMutation();
  const utils = trpc.useUtils();

  // ── §20 deep-link: ?incoming=<callSessionId> ───────────────────────────────
  const incomingParam = searchParams?.get('incoming') ?? null;
  const incomingQuery = trpc.calls.byId.useQuery(
    { id: incomingParam ?? '' },
    { enabled: Boolean(incomingParam), refetchInterval: 5_000 },
  );
  const incomingCallerDeviceId = incomingQuery.data?.callerDeviceId ?? '';
  const callerQuery = trpc.devices.byId.useQuery(
    { id: incomingCallerDeviceId },
    { enabled: incomingCallerDeviceId.length > 0 },
  );

  // ── The mesh engine (one instance for the provider's lifetime) ──────────────
  const meshRef = useRef<CallMesh | null>(null);
  if (meshRef.current === null && selfDeviceId) {
    meshRef.current = new CallMesh({
      selfDeviceId,
      rtcConfig: { iceServers: ICE_SERVERS },
      getLocalStream: async () => {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;
        try {
          return await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        } catch (err) {
          log('error', 'call.media.getUserMedia.failed', { error: String(err) });
          return null;
        }
      },
      getDisplayMedia: async () => {
        if (!displayMediaAvailable()) return null;
        try {
          return await navigator.mediaDevices.getDisplayMedia({ video: true });
        } catch (err) {
          log('info', 'call.present.denied', { error: String(err) });
          return null;
        }
      },
      send: (kind, input) => {
        const s = signalingRef.current;
        if (!s) return false;
        if (kind === 'offer') return s.sendOffer({ ...input, data: input.data });
        if (kind === 'answer') return s.sendAnswer({ ...input, data: input.data });
        if (kind === 'ice') return s.sendIceCandidate({ ...input, data: input.data });
        if (kind === 'hangup') return s.sendHangup(input);
        return s.sendPresent({ ...input, data: input.data });
      },
      onState: (snapshot) => setMeshState(snapshot),
      log,
    });
  }

  // Local end-of-call: when the mesh drops to just self, persist + clear UI.
  const endActiveCall = useCallback((sessionId: string) => {
    meshRef.current?.closeSession(sessionId);
    endMutation.mutate({ id: sessionId, reason: 'completed' });
    setActiveCallSessionId((cur) => (cur === sessionId ? null : cur));
  }, [endMutation]);

  // Wire the mesh's "only self remains" callback to the active-call teardown.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.onEmptyCall = (sessionId): void => {
      log('info', 'call.peer.allLeft', { sessionId });
      endActiveCall(sessionId);
    };
  }, [endActiveCall]);

  // ── Local teardown helpers ──────────────────────────────────────────────────
  const closeCall = useCallback((sessionId: string) => {
    meshRef.current?.closeSession(sessionId);
    pendingOffersRef.current.delete(sessionId);
    incomingPeerRef.current.delete(sessionId);
    setActiveCallSessionId((cur) => (cur === sessionId ? null : cur));
    setIncomingCallSessionId((cur) => (cur === sessionId ? null : cur));
  }, []);

  const teardownAll = useCallback(() => {
    meshRef.current?.teardownAll();
    pendingOffersRef.current.clear();
    incomingPeerRef.current.clear();
    setActiveCallSessionId(null);
    setIncomingCallSessionId(null);
  }, []);

  // ── Signal frame router ─────────────────────────────────────────────────────
  const handleSignal = useCallback(async (frame: IncomingFrame): Promise<void> => {
    const { from, sessionId, kind, data } = frame;
    const mesh = meshRef.current;
    if (!mesh) return;
    log('info', 'call.signal.in', { sessionId, kind, from });

    if (kind === 'offer') {
      // If this is an offer for the active call (e.g. a newcomer the active peer
      // connected to, or mid-call renegotiation), answer immediately. Otherwise it
      // is an incoming-call offer — buffer it for acceptIncoming() and ring.
      const offer = data as RTCSessionDescriptionInit;
      if (mesh.participants().length > 0 && mesh.participants().includes(from)) {
        await mesh.handleOffer(sessionId, from, offer);
        return;
      }
      // Could also be a renegotiation offer from an already-connected peer in the
      // active session (track add). Treat any offer for the ACTIVE session as live.
      if (sessionId === activeCallSessionIdRef.current) {
        await mesh.handleOffer(sessionId, from, offer);
        return;
      }
      // Incoming call — surface the overlay; apply on accept.
      setIncomingCallSessionId(sessionId);
      incomingPeerRef.current.set(sessionId, from);
      pendingOffersRef.current.set(sessionId, offer);
      return;
    }
    if (kind === 'answer') {
      await mesh.handleAnswer(sessionId, from, data as RTCSessionDescriptionInit);
      return;
    }
    if (kind === 'ice') {
      await mesh.handleIce(sessionId, from, data as RTCIceCandidateInit);
      return;
    }
    if (kind === 'present') {
      mesh.handlePresent(sessionId, from, data as PresentSignal);
      return;
    }
    if (kind === 'hangup') {
      log('info', 'call.peer.hangup', { sessionId, from });
      mesh.handleHangupFrom(sessionId, from);
      return;
    }
  }, []);

  const handleCallSignal = useCallback((ev: CallSignalEvent) => {
    if (ev.phase === 'start' && ev.calleeDeviceId === selfDeviceId) {
      setIncomingCallSessionId(ev.sessionId);
      incomingPeerRef.current.set(ev.sessionId, ev.callerDeviceId);
    }
    if (ev.phase === 'end') closeCall(ev.sessionId);
  }, [closeCall, selfDeviceId]);

  // ── Signaling instance (THE one) ────────────────────────────────────────────
  const signalingCallbacks = useMemo(
    () => ({
      onSignal: handleSignal,
      onCallSignal: handleCallSignal,
      onPeerOffline: (deviceId: string) => log('warn', 'call.peer.offline', { deviceId }),
      onError: (e: { code: string; message: string }) =>
        log('warn', 'signaling.error', { code: e.code, message: e.message }),
      onSessionKill: () => {
        teardownAll();
        void signOut({ callbackUrl: '/admin/login' });
      },
    }),
    [handleSignal, handleCallSignal, teardownAll],
  );

  const signaling = useSignaling({
    deviceId: selfDeviceId,
    getToken: fetchWsToken,
    enabled: Boolean(session && selfDeviceId),
    callbacks: signalingCallbacks,
  });
  signalingRef.current = signaling;

  // ── Public API: place a (group) call ────────────────────────────────────────
  const placeCall = useCallback((peers: string | string[]): void => {
    const peerIds = Array.from(new Set(Array.isArray(peers) ? peers : [peers]));
    const mesh = meshRef.current;
    if (!selfDeviceId || !mesh) {
      log('warn', 'call.place.noSelf', {});
      return;
    }
    if (busy) {
      log('warn', 'call.place.busy', { peerIds });
      return;
    }
    if (peerIds.length === 0 || peerIds.length > 2) {
      log('warn', 'call.place.badCount', { count: peerIds.length });
      return;
    }
    if (peerIds.includes(selfDeviceId)) {
      log('warn', 'call.place.selfCall', {});
      return;
    }
    setBusy(true);
    log('info', 'call.place.start', { peerIds });

    startMutation.mutate(
      {
        callerDeviceId: selfDeviceId,
        calleeDeviceId: peerIds[0]!,
        ...(peerIds[1] ? { secondCalleeDeviceId: peerIds[1] } : {}),
      },
      {
        onSuccess: async (created) => {
          if (created.endReason === 'forbidden-by-role') {
            setActiveCallSessionId(created.id);
            setBusy(false);
            log('info', 'call.place.forbidden', { sessionId: created.id });
            return;
          }
          try {
            await mesh.startGroup(created.id, peerIds);
            setActiveCallSessionId(created.id);
          } catch (err) {
            log('error', 'call.place.mesh.failed', { sessionId: created.id, error: String(err) });
            closeCall(created.id);
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
  }, [busy, closeCall, selfDeviceId, startMutation]);

  // ── Public API: add a 3rd participant to the active call ────────────────────
  const addToCall = useCallback((peerDeviceId: string): void => {
    const sessionId = activeCallSessionId;
    const mesh = meshRef.current;
    if (!sessionId || !mesh || !selfDeviceId) return;
    if (mesh.participants().length >= 3) {
      log('warn', 'call.add.full', { sessionId });
      return;
    }
    if (peerDeviceId === selfDeviceId || mesh.participants().includes(peerDeviceId)) return;
    log('info', 'call.add.start', { sessionId, peerDeviceId });
    addMutation.mutate(
      { sessionId, calleeDeviceId: peerDeviceId },
      {
        onSuccess: async () => {
          try {
            await mesh.connectToPeer(sessionId, peerDeviceId);
          } catch (err) {
            log('error', 'call.add.mesh.failed', { sessionId, error: String(err) });
          }
        },
        onError: (err) => {
          if (err.message.startsWith('call_full')) {
            log('warn', 'call.add.full', { sessionId });
          } else {
            log('error', 'call.add.tRPC.failed', { error: err.message });
          }
        },
      },
    );
  }, [activeCallSessionId, addMutation, selfDeviceId]);

  // ── Public API: present / stop ──────────────────────────────────────────────
  const startPresenting = useCallback((): void => {
    const sessionId = activeCallSessionId;
    if (!sessionId) return;
    void meshRef.current?.startPresenting(sessionId);
  }, [activeCallSessionId]);

  const stopPresenting = useCallback((): void => {
    const sessionId = activeCallSessionId;
    if (!sessionId) return;
    meshRef.current?.stopPresenting(sessionId);
  }, [activeCallSessionId]);

  // ── Accept / Reject the §20 incoming overlay ────────────────────────────────
  const acceptIncoming = useCallback(async (): Promise<void> => {
    const sessionId = incomingCallSessionId;
    const mesh = meshRef.current;
    if (!sessionId || !mesh || !selfDeviceId) return;
    const callerDeviceId = incomingPeerRef.current.get(sessionId);
    setBusy(true);
    log('info', 'call.accept.start', { sessionId });

    try {
      await connectMutation.mutateAsync({ id: sessionId });
      // Resolve the FULL participant set (caller + optional third) so a newcomer
      // connects to everyone already in the call (mesh), not just the caller.
      const row = await utils.calls.byId.fetch({ id: sessionId });
      const others = new Set<string>();
      if (row) {
        for (const id of [row.callerDeviceId, row.calleeDeviceId, row.thirdDeviceId]) {
          if (id && id !== selfDeviceId) others.add(id);
        }
      }
      if (callerDeviceId) others.add(callerDeviceId);

      // Apply the buffered caller offer first (if any), then connect to the rest.
      const bufferedOffer = pendingOffersRef.current.get(sessionId);
      if (callerDeviceId && bufferedOffer) {
        await mesh.handleOffer(sessionId, callerDeviceId, bufferedOffer);
        pendingOffersRef.current.delete(sessionId);
        others.delete(callerDeviceId);
      }
      for (const peerId of others) {
         
        await mesh.connectToPeer(sessionId, peerId);
      }

      setActiveCallSessionId(sessionId);
      setIncomingCallSessionId(null);
      if (incomingParam === sessionId) router.replace('/');
    } catch (err) {
      log('error', 'call.accept.failed', { sessionId, error: String(err) });
    } finally {
      setBusy(false);
    }
  }, [connectMutation, incomingCallSessionId, incomingParam, router, selfDeviceId, utils]);

  const rejectIncoming = useCallback((): void => {
    const sessionId = incomingCallSessionId;
    if (!sessionId) return;
    const peerDeviceId = incomingPeerRef.current.get(sessionId);
    setBusy(true);
    log('info', 'call.reject.start', { sessionId });

    endMutation.mutate(
      { id: sessionId, reason: 'declined' },
      {
        onSettled: () => {
          if (peerDeviceId) signalingRef.current?.sendHangup({ to: peerDeviceId, sessionId });
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
      if (incomingParam === data.id) router.replace('/');
      return;
    }
    if (data.calleeDeviceId !== selfDeviceId && data.thirdDeviceId !== selfDeviceId) {
      router.replace('/');
      return;
    }
    setIncomingCallSessionId(data.id);
    incomingPeerRef.current.set(data.id, data.callerDeviceId);
  }, [incomingParam, incomingQuery.data, router, selfDeviceId]);

  // Tear everything down on unmount.
  useEffect(() => {
    const mesh = meshRef.current;
    return () => {
      mesh?.teardownAll();
    };
  }, []);

  // ── Render API ──────────────────────────────────────────────────────────────
  const localStream = meshRef.current?.getLocalStream() ?? null;
  const screenStream = meshRef.current?.getScreenStream() ?? null;
  const getStream = useCallback(
    (streamId: string): MediaStream | undefined => meshRef.current?.getStream(streamId),
    [],
  );

  const api = useMemo<CallEngineApi>(
    () => ({
      selfDeviceId,
      busy,
      participants: meshState.participants,
      remoteMedia: meshState.remoteMedia,
      getStream,
      localStream,
      screenStream,
      isPresenting: meshState.isPresenting,
      canPresent,
      placeCall,
      addToCall,
      startPresenting,
      stopPresenting,
    }),
    [
      selfDeviceId,
      busy,
      meshState,
      getStream,
      localStream,
      screenStream,
      canPresent,
      placeCall,
      addToCall,
      startPresenting,
      stopPresenting,
    ],
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
        </div>
      )}
    </CallEngineContext.Provider>
  );
}
