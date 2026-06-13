import { Phone } from 'lucide-react';
import Link from 'next/link';

import { PeerDirectory } from '@/components/call/PeerDirectory';
import { Card } from '@/components/ui/card';
import { resolveAppShellContext } from '@/lib/server/app-context';

/**
 * Role-aware Directory landing (W1b / S4 → B1).
 *
 * Renders the device "ready to call" hero + the LIVE peer directory (B1) wired to
 * `trpc.devices.list` through `<PeerDirectory>`. The CALL action lives on each
 * peer tile, not on the hero — the hero is the idle/empty state. Admin
 * quick-links render when the viewer is an admin.
 *
 * The single `useSignaling` instance + RTCPeerConnection media engine are owned
 * by `<CallEngineProvider>` (mounted in the `(app)` layout). The §20 `?incoming=`
 * deep-link is consumed by the provider; this page reads no searchParams.
 */
const ADMIN_LINKS = [
  { href: '/admin/members', label: 'Members', hint: 'Manage devices & roles' },
  { href: '/admin/invitations', label: 'Invitations', hint: 'Invite & revoke access' },
  { href: '/admin/audit', label: 'Audit', hint: 'Review the activity log' },
  { href: '/admin/settings', label: 'Settings', hint: 'Organization name & address' },
];

export default async function DirectoryPage() {
  const ctx = await resolveAppShellContext();

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-8 md:px-12 md:py-12">
      <section className="relative grid min-h-[260px] place-items-center overflow-hidden rounded-[24px] bg-brand-teal p-8 text-white md:min-h-[280px] md:p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-teal to-primary opacity-90" />
        <div className="relative z-10 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">
            {ctx.brand?.displayName ?? 'Yelli'}
          </div>
          <div className="mx-auto mt-5 grid h-36 w-36 place-items-center rounded-full bg-white text-text-primary md:h-44 md:w-44">
            <Phone className="h-12 w-12 md:h-14 md:w-14" />
            <div className="mt-1 text-sm font-semibold tracking-[0.08em]">CALL</div>
          </div>
          <p className="mx-auto mt-5 max-w-sm text-sm opacity-80">
            Tap a person below to place a call.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-text-secondary">People you can call</h2>
        <PeerDirectory />
      </section>

      {ctx.isAdmin && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-text-secondary">Admin tools</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {ADMIN_LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                <Card className="h-full p-5 transition hover:border-brand-teal">
                  <div className="text-base font-semibold text-text-primary">{link.label}</div>
                  <div className="mt-1 text-sm text-text-muted">{link.hint}</div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
