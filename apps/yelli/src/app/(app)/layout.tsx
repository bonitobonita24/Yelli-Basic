import type { ReactNode } from 'react';

import { AppShell } from '@/components/shell/AppShell';
import { resolveAppShellContext } from '@/lib/server/app-context';

/**
 * Device-facing layout (W1b / S4). Wraps the Directory landing (and future device
 * screens) in the app shell. Open to every role — the shell shows admin nav links
 * only when `ctx.isAdmin`. Admin-only surfaces live under `/admin/*` behind their
 * own gated layout.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await resolveAppShellContext();
  return <AppShell ctx={ctx}>{children}</AppShell>;
}
