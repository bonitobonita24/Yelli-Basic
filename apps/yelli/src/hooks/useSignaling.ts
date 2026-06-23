'use client';

// W2b-2 — useSignaling: typed client transport for the standalone WebSocket
// signaling server (apps/signaling). Pure transport — no UI deps, no UI
// rendering. Owns the socket lifecycle:
//   - connect on mount (when enabled + url present), authenticate with a
//     freshly-fetched session JWT in the `hello` frame, emit `onReady`
//   - expose typed senders for the 4 WebRTC signal kinds (offer / answer /
//     ice / hangup) — schema-matched to `signalMessageSchema` in
//     @yelli/shared/realtime
//   - keepalive ping every PING_INTERVAL_MS; auto-reconnect with exponential
//     backoff on close
//   - surface server-pushed `signal` / `call-signal` / `peer-offline` / `error`
//     frames to the caller via stable callbacks
//   - on a `session-invalidate` push (server closes the socket with the canonical
//     `unauthorized` + "Session ended." pair — per Step 6 LOCKED hybrid
//     pull+push session-kill, 30s SLO), fire `onSessionKill` so the consumer can
//     `signOut({ redirect: false })` and route to the login screen
//
// Reactivity contract:
//   - The hook reads callbacks via a ref, so a parent rerender that changes
//     callback identity does NOT tear down the socket. Only `enabled`,
//     `deviceId`, and `url` reconnect the socket.
//
// Non-WS surfaces (out of scope for this hook):
//   - The Step 5 LOCKED Valkey pub/sub role-broadcast does NOT cross the
//     client-facing WS protocol (`ServerMessage` carries no `role-change`;
//     apps/signaling/src/server.ts forwards `call-signal` + closes on
//     `session-invalidate`, that's it). Live role-change reactivity for the UI
//     will be wired via the W1b SessionProvider's existing token-refresh path
//     (the jwt callback DB-revalidates per call) plus a tRPC subscription /
//     polling layer, not via this transport hook.

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type CallSignalEvent,
  type ServerMessage,
  type SignalErrorCode,
  type SignalKind,
  type UserRole,
} from '@yelli/shared';


// ─── Public surface ──────────────────────────────────────────────────────────

export type SignalingStatus =
  | 'idle' // disabled, no url, or hook not yet activated
  | 'connecting' // initial dial in progress
  | 'authenticating' // socket open, waiting for `ready` after `hello`
  | 'open' // authenticated, signaling traffic flowing
  | 'reconnecting' // wait-then-retry after an unexpected close
  | 'closed' // intentional shutdown (unmount or `enabled=false`)
  | 'failed'; // terminal — `session-invalidate` or repeated auth failures

export type SignalingCallbacks = {
  /** Fired once after the server accepts the `hello` and returns `ready`. */
  onReady?: (info: { deviceId: string; role: UserRole }) => void;
  /** WebRTC SDP/ICE frame from a peer (server `signal` push). */
  onSignal?: (frame: {
    from: string;
    sessionId: string;
    kind: SignalKind;
    data: unknown;
  }) => void;
  /** Call-session lifecycle (start/connect/end) — produced by `calls.start`/end. */
  onCallSignal?: (event: CallSignalEvent) => void;
  /** Server told us the target device is offline (delivery dropped). */
  onPeerOffline?: (deviceId: string) => void;
  /** Recoverable server error (relayed verbatim — codes per `SignalErrorCode`). */
  onError?: (error: { code: SignalErrorCode; message: string }) => void;
  /**
   * Step 6 LOCKED session-kill push handler. Fires when the server closes the
   * socket with the canonical `unauthorized` + "Session ended." pair. Consumer
   * should `signOut({ redirect: false })` and route to /login. 30s SLO comes
   * from the server-side cache TTL — this hook delivers the push portion.
   */
  onSessionKill?: () => void;
  /** Status transitions — useful for UI banners (Reconnecting…, Disconnected, …). */
  onStatusChange?: (status: SignalingStatus) => void;
};

export type SignalingHandle = {
  status: SignalingStatus;
  /** Send a WebRTC offer (call INITIATION — server enforces role-guard). */
  sendOffer: (input: { to: string; sessionId: string; data: unknown }) => boolean;
  /** Send a WebRTC answer (call ACCEPTANCE). */
  sendAnswer: (input: { to: string; sessionId: string; data: unknown }) => boolean;
  /** Send a single ICE candidate. */
  sendIceCandidate: (input: { to: string; sessionId: string; data: unknown }) => boolean;
  /** Send a hangup notice to the peer (cooperative end). */
  sendHangup: (input: { to: string; sessionId: string; data?: unknown }) => boolean;
};

