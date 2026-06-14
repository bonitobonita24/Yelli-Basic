/**
 * FK-safe audit actor mapping (leaf module — NO next-auth / Auth.js imports, so it
 * is freely importable by router unit tests and audit choke points without dragging
 * in the Auth.js runtime).
 *
 * `AuditLog.actorUserId` is a nullable FK to `users`. The LAN anonymous admin's
 * synthetic `ctx.user.id` (`LAN_ADMIN_ACTOR_ID`) has NO `users` row, so writing it
 * verbatim would FK-violate and crash the mutation. `resolveAuditActorId` collapses
 * the sentinel (and null/undefined) → `null` — the system/anonymous-actor shape
 * `lan-admin.ts` already uses for its own `lan.admin.*` events. Real Auth.js user
 * ids pass through unchanged. Every audit write that binds `ctx.user.id` MUST funnel
 * through this.
 */

/**
 * Stable synthetic actor id for the LAN anonymous admin. The LAN edition has no
 * Accounts (no `users` row) — admins authenticate purely via the signed
 * `yelli_admin_session` cookie (lan-admin.ts). This sentinel is the synthetic
 * `ctx.user.id` for LAN-bridged sessions.
 */
export const LAN_ADMIN_ACTOR_ID = '__lan_admin__';

/** Map a `ctx.user.id` → the value safe to write into `AuditLog.actorUserId`. */
export function resolveAuditActorId(userId: string | null | undefined): string | null {
  if (!userId || userId === LAN_ADMIN_ACTOR_ID) return null;
  return userId;
}
