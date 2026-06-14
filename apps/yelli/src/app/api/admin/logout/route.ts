import { NextResponse } from 'next/server';

import { signOut } from '@/server/auth/config';
import { clearLanAdminSession } from '@/server/auth/lan-admin';

/**
 * Admin sign-out endpoint. A signed-in admin can be authenticated by EITHER of two
 * independent sessions, and a correct sign-out must clear BOTH (BUG: clearing only
 * the Auth.js session left the LAN `yelli_admin_session` cookie live, so the admin
 * layout guard re-recognized it on the next navigation and silently re-logged in):
 *
 *   1. LAN anonymous admin — the HttpOnly `yelli_admin_session` cookie
 *      (`clearLanAdminSession()`, which also expires the cookie + emits
 *      `lan.admin.logout`).
 *   2. Cloud / account mode — the Auth.js v5 session (server-side `signOut`).
 *
 * Both are cleared unconditionally and independently: a LAN admin has no Auth.js
 * session (the `signOut` is a no-op) and a Cloud admin has no LAN cookie (the clear
 * is a no-op), so running both is always safe and always complete.
 *
 * POST-only (mutating + CSRF-safe — never a GET link; security.md). `redirect: false`
 * keeps Auth.js from issuing its own redirect Response so this handler owns the
 * `{ ok: true }` envelope; the client lands on `/admin/login` itself.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(): Promise<NextResponse> {
  // 1. LAN anonymous-admin cookie (no-op when absent).
  await clearLanAdminSession();
  // 2. Auth.js session for Cloud/account-mode users (no-op when absent).
  await signOut({ redirect: false });
  return NextResponse.json({ ok: true });
}