export type UseSignalingOptions = {
  deviceId: string | null;
  /**
   * Resolves the Auth.js session JWT (the encrypted token the server decodes
   * via @auth/core/jwt). Because the cookie is HttpOnly, the consumer must
   * fetch it via a server-side route (e.g. an internal `/api/auth/ws-token`).
   * Returning `null` aborts the connect attempt.
   */
  getToken: () => Promise<string | null>;
  /** When false, the hook closes any open socket and stays idle. */
  enabled?: boolean;
  /** Override the env URL (mostly for tests). */
  url?: string;
  /** Wire callbacks. */
  callbacks?: SignalingCallbacks;
};

// ─── Internal constants ──────────────────────────────────────────────────────

/** ws close codes the server uses; we treat these as terminal (no reconnect). */
const CLOSE_POLICY_VIOLATION = 1008;

/** Keepalive — sit comfortably under the server's 30s handshake/idle window. */
const PING_INTERVAL_MS = 25_000;

/** Reconnect backoff sequence (ms). Capped at 30s and jittered ±20%. */
const BACKOFF_SCHEDULE_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000] as const;

/** Server "session ended" string is the matchable contract (security.md REALTIME #3). */
const SESSION_KILL_MESSAGE = 'Session ended.' as const;

// ─── Hook ────────────────────────────────────────────────────────────────────

// Same-origin signaling endpoint, derived at runtime. LAN and Cloud both route
// the `/ws` path through the front proxy (Caddy / Traefik) on the SAME origin
// that serves the app, so the browser can compute the URL from window.location
// — no per-deployment build-time value is needed (crucial for LAN, whose IP is
// only known at install time). Returns undefined during SSR (no window). Dev
// overrides this via NEXT_PUBLIC_SIGNALING_URL because its standalone signaling
// server listens on a separate host port, not behind a same-origin proxy.
function deriveSameOriginSignalingUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}

