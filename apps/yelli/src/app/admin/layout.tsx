import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/shell/AppShell';
import { resolveAppShellContext } from '@/lib/server/app-context';
import { lanAdminConfigured } from '@/server/auth/lan-admin';

/**
 * Admin-area gate + shell (W1b / S4). Server-side admin guard for `/admin/members`,
 * `/admin/invitations`, `/admin/audit`, and `/admin/settings` — admits Cloud admins (Auth.js
 * `role: 'admin'`) and LAN-anonymous admins (signed `yelli_admin_session` cookie).
 *
 * Non-admins are redirected based on LAN setup-state: when NO passphrase is
 * configured yet (fresh LAN deploy, first-run) → `/setup`, so the operator sets the
 * initial passphrase rather than hitting a login they can never pass. When one IS
 * configured → `/admin/login` (the surface Flow E pushes to on success — S3a). On
 * Cloud, `lanAdminConfigured()` is always false, but Cloud admins are already
 * `isAdmin` here; a non-admin Cloud user being sent to `/setup` is harmless — the
 * setup page itself refuses (no LAN tenant) and stays generic.
 *
 * `/setup` and `/admin/login` both live in the `(public)` group, outside this
 * subtree, so neither is gated.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await resolveAppShellContext();
  if (!ctx.isAdmin) {
    redirect((await lanAdminConfigured()) ? '/admin/login' : '/setup');
  }
  return <AppShell ctx={ctx}>{children}</AppShell>;
}
