'use client';

import { LogOut, Mail, ScrollText, UserCog, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { ReactNode } from 'react';

import { SessionKillListener } from '@/components/shell/SessionKillListener';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

export function AppShell({ ctx, children }: { ctx: AppShellContext; children: ReactNode }) {
  const pathname = usePathname();
  const items = navItems(ctx.isAdmin);
  const brandName = ctx.brand?.displayName ?? 'Yelli';
  const brandHost = ctx.brand ? `${ctx.brand.slug}.yelli.app` : 'Dual-mode calling';
  const brandLetter = (ctx.brand?.displayName ?? 'Y').charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen flex-col bg-canvas pb-16 md:pb-0">
      <SessionKillListener />

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
              {initials(ctx.userLabel)}
            </div>
            <span className="hidden text-sm font-medium text-text-primary sm:inline">
              {ctx.userLabel ?? 'Guest'}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled className="text-xs text-text-muted">
              {ctx.isAdmin ? 'Admin' : 'Member'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void signOut({ callbackUrl: '/admin/login' })}>
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
