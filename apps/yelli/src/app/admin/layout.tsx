import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/shell/AppShell';
import { resolveAppShellContext } from '@/lib/server/app-context';

/**
 * Admin-area gate + shell (W1b / S4). Server-side admin guard for `/admin/members`,
 * `/admin/invitations`, `/admin/audit`, and `/admin/settings` — admits Cloud admins (Auth.js
 * `role: 'admin'`) and LAN-anonymous admins (signed `yelli_admin_session` cookie),
 * redirecting everyone else to `/admin/login` (this is the surface the Flow E login
 * pushes to on success — S3a). `/admin/login` itself lives in the `(public)` group,
 * outside this subtree, so it is not gated.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await resolveAppShellContext();
  if (!ctx.isAdmin) redirect('/admin/login');
  return <AppShell ctx={ctx}>{children}</AppShell>;
}