export function useSignaling(opts: UseSignalingOptions): SignalingHandle {
  const { deviceId, getToken, enabled = true, callbacks } = opts;
  // Read process.env.NEXT_PUBLIC_SIGNALING_URL DIRECTLY (not via the `env`
  // module): Next.js statically inlines the literal `process.env.NEXT_PUBLIC_*`
  // token into the client bundle at build time, but cannot inline a property
  // access on an aliased object (`env.X`) — that would resolve to undefined in
  // the browser. Falls back to the same-origin runtime derivation.
  const url =
    opts.url ?? process.env.NEXT_PUBLIC_SIGNALING_URL ?? deriveSameOriginSignalingUrl();

  const [status, setStatus] = useState<SignalingStatus>('idle');

  // Refs that must NOT cause reconnects when they change.
  const callbacksRef = useRef<SignalingCallbacks | undefined>(callbacks);
  callbacksRef.current = callbacks;
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  // Live socket + lifecycle bookkeeping.
  const socketRef = useRef<WebSocket | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const shutdownRef = useRef(false); // true ⇒ intentional close, no reconnect
  const statusRef = useRef<SignalingStatus>('idle');

  const setStatusBoth = useCallback((next: SignalingStatus) => {
    if (statusRef.current === next) return;
    statusRef.current = next;
    setStatus(next);
    callbacksRef.current?.onStatusChange?.(next);
  }, []);

  const clearTimers = useCallback(() => {
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  /** Send a typed `ClientMessage` if the socket is open; returns success. */
  const sendRaw = useCallback((payload: unknown): boolean => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    try {
      socket.send(JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }, []);

  const sendSignal = useCallback(
    (kind: SignalKind, input: { to: string; sessionId: string; data?: unknown }): boolean => {
      if (statusRef.current !== 'open') return false;
      return sendRaw({
        type: 'signal',
        to: input.to,
        sessionId: input.sessionId,
        kind,
        data: input.data,
      });
    },
    [sendRaw],
  );

  // Stable sender API — referentially constant across renders.
  const sendOffer = useCallback(
    (i: { to: string; sessionId: string; data: unknown }) => sendSignal('offer', i),
    [sendSignal],
  );
  const sendAnswer = useCallback(
    (i: { to: string; sessionId: string; data: unknown }) => sendSignal('answer', i),
    [sendSignal],
  );
  const sendIceCandidate = useCallback(
    (i: { to: string; sessionId: string; data: unknown }) => sendSignal('ice', i),
    [sendSignal],
  );
  const sendHangup = useCallback(
    (i: { to: string; sessionId: string; data?: unknown }) => sendSignal('hangup', i),
    [sendSignal],
  );

  // ── Connect / reconnect ────────────────────────────────────────────────────
  useEffect(() => {
    // Idle conditions — do nothing, ensure any prior socket is torn down.
    if (!enabled || !deviceId || !url) {
      shutdownRef.current = true;
      clearTimers();
      const sock = socketRef.current;
      socketRef.current = null;
      if (sock && sock.readyState !== WebSocket.CLOSED) sock.close(1000, 'disabled');
      setStatusBoth('idle');
      return;
    }

    shutdownRef.current = false;
    let cancelled = false;

    const scheduleReconnect = (): void => {
      if (cancelled || shutdownRef.current) return;
      const idx = Math.min(attemptRef.current, BACKOFF_SCHEDULE_MS.length - 1);
      const base = BACKOFF_SCHEDULE_MS[idx] ?? 30_000;
      // ±20% jitter to spread herd reconnects across many tabs/devices.
      const jitter = base * (0.8 + Math.random() * 0.4);
      attemptRef.current += 1;
      setStatusBoth('reconnecting');
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        void dial();
      }, jitter);
    };

    const dial = async (): Promise<void> => {
      if (cancelled || shutdownRef.current) return;
      setStatusBoth('connecting');

      let token: string | null = null;
      try {
        token = await getTokenRef.current();
      } catch {
        token = null;
      }
      if (cancelled || shutdownRef.current) return;
      if (!token) {
        // No credentials — wait the backoff then try again. The consumer is
        // expected to flip `enabled=false` if the user is signed out.
        scheduleReconnect();
        return;
      }

      let socket: WebSocket;
      try {
        socket = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }
      socketRef.current = socket;

      socket.addEventListener('open', () => {
        if (cancelled || socketRef.current !== socket) {
          socket.close(1000, 'stale');
          return;
        }
        setStatusBoth('authenticating');
        // First frame MUST be `hello` — see apps/signaling/src/server.ts:138.
        const ok = (() => {
          try {
            socket.send(JSON.stringify({ type: 'hello', token, deviceId }));
            return true;
          } catch {
            return false;
          }
        })();
        if (!ok) {
          try {
            socket.close(1011, 'send-failed');
          } catch {
            /* noop */
          }
        }
      });

      socket.addEventListener('message', (ev: MessageEvent) => {
        if (socketRef.current !== socket) return;
        let parsed: ServerMessage;
        try {
          parsed = JSON.parse(typeof ev.data === 'string' ? ev.data : '') as ServerMessage;
        } catch {
          return;
        }
        switch (parsed.type) {
          case 'ready': {
            attemptRef.current = 0; // reset backoff after a successful handshake
            setStatusBoth('open');
            // Start keepalive once authenticated.
            if (pingTimerRef.current) clearInterval(pingTimerRef.current);
            pingTimerRef.current = setInterval(() => {
              sendRaw({ type: 'ping' });
            }, PING_INTERVAL_MS);
            callbacksRef.current?.onReady?.({ deviceId: parsed.deviceId, role: parsed.role });
            return;
          }
          case 'signal': {
            callbacksRef.current?.onSignal?.({
              from: parsed.from,
              sessionId: parsed.sessionId,
              kind: parsed.kind,
              data: parsed.data,
            });
            return;
          }
          case 'call-signal': {
            callbacksRef.current?.onCallSignal?.(parsed.event);
            return;
          }
          case 'peer-offline': {
            callbacksRef.current?.onPeerOffline?.(parsed.deviceId);
            return;
          }
          case 'error': {
            // Step 6 LOCKED session-kill — the server pairs `unauthorized` with
            // the canonical "Session ended." string and immediately closes with
            // CLOSE_POLICY_VIOLATION. Fire `onSessionKill` synchronously so the
            // consumer can sign out before the close handler reaches `failed`.
            if (parsed.code === 'unauthorized' && parsed.message === SESSION_KILL_MESSAGE) {
              shutdownRef.current = true;
              callbacksRef.current?.onSessionKill?.();
            }
            callbacksRef.current?.onError?.({ code: parsed.code, message: parsed.message });
            return;
          }
          case 'pong': {
            return;
          }
        }
      });

      socket.addEventListener('close', (ev: CloseEvent) => {
        if (socketRef.current !== socket) return;
        socketRef.current = null;
        if (pingTimerRef.current) {
          clearInterval(pingTimerRef.current);
          pingTimerRef.current = null;
        }
        if (cancelled || shutdownRef.current) {
          setStatusBoth(shutdownRef.current ? 'failed' : 'closed');
          return;
        }
        // The server closes with CLOSE_POLICY_VIOLATION on terminal auth states
        // (auth-failed, device-in-use, session-invalidated) — no point retrying
        // with the same credentials.
        if (ev.code === CLOSE_POLICY_VIOLATION) {
          shutdownRef.current = true;
          setStatusBoth('failed');
          return;
        }
        scheduleReconnect();
      });

      socket.addEventListener('error', () => {
        // Browsers do not surface details for security reasons; the subsequent
        // `close` event drives the recovery path.
      });
    };

    void dial();

    return (): void => {
      cancelled = true;
      shutdownRef.current = true;
      clearTimers();
      const sock = socketRef.current;
      socketRef.current = null;
      if (sock && sock.readyState !== WebSocket.CLOSED) {
        try {
          sock.close(1000, 'unmount');
        } catch {
          /* noop */
        }
      }
    };
    // Only reconnect when the wire-relevant inputs change.
  }, [enabled, deviceId, url, clearTimers, sendRaw, setStatusBoth]);

  return {
    status,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    sendHangup,
  };
}
