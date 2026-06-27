// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * AppShell component test (jsdom) — the role-aware nav chrome. Verifies the admin
 * nav exposes Members/Invitations/Audit/Settings (the Settings entry added with
 * ScreenTenantSettings) while a non-admin sees only Directory. usePathname + signOut
 * are stubbed.
 */
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('next-auth/react', () => ({ signOut: vi.fn() }));

const { AppShell, logoutRedirect } = await import('../AppShell');

type Ctx = Parameters<typeof logoutRedirect>[0];
const lctx = (over: Partial<Ctx>): Ctx =>
  ({ isAdmin: false, isCloudSession: false, brand: null, userLabel: null, tenantId: null, ...over }) as Ctx;

const ctx = (isAdmin: boolean) => ({
  isAdmin,
  brand: { displayName: 'Acme', slug: 'acme', logoUrl: null },
  userLabel: 'Me',
  isCloudSession: true,
});

afterEach(cleanup);

describe('AppShell nav', () => {
  it('exposes the full admin nav (incl. Settings) for admins', () => {
    render(<AppShell ctx={ctx(true) as never}>child</AppShell>);
    for (const label of ['Directory', 'Members', 'Invitations', 'Audit', 'Settings']) {
      expect(screen.getAllByRole('link', { name: label }).length).toBeGreaterThan(0);
    }
  });

  it('shows only Directory for a non-admin (no admin links)', () => {
    render(<AppShell ctx={ctx(false) as never}>child</AppShell>);
    expect(screen.getAllByRole('link', { name: 'Directory' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Members' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull();
  });
});

describe('logoutRedirect — where sign-out lands by session type', () => {
  it('Cloud / account session → /login', () => {
    expect(logoutRedirect(lctx({ isCloudSession: true, isAdmin: false }))).toBe('/login');
    expect(logoutRedirect(lctx({ isCloudSession: true, isAdmin: true }))).toBe('/login');
  });

  it('LAN-anonymous admin (no session + admin) → /admin/login', () => {
    expect(logoutRedirect(lctx({ isCloudSession: false, isAdmin: true }))).toBe('/admin/login');
  });

  it('anonymous device user (no session, not admin) → /login (regression: was /admin/login)', () => {
    expect(logoutRedirect(lctx({ isCloudSession: false, isAdmin: false }))).toBe('/login');
  });
});
