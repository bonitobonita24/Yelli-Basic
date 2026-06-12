import { Redis } from 'ioredis';
import { WebSocketServer, WebSocket, type RawData } from 'ws';

import {
  BUS_CHANNELS,
  clientMessageSchema,
  tenantIdFromChannel,
  type BusEvent,
  type ServerMessage,
} from '@yelli/shared';

import { authenticateToken } from './auth';
import { CallAuthorizer } from './authorizer';
import { startHeartbeat } from './heartbeat';
import { PeerRegistry, type Peer } from './registry';

const HANDSHAKE_TIMEOUT_MS = 10_000;
const MAX_PAYLOAD_BYTES = 512 * 1024; // SDP + bundled ICE can be large; cap defensively.
const WS_PATH = '/ws';

// ws close codes.
const CLOSE_POLICY_VIOLATION = 1008;

export type SignalingServerOptions = {
  port: number;
  authSecret: string;
  redisUrl: string;
  heartbeatTtlSec: number;
};

export type SignalingServerHandle = {
  close: () => Promise<void>;
};

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

/** Build a Valkey connection (command or subscriber); mirrors @yelli/jobs + the bus contract. */
function createRedis(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: null });
}

export function createSignalingServer(opts: SignalingServerOptions): SignalingServerHandle {
  const registry = new PeerRegistry();
  const authorizer = new CallAuthorizer();

  // Two Valkey connections: a subscriber (cannot issue normal commands) for the
  // cross-instance bus, and a command connection for the health heartbeat.
  const subscriber = createRedis(opts.redisUrl);
  const commands = createRedis(opts.redisUrl);
  subscriber.on('error', (err) => console.error('[signaling] subscriber error:', err.message));
  commands.on('error', (err) => console.error('[signaling] commands error:', err.message));

  const stopHeartbeat = startHeartbeat(commands, opts.heartbeatTtlSec, () => registry.size());

  // ── Cross-instance bus fan-out ──────────────────────────────────────────
  // Subscribe per-tenant only while that tenant has locally-connected peers.
  subscriber.on('message', (channel: string, raw: string) => {
    const tenantId = tenantIdFromChannel(channel);
    if (!tenantId) return;
    let event: BusEvent;
    try {
      event = JSON.parse(raw) as BusEvent;
    } catch {
      return;
    }

    if (event.kind === 'call-signal') {
      authorizer.applyBusEvent(event);
      // Reflect lifecycle to whichever of the pair is connected to THIS instance.
      for (const deviceId of [event.callerDeviceId, event.calleeDeviceId]) {
        const peer = registry.get(tenantId, deviceId);
        if (peer) send(peer.socket, { type: 'call-signal', event });
      }
      return;
    }

    if (event.kind === 'session-invalidate') {
      // Security (security.md REALTIME #3): drop the user's live sockets at once.
      for (const peer of registry.forUser(tenantId, event.userId)) {
        send(peer.socket, { type: 'error', code: 'unauthorized', message: 'Session ended.' });
        peer.socket.close(CLOSE_POLICY_VIOLATION, 'session-invalidated');
      }
    }
  });

  function subscribeTenant(tenantId: string): void {
    void subscriber.subscribe(
      BUS_CHANNELS.callSignal(tenantId),
      BUS_CHANNELS.sessionInvalidate(tenantId),
    );
  }
  function unsubscribeTenant(tenantId: string): void {
    void subscriber.unsubscribe(
      BUS_CHANNELS.callSignal(tenantId),
      BUS_CHANNELS.sessionInvalidate(tenantId),
    );
  }

  // ── WebSocket server ────────────────────────────────────────────────────
  const wss = new WebSocketServer({
    port: opts.port,
    path: WS_PATH,
    maxPayload: MAX_PAYLOAD_BYTES,
  });

  wss.on('connection', (socket: WebSocket) => {
    let peer: Peer | null = null;

    const handshakeTimer = setTimeout(() => {
      if (!peer) {
        send(socket, { type: 'error', code: 'unauthorized', message: 'Handshake timed out.' });
        socket.close(CLOSE_POLICY_VIOLATION, 'handshake-timeout');
      }
    }, HANDSHAKE_TIMEOUT_MS);
    handshakeTimer.unref?.();

    socket.on('message', (raw: RawData) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        send(socket, { type: 'error', code: 'bad_request', message: 'Malformed JSON.' });
        return;
      }

      const result = clientMessageSchema.safeParse(parsed);
      if (!result.success) {
        send(socket, { type: 'error', code: 'bad_request', message: 'Unrecognized message.' });
        return;
      }
      const message = result.data;

      // ── Unauthenticated: the first frame MUST be a valid `hello` ──────────
      if (!peer) {
        if (message.type !== 'hello') {
          send(socket, { type: 'error', code: 'unauthorized', message: 'Authenticate first.' });
          socket.close(CLOSE_POLICY_VIOLATION, 'unauthenticated');
          return;
        }
        void authenticateToken(message.token, opts.authSecret).then((identity) => {
          if (!identity) {
            send(socket, { type: 'error', code: 'unauthorized', message: 'Invalid session.' });
            socket.close(CLOSE_POLICY_VIOLATION, 'auth-failed');
            return;
          }
          clearTimeout(handshakeTimer);
          const candidate: Peer = { socket, deviceId: message.deviceId, identity };
          const wasPresent = registry.hasTenant(identity.tenantId);
          const result = registry.add(candidate);
          if (!result.ok) {
            // deviceId already held by another user in this tenant → refuse (no hijack).
            send(socket, { type: 'error', code: 'unauthorized', message: 'Device already in use.' });
            socket.close(CLOSE_POLICY_VIOLATION, 'device-in-use');
            return;
          }
          peer = candidate;
          if (result.displaced && result.displaced.socket !== socket) {
            result.displaced.socket.close(CLOSE_POLICY_VIOLATION, 'replaced-by-newer-connection');
          }
          if (!wasPresent) subscribeTenant(identity.tenantId);
          send(socket, { type: 'ready', deviceId: peer.deviceId, role: identity.role });
        });
        return;
      }

      // ── Authenticated frames ──────────────────────────────────────────────
      if (message.type === 'ping') {
        send(socket, { type: 'pong' });
        return;
      }

      if (message.type === 'signal') {
        const { tenantId } = peer.identity;
        const from = peer.deviceId;

        // Defense-in-depth call guard: relay only what the authoritative,
        // role-guarded `calls.start` (W2a) authorized on the bus.
        const allowed =
          message.kind === 'offer'
            ? authorizer.canInitiate(from, message.to, message.sessionId)
            : authorizer.canRelay(from, message.to, message.sessionId);
        if (!allowed) {
          send(socket, {
            type: 'error',
            code: message.kind === 'offer' ? 'forbidden_by_role' : 'bad_request',
            message: 'Not authorized for this call session.',
          });
          return;
        }

        const target = registry.get(tenantId, message.to);
        if (!target) {
          send(socket, { type: 'peer-offline', deviceId: message.to });
          return;
        }
        send(target.socket, {
          type: 'signal',
          from,
          sessionId: message.sessionId,
          kind: message.kind,
          data: message.data,
        });
        return;
      }
    });

    const cleanup = (): void => {
      clearTimeout(handshakeTimer);
      if (!peer) return;
      const { tenantId } = peer.identity;
      registry.remove(peer);
      if (!registry.hasTenant(tenantId)) unsubscribeTenant(tenantId);
      peer = null;
    };
    socket.on('close', cleanup);
    socket.on('error', cleanup);
  });

  console.log(`[signaling] listening on :${opts.port}${WS_PATH}`);

  return {
    async close(): Promise<void> {
      stopHeartbeat();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      subscriber.disconnect();
      commands.disconnect();
    },
  };
}
