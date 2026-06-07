import Link from 'next/link';

const flows: ReadonlyArray<{
  href: string;
  label: string;
  description: string;
}> = [
  {
    href: '/lan',
    label: 'LAN edition',
    description: 'Anonymous local-network calling — no account required.',
  },
  {
    href: '/cloud',
    label: 'Cloud edition',
    description: 'B2B multi-tenant calling across networks.',
  },
  {
    href: '/admin',
    label: 'Admin console',
    description: 'Tenant + device management, role assignment, audit.',
  },
];

export default function HomePage(): JSX.Element {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-wide text-text-muted">
          Phase 3.3 prototype
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
          Yelli Prototype
        </h1>
        <p className="max-w-prose text-base text-text-secondary">
          Interactive walkthrough of every Core User Flow, wired to a simulated
          backend. Subsequent waves wire LAN, Cloud, and Admin flows on top of
          this scaffold.
        </p>
      </header>

      <nav aria-label="Prototype flow entry points" className="grid gap-4">
        {flows.map((flow) => (
          <Link
            key={flow.href}
            href={flow.href}
            className="rounded-lg bg-surface px-5 py-4 shadow-card transition-colors duration-fast ease-default hover:bg-surface-elevated"
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-lg font-semibold">{flow.label}</span>
              <span className="text-sm text-text-muted">→</span>
            </div>
            <p className="mt-1 text-sm text-text-secondary">
              {flow.description}
            </p>
          </Link>
        ))}
      </nav>

      <footer className="text-xs text-text-muted">
        Scaffold only — flow screens land in Wave 2B+.
      </footer>
    </main>
  );
}
