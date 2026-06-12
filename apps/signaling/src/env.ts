import { z } from 'zod';

import { SIGNALING_HEARTBEAT_TTL_SEC } from '@yelli/shared';

/**
 * Validated environment for the standalone WebSocket signaling server. Parsed
 * once at module load. The Docker build sets SKIP_ENV_VALIDATION=1 so the
 * esbuild bundle step never needs runtime secrets present.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Shared with the web app — the WS handshake decodes the Auth.js session JWT
  // with this secret (Auth.js v5 LOCKED jwt strategy).
  AUTH_SECRET: z.string().min(1),
  // Valkey (MIT Redis fork) — the cross-instance bus the signaler subscribes to.
  REDIS_URL: z.string().url(),
  // Internal listen port. Traefik PathPrefix(`/ws`) reverse-proxies to it in
  // stage/prod; dev maps it to a host port (inputs.yml ports.dev.signaling).
  SIGNALING_PORT: z.coerce.number().int().positive().default(3001),
  // Heartbeat refresh + freshness window read by GET /_pwbt/health.
  SIGNALING_HEARTBEAT_TTL_SEC: z.coerce
    .number()
    .int()
    .positive()
    .default(SIGNALING_HEARTBEAT_TTL_SEC),
});

type Env = z.infer<typeof schema>;

const skip =
  process.env.SKIP_ENV_VALIDATION === '1' || process.env.SKIP_ENV_VALIDATION === 'true';

function load(): Env {
  if (skip) {
    return process.env as unknown as Env;
  }
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error(
      '❌ Invalid signaling environment variables:',
      parsed.error.flatten().fieldErrors,
    );
    throw new Error('Invalid environment variables');
  }
  return parsed.data;
}

export const env = load();
