import { cookies } from 'next/headers';

/**
 * LAN Anonymous Admin hook (LOCKED: LAN Anonymous Admin). The LAN edition has no
 * accounts — a single Argon2id passphrase on `Tenant.adminPassphraseHash` gates
 * `/admin/*` + `/setup` via an HttpOnly `yelli_admin_session` cookie (30-day
 * rolling, SameSite=Lax, Secure on HTTPS). Login is rate-limited 5/min/IP; reset
 * runs via `./scripts/reset-admin-passphrase.sh` on the host.
 *
 * Skeleton: the Wire session adds argon2.verify against the tenant passphrase
 * hash, signed-token issue/rotation on the cookie, and the 5/min/IP limiter.
 */
export const LAN_ADMIN_COOKIE = 'yelli_admin_session';

export async function getLanAdminSession(): Promise<{ valid: boolean }> {
  const store = await cookies();
  const token = store.get(LAN_ADMIN_COOKIE)?.value;
  // TODO (Wire): verify the signed token → resolve the implicit LAN tenant →
  // check argon2 passphrase epoch. Until wired, presence-only (always re-gated).
  return { valid: Boolean(token) };
}
