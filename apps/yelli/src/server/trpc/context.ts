import type { Session } from 'next-auth';

import { auth } from '@/server/auth/config';
import { getLanAdminSession } from '@/server/auth/lan-admin';

import { LAN_ADMIN_ACTOR_ID, resolveAuditActorId } from './audit-actor';

// Re-exported from the next-auth-free leaf module (audit-actor.ts) so router unit
// tests and audit choke points can import the mapping without pulling in the Auth.js
// runtime. Kept exported here for the established import path (`@/server/trpc/context`).
export { LAN_ADMIN_ACTOR_ID, resolveAuditActorId };

/**
 * Stable synthetic actor id for the LAN anonymous admin. The LAN edition has no
 * Accounts (no `users` row) — admins authenticate purely via the signed
 * `yelli_admin_session` cookie (lan-admin.ts). This sentinel is the synthetic
 * `ctx.user.id` for LAN-bridged sessions.
 *
 * ⚠ FK CAVEAT: `AuditLog.actorUserId` carries a FK to `users` (nullable). A
 * synthetic id has no `users` row, so any mutation that writes `ctx.user.id`
 * verbatim into `actorUserId` (e.g. tenants promoteMember) will FK-violate in
 * LAN mode. Audit call-sites that must support LAN admins should map this
 * sentinel → `null` (system/anonymous actor — the same shape lan-admin.ts uses
 * for its own `lan.admin.*` events). The read path (tenants.get) is unaffected.
 */
/**
 * Per-request tRPC context. The Auth.js v5 universal `auth()` reads the JWT
 * session from cookies — no DB hit here; the jwt callback already DB-validates
 * securityVersion + isSuspended on every call (LOCKED V28).
 *
 * LAN BRIDGE: when `auth()` yields no session (LAN edition has no Accounts), fall
 * back to the verified `yelli_admin_session` cookie via `getLanAdminSession()`
 * (HMAC + TTL checked there). A valid LAN cookie is synthesized into a `Session`
 * of the EXACT augmented shape (src/types/next-auth.d.ts) so the UNCHANGED
 * protected-procedure middleware chain (auth → tenant-scope → audit) derives
 * `ctx.user` (role `'admin'`), `ctx.tenantId`, and the L6-scoped `ctx.db` from it
 * with no special-casing. The Auth.js path always takes precedence and is never
 * weakened: the bridge only runs when `auth()` returned null, and the LAN role is
 * pinned to `'admin'` with tenantId taken STRICTLY from the verified cookie (no
 * cross-tenant access, never `super_admin`).
 */
export type Context = {
  session: Session | null;
};

export async function createContext(): Promise<Context> {
  const session = await auth();
  if (session) return { session };

  // Auth.js produced no session — try the LAN anonymous-admin cookie.
  const lan = await getLanAdminSession();
  if (!lan.valid) return { session: null };

  const lanSession: Session = {
    user: {
      id: LAN_ADMIN_ACTOR_ID,
      role: lan.role, // pinned 'admin' by getLanAdminSession — never super_admin
      tenantId: lan.tenantId, // STRICTLY the verified-cookie tenant; no cross-tenant
      tenantSlug: '',
      securityVersion: 0,
      name: 'LAN Admin',
      email: null,
    },
    // The cookie carries its own 30-day TTL (verified in getLanAdminSession); this
    // mirrors the Auth.js `expires` field shape for the Session contract only.
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };

  return { session: lanSession };
}
