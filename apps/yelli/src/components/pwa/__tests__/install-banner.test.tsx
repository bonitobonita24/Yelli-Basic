// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * InstallBanner component test (jsdom) — PWA install gating (flow #19). Verifies the
 * first-visit no-op (+ flag set), the second-visit beforeinstallprompt → prompt
 * banner, and the 30-day snooze suppression. matchMedia is stubbed (jsdom lacks it);
 * the default jsdom UA is non-iOS so the prompt path is exercised.
 */
vi.mock('next-auth/react', () => ({ useSession: () => ({ status: 'unauthenticated' }) }));
vi.mock('@/lib/device-id', () => ({ useDeviceId: () => 'dev1' }));
vi.mock('@/lib/trpc/react', () => ({
  trpc: { push: { recordInstall: { useMutation: () => ({ mutate: vi.fn() }) } } },
}));

const { InstallBanner } = await import('../install-banner');

afterEach(cleanup);
beforeEach(() => {
  window.localStorage.clear();
  // jsdom has no matchMedia → stub to "not standalone".
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
});

describe('InstallBanner', () => {
  it('renders nothing on first visit but sets the visited flag', () => {
    const { container } = render(<InstallBanner />);
    expect(container).toBeEmptyDOMElement();
    expect(window.localStorage.getItem('yelli_visited')).toBe('1');
  });

  it('shows the prompt banner on a return visit when beforeinstallprompt fires', async () => {
    window.localStorage.setItem('yelli_visited', '1');
    render(<InstallBanner />);
    await act(async () => {
      window.dispatchEvent(new Event('beforeinstallprompt'));
    });
    expect(await screen.findByText('Install Yelli for incoming-call ringing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('stays hidden while snoozed (no banner even if the event fires)', async () => {
    window.localStorage.setItem('yelli_visited', '1');
    window.localStorage.setItem('yelli_install_snoozed_until', String(Date.now() + 86_400_000));
    const { container } = render(<InstallBanner />);
    await act(async () => {
      window.dispatchEvent(new Event('beforeinstallprompt'));
    });
    expect(container).toBeEmptyDOMElement();
  });
});
