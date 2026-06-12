import { decode } from '@auth/core/jwt';

import type { UserRole } from '@yelli/shared';

/**
 * WebSocket handshake authentication.
 *
 * Auth.js v5 is LOCKED to the stateless `jwt` session strategy (apps/yelli
 * auth.ts) — the session token is an encrypted JWE signed/encrypted with
 * AUTH_SECRET, which the web app and this server SHARE. So the signaler verifies
 * a socket by decoding that same token with `@auth/core/jwt` — no DB round-trip,
 * no parallel auth system, single source of truth.
 *
 * The W2b-2 client hook (useSignaling) sends the token it already holds (W1b
 * SessionProvider) in the `hello` frame. The decoded identity gives us the
 * tenant (channel scoping + registry partition), the user (audit/logging), and
 * the account role.
 *
 * NOTE (surfaced NON-BLOCKING, q-W2b-04): the JWT carries User.role
 * (admin|member), NOT Device.callRole. The call-initiation role-guard
 * (`forbidden_by_role`) is therefore enforced in the relay layer against the
 * AUTHORITATIVE, already-role-guarded `call-signal` start events on the Valkey
 * bus (published by the W2a `calls.start` tRPC procedure), not from this token.
 * Binding the asserted deviceId to the authenticated user is a follow-up
 * hardening tied to the (still-unbuilt) device-session model.
 */

export type AuthedIdentity = {
  tenantId: string;
  userId: string;
  role: UserRole;
};

// Auth.js v5 default session cookie names. Secure host (HTTPS prod/stage) uses
// the __Secure- prefix; the dev http host uses the bare name. The salt passed to
// `decode` MUST match the cookie name the web app encoded under, so we try both.
const SESSION_TOKEN_SALTS = [
  '__Secure-authjs.session-token',
  'authjs.session-token',
] as const;

type DecodedToken = {
  userId?: unknown;
  tenantId?: unknown;
  role?: unknown;
};

function isUserRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'member';
}

/**
 * Verify an Auth.js session token. Returns the authenticated identity, or null
 * if the token is missing/expired/tampered/foreign-secret. Never throws.
 */
export async function authenticateToken(
  token: string,
  secret: string,
): Promise<AuthedIdentity | null> {
  if (!token) return null;

  for (const salt of SESSION_TOKEN_SALTS) {
    let payload: DecodedToken | null = null;
    try {
      payload = (await decode({ token, secret, salt })) as DecodedToken | null;
    } catch {
      // Wrong salt / corrupt token → try the next salt, then fail closed.
      continue;
    }
    if (!payload) continue;

    const { userId, tenantId, role } = payload;
    if (typeof userId === 'string' && typeof tenantId === 'string' && isUserRole(role)) {
      return { userId, tenantId, role };
    }
    // Decoded but missing required claims → reject (do not fall through to accept).
    return null;
  }

  return null;
}
