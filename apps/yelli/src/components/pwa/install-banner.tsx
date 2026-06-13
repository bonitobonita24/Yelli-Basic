'use client';

/**
 * PWA install banner (PRODUCT.md §19/§20, flow #19).
 *
 * Behaviour (verbatim from flow #19):
 *  - First visit: nothing (we set `localStorage.yelli_visited='1'` and wait).
 *  - Second+ visit: if the browser fires `beforeinstallprompt`, intercept it and
 *    show a Clay banner — "Install Yelli for incoming-call ringing" + Install /
 *    Dismiss. Install → `prompt()`; on accept → (Cloud only) `push.recordInstall`
 *    writes the `pwa.install` audit row + the banner clears. Dismiss → 30-day
 *    snooze at `localStorage.yelli_install_snoozed_until`.
 *  - iOS Safari never fires `beforeinstallprompt` → the prompt banner is suppressed
 *    and an "Install Yelli to receive call notifications" hint shows the
 *    Share-sheet → Add-to-Home-Screen walkthrough inline (the spec's "Settings →
 *    Install on iOS" destination page + screenshots isn't built yet — the deferred
 *    ScreenTenantSettings — so the same walkthrough is surfaced inline; no routing
 *    dependency, same UX intent).
 *  - Already installed (`display-mode: standalone` / `navigator.standalone`) →
 *    every install affordance is suppressed.
 *
 * `recordInstall` is a `protectedProcedure` (Cloud-only by W6a design) → it is
 * only fired when the Auth.js session is authenticated; LAN-anonymous installs
 * skip the audit (correct — `pwa.install` is Cloud-only per PROTOTYPE.md §3).
 * Renders nothing on the server / first paint (all detection runs in an effect),
 * so there is no hydration mismatch.
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

import { Button } from '@/components/ui/button';
import { useDeviceId } from '@/lib/device-id';
import { trpc } from '@/lib/trpc/react';

const VISITED_KEY = 'yelli_visited';
const SNOOZE_KEY = 'yelli_install_snoozed_until';
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (flow #19).

/** Minimal `beforeinstallprompt` shape — not in the TS DOM lib. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Mode = 'hidden' | 'prompt' | 'ios';

function isStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS Safari exposes a non-standard `navigator.standalone`.
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIOS(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as a Mac; disambiguate by touch support.
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function inferPlatform(): string {
  const ua = navigator.userAgent;
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  const declared = (uaData?.platform ?? '').toLowerCase();
  if (/iphone|ipad|ipod/i.test(ua) || declared.includes('ios')) return 'ios';
  if (/android/i.test(ua) || declared.includes('android')) return 'android';
  return 'desktop';
}

function snoozeInstall(): void {
  window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
}

export function InstallBanner() {
  const [mode, setMode] = useState<Mode>('hidden');
  const [iosOpen, setIosOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const { status } = useSession();
  const deviceId = useDeviceId();
  const recordInstall = trpc.push.recordInstall.useMutation();

  useEffect(() => {
    if (isStandalone()) return; // already installed — suppress everything.

    // Second-visit gate: only eligible once a prior load has set the flag.
    const isReturnVisit = window.localStorage.getItem(VISITED_KEY) === '1';
    if (!isReturnVisit) window.localStorage.setItem(VISITED_KEY, '1');

    const snoozedUntil = Number(window.localStorage.getItem(SNOOZE_KEY) ?? '0');
    const snoozed = Number.isFinite(snoozedUntil) && snoozedUntil > Date.now();

    const eligible = isReturnVisit && !snoozed;
    if (!eligible) return;

    if (isIOS()) {
      setMode('ios'); // iOS never fires beforeinstallprompt → walkthrough fallback.
      return;
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault(); // stop Chrome's mini-infobar; drive our own banner.
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setMode('prompt');
    };
    const onInstalled = () => {
      setMode('hidden');
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (mode === 'hidden') return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setMode('hidden');
    if (outcome === 'accepted' && status === 'authenticated' && deviceId) {
      // Cloud-only audit (flow #19); best-effort — a failed write never blocks install.
      recordInstall.mutate({ deviceId, platform: inferPlatform() }, { onError: () => undefined });
    }
  };

  const handleDismiss = () => {
    snoozeInstall();
    setMode('hidden');
  };

  return (
    <div className="w-full border-b border-border bg-brand-lavender px-4 py-3 text-text-primary">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium">
          {mode === 'prompt'
            ? 'Install Yelli for incoming-call ringing'
            : 'Install Yelli to receive call notifications'}
        </p>

        {mode === 'prompt' ? (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" onClick={() => void handleInstall()}>
              Install
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              Dismiss
            </Button>
          </div>
        ) : (
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="secondary"
              aria-expanded={iosOpen}
              onClick={() => setIosOpen((v) => !v)}
            >
              {iosOpen ? 'Hide steps' : 'How?'}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              Dismiss
            </Button>
          </div>
        )}
      </div>

      {mode === 'ios' && iosOpen && (
        <ol className="mx-auto mt-2 max-w-3xl list-decimal space-y-1 pl-5 text-xs text-text-secondary">
          <li>Tap the Share button (the square with an up-arrow) in Safari&apos;s toolbar.</li>
          <li>Scroll down and choose &ldquo;Add to Home Screen&rdquo;.</li>
          <li>Tap &ldquo;Add&rdquo; — Yelli now rings for incoming calls like an app.</li>
        </ol>
      )}
    </div>
  );
}
