import { z } from 'zod';

/**
 * Validated environment. Parsed once at module load. The Docker build sets
 * SKIP_ENV_VALIDATION=1 so `next build` does not require runtime secrets to be
 * present (they are injected at container start).
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  AUTH_SECRET: z.string().min(1),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  // Auth.js v5 derives the URL from the request when trustHost is set; optional.
  NEXTAUTH_URL: z.string().url().optional(),
  // Deployment edition (DECISIONS [Step 1]). LAN = single implicit tenant, subdomain
  // router disabled; Cloud = multi-tenant `<slug>.${APP_BASE_DOMAIN}` routing. The
  // proxy reads these off process.env directly (edge-light); declared here so the
  // Node server validates/documents them.
  EDITION: z.enum(['lan', 'cloud']).default('lan'),
  // Cloud registrable base domain (e.g. `yelli-basic.powerbyte.app`) — required for V25 subdomain
  // slug resolution when EDITION=cloud; ignored on LAN.
  APP_BASE_DOMAIN: z.string().optional(),
  // Public (client-exposed) — optional until the relevant features are wired.
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY: z.string().optional(),
  // WS URL the client useSignaling hook connects to (e.g. `wss://yelli-basic.powerbyte.app/ws`
  // in prod via the Traefik reverse proxy, `ws://localhost:46849/ws` in dev).
  // Optional until W1b wires the calling screens; absent ⇒ the hook stays idle.
  NEXT_PUBLIC_SIGNALING_URL: z.string().url().optional(),
});

type Env = z.infer<typeof schema>;

const skip =
  process.env.SKIP_ENV_VALIDATION === '1' || process.env.SKIP_ENV_VALIDATION === 'true';

// Client-safe subset: only these are inlined into the browser bundle by Next
// (NEXT_PUBLIC_* + NODE_ENV). The server-only vars (AUTH_SECRET / DATABASE_URL /
// REDIS_URL / EDITION / …) are absent client-side BY DESIGN, so validating the full
// schema in a client chunk (e.g. when the useSignaling hook imports `env` for
// NEXT_PUBLIC_SIGNALING_URL) spuriously threw "Invalid environment variables" in the
// browser. On the client we validate only the public subset; the server still
// validates everything.
const clientSchema = schema.pick({
  NODE_ENV: true,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: true,
  NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY: true,
  NEXT_PUBLIC_SIGNALING_URL: true,
});

function load(): Env {
  if (skip) {
    // Build-time: trust the ambient env; runtime container start provides real values.
    return process.env as unknown as Env;
  }
  const isServer = typeof window === 'undefined';
  const parsed = (isServer ? schema : clientSchema).safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }
  return parsed.data as Env;
}

export const env = load();
