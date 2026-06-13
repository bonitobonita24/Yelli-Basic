import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { auth } from '@/server/auth/config';

/**
 * WS handshake token endpoint (B1 — device-home call-engine wiring).
 *
 * The signaling server (`apps/signaling/src/auth.ts`) verifies a socket by
 * `@auth/core/jwt.decode`-ing the encrypted Auth.js v5 session JWE using the
 * SHARED `AUTH_SECRET`. The web app's HttpOnly cookie carries that exact same
 * JWE, so this route reads the cookie server-side (browser JS cannot) and
 * returns its raw value to the `useSignaling` hook, which forwards it in the
 * WS `hello` frame. No fresh signing, no parallel auth system — just the same
 * token, surfaced for the WS handshake.
 *
 * GATE: the caller must already hold a valid Auth.js session — we re-run
 * `auth()` and 401 if absent. LAN-anonymous admins carry NO Auth.js JWT
 * (Step 6) and are intentionally 401'd: they are not WS push targets, so the
 * signaling engine stays idle for them (the LAN admin cookie is a separate path).
 *
 * SECURITY POSTURE (q-W2b-04 follow-up): returning the raw session JWE to the
 * browser is the same trust the cookie already extends to this origin (only
 * same-origin scripts can fetch it; HTTPS in prod via Traefik, SameSite=lax,
 * `__Secure-` prefix on TLS hosts). The token decodes to `{ userId, tenantId,
 * role }` only — no device-session binding yet (q-W2b-04 deferred). The WS
 * server's role-guard runs against the authoritative `call-signal` bus events
 * (W2a `calls.start` server-side enforcement), so an attacker forging the
 * deviceId in the `hello` frame still cannot bypass the call role guard.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Auth.js v5 cookie names — TLS host uses the `__Secure-` prefix; dev http uses
// the bare name. Order matters: prefer the secure cookie when both happen to be
// set (single decode salt match wins on the WS server side).
const SESSION_COOKIE_NAMES = ['__Secure-authjs.session-token', 'authjs.session-token'] as const;

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ token: null }, { status: 401 });
  }
  const jar = await cookies();
  for (const name of SESSION_COOKIE_NAMES) {
    const value = jar.get(name)?.value;
    if (value) return NextResponse.json({ token: value });
  }
  // Authenticated but no JWE cookie present (extremely unusual — session DB
  // strategy?). Fail closed; the hook treats null as "stay idle".
  return NextResponse.json({ token: null }, { status: 401 });
}
