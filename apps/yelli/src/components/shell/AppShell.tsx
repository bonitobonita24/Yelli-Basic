'use client';

import { LogOut, Mail, ScrollText, Settings, UserCog, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDeviceName } from '@/lib/device-name';
import type { AppShellContext } from '@/lib/server/app-context';

/**
 * App shell chrome (W1b / S4). Renders the tenant top bar, role-aware navigation,
 * footer, and mobile bottom nav around `{children}`, and mounts the root
 * session-kill listener. Presentational + client-interactive only: the role + brand
 * are resolved server-side and passed in as `ctx` (see `resolveAppShellContext` —
 * the brand can't be fetched client-side because `tenants.get` is auth-gated and
 * blind to LAN-anonymous admins). All colors come from the Clay semantic tokens
 * (ui-rules Rule 3 — zero raw hex); the MOCKUP.jsx layout is preserved.
 */

type NavItem = { href: string; label: string; icon: typeof Users };

function navItems(isAdmin: boolean): NavItem[] {
  const items: NavItem[] = [{ href: '/', label: 'Directory', icon: Users }];
  if (isAdmin) {
    items.push(
      { href: '/admin/members', label: 'Members', icon: UserCog },
      { href: '/admin/invitations', label: 'Invitations', icon: Mail },
      { href: '/admin/audit', label: 'Audit', icon: ScrollText },
      { href: '/admin/settings', label: 'Settings', icon: Settings },
    );
  }
  return items;
}

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

function initials(label: string | null): string {
  if (!label) return '–';
  const parts = label.trim().split(/\s+/);
  const chars = parts.length >= 2 ? parts[0]![0]! + parts[1]![0]! : label.slice(0, 2);
  return chars.toUpperCase();
}

/**
 * Sign out of BOTH admin sessions. The `/api/admin/logout` POST clears the LAN
 * `yelli_admin_session` cookie AND the Auth.js session server-side (the prior
 * client-only `signOut()` cleared only Auth.js, leaving the LAN cookie live so the
 * admin guard silently re-logged the user in on the next navigation). A hard
 * `window.location` navigation — not a client router push — guarantees the server
 * re-reads the now-cleared cookies and the RSC cache can't replay a stale admin
 * shell. We land on `/admin/login` even if the POST throws, so a transient failure
 * never traps the user in an authenticated-looking shell.
 */
async function signOutBothSessions(): Promise<void> {
  try {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
  } finally {
    window.location.assign('/admin/login');
  }
}

export function AppShell({ ctx, children }: { ctx: AppShellContext; children: ReactNode }) {
  const pathname = usePathname();
  const items = navItems(ctx.isAdmin);
  const brandName = ctx.brand?.displayName ?? 'Yelli';
  const brandHost = ctx.brand ? `${ctx.brand.slug}.yelli-basic.powerbyte.app` : 'Dual-mode calling';
  const brandLetter = (ctx.brand?.displayName ?? 'Y').charAt(0).toUpperCase();

  // Top-bar identity. Admins/Cloud users carry a server-resolved `userLabel`. The
  // LAN-anonymous device-user has none server-side, so we fall back to the chosen
  // device name (localStorage, Flow 6) instead of the old indistinguishable "Guest".
  const { name: deviceName } = useDeviceName();
  const displayLabel = ctx.userLabel ?? deviceName ?? 'Guest';

  return (
    <div className="flex min-h-screen flex-col bg-canvas pb-16 md:pb-0">
      {/* Session-kill PUSH listener moved into <CallEngineProvider> (B1 — ONE
          useSignaling instance app-wide). */}
      <header className="flex h-16 w-full items-center justify-between border-b border-border bg-canvas px-4 md:px-6">
        <Link href="/" className="-ml-2 flex h-11 min-w-0 items-center gap-2 px-2">
          {ctx.brand?.logoUrl ? (
            <img
              src={ctx.brand.logoUrl}
              alt=""
              className="h-9 w-9 flex-shrink-0 rounded-[8px] object-cover"
            />
          ) : (
            <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[8px] bg-brand-teal font-semibold text-white">
              {brandLetter}
            </div>
          )}
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold text-text-primary">{brandName}</span>
            <span className="truncate text-xs text-text-muted">{brandHost}</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-[8px] px-3 py-1.5 text-sm font-medium ${
                  active
                    ? 'bg-surface text-text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-11 items-center gap-2 rounded-[12px] px-2 hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-lavender text-xs font-semibold text-text-primary">
              {initials(displayLabel)}
            </div>
            <span className="hidden text-sm font-medium text-text-primary sm:inline">
              {displayLabel}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled className="text-xs text-text-muted">
              {ctx.isAdmin ? 'Admin' : 'Member'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void signOutBothSessions()}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="w-full py-6 text-center text-xs text-text-muted">
        Developed by{' '}
        <a
          href="https://www.powerbyteitsolutions.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-primary underline underline-offset-2"
        >
          Powerbyte IT Solutions
        </a>{' '}
        · © {new Date().getFullYear()}
      </footer>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 grid border-t border-border bg-canvas md:hidden"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex h-16 flex-col items-center justify-center gap-0.5 ${
                active ? 'text-text-primary' : 'text-text-muted'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-semibold leading-none">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
