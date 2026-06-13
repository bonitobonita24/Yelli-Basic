import type { ReactNode } from 'react';

import { CallEngineProvider } from '@/components/call/CallEngineProvider';
import { InstallBanner } from '@/components/pwa/install-banner';
import { AppShell } from '@/components/shell/AppShell';
import { resolveAppShellContext } from '@/lib/server/app-context';

/**
 * Device-facing layout (W1b / S4 → B1). Wraps the Directory landing (and future
 * device screens) in the app shell + the call-engine orchestrator. Open to every
 * role — the shell shows admin nav links only when `ctx.isAdmin`. Admin-only
 * surfaces live under `/admin/*` behind their own gated layout.
 *
 * `<CallEngineProvider>` owns the SINGLE `useSignaling` instance app-wide (folds
 * in the prior `SessionKillListener` PUSH path) plus the RTCPeerConnection media
 * engine and the LOCKED §20 `?incoming=` deep-link consumer (B1 scope).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await resolveAppShellContext();
  return (
    <CallEngineProvider>
      {/* flow #19: the install banner is scoped to the idle directory, above the shell. */}
      <InstallBanner />
      <AppShell ctx={ctx}>{children}</AppShell>
    </CallEngineProvider>
  );
}
