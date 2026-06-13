import { Phone } from 'lucide-react';
import Link from 'next/link';

import { Card } from '@/components/ui/card';
import { resolveAppShellContext } from '@/lib/server/app-context';

/**
 * Role-aware Directory landing (W1b / S4) — the shared home screen ("Same screen
 * serves LAN anonymous + Cloud auth + LAN account mode", PROTOTYPE.md Flow B/§3).
 *
 * Renders the device "ready to call" hero for everyone, plus admin quick-links when
 * the viewer is an admin. The live peer directory + the CALL action are presented in
 * their idle state here — wiring them to `devices.list` and the RTCPeerConnection
 * media engine is the dedicated device-home session (the broader W1b call engine,
 * out of this app-shell title's scope). The shell chrome + role-aware nav are
 * supplied by the `(app)` layout.
 */
const ADMIN_LINKS = [
  { href: '/admin/members', label: 'Members', hint: 'Manage devices & roles' },
  { href: '/admin/invitations', label: 'Invitations', hint: 'Invite & revoke access' },
  { href: '/admin/audit', label: 'Audit', hint: 'Review the activity log' },
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
            Your directory and calling are connecting. Tap a person, then CALL — wiring lands with
            the device session.
          </p>
        </div>
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
