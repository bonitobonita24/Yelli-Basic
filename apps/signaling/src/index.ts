import { env } from './env';
import { createSignalingServer } from './server';

/**
 * Standalone WebSocket signaling server entrypoint (W2b).
 *
 * Topology (q-W2b-01): its own container, Traefik-reverse-proxied at
 * PathPrefix(`/ws`) on ${APP_DOMAIN}, subscribed to the W2a Valkey bus. Next.js
 * 16 standalone emits its own server.js, so hosting `ws` inline would couple a
 * stateful WS process to the web container lifecycle — this is deliberately a
 * separate process.
 */
const handle = createSignalingServer({
  port: env.SIGNALING_PORT,
  authSecret: env.AUTH_SECRET,
  redisUrl: env.REDIS_URL,
  heartbeatTtlSec: env.SIGNALING_HEARTBEAT_TTL_SEC,
});

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[signaling] ${signal} received — closing.`);
  void handle.close().then(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
