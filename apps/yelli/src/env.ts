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
  // Public (client-exposed) — optional until the relevant features are wired.
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY: z.string().optional(),
});

type Env = z.infer<typeof schema>;

const skip =
  process.env.SKIP_ENV_VALIDATION === '1' || process.env.SKIP_ENV_VALIDATION === 'true';

function load(): Env {
  if (skip) {
    // Build-time: trust the ambient env; runtime container start provides real values.
    return process.env as unknown as Env;
  }
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }
  return parsed.data;
}

export const env = load();
