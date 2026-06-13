'use client';

/**
 * Offline / Reconnecting banner (PRODUCT.md §21 cached-shell offline UX, flow #21).
 *
 * The Service Worker already serves the cached app shell + routes while offline
 * (`public/sw.js` network-first-shell); this is the matching CLIENT affordance —
 * a top-of-viewport banner that tells the user they're running from cache and that
 * any queued mutations will replay on reconnect. Driven off `navigator.onLine` +
 * the `online`/`offline` events (network-level), independent of the call-signaling
 * socket: the WebSocket-specific "Reconnecting…/backoff/Retry-now" + CALL-disable
 * belong to the single `useSignaling` instance the device-home call-engine owns,
 * so they wire there, not here (documented W6b boundary).
 *
 * While reconnecting with items still queued it shows a "Reconnecting…" drain
 * state, clearing once the replay queue empties (`useReplayQueue().pendingCount`).
 * In-flow block (not a fixed overlay) so it never covers the app-shell top bar.
 */

import { useEffect, useState } from 'react';

import { useReplayQueue } from './replay-queue-provider';

export function OfflineBanner() {
  const replay = useReplayQueue();
  const pending = replay?.pendingCount ?? 0;

  // `undefined` until mounted so SSR and the first client paint agree (no hydration
  // mismatch); resolves to the real connectivity on mount.
  const [online, setOnline] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    setOnline(navigator.onLine);
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (online === undefined) return null; // pre-mount: render nothing.

  const offline = !online;
  const reconnecting = online && pending > 0; // back online, queue still draining.

  if (!offline && !reconnecting) return null;

  const message = offline
    ? "You're offline — Yelli is running from your cached app."
    : 'Reconnecting…';

  const queuedNote =
    pending > 0
      ? offline
        ? ` ${pending} action${pending === 1 ? '' : 's'} will retry when you reconnect.`
        : ` Retrying ${pending} action${pending === 1 ? '' : 's'}…`
      : '';

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full border-b border-border bg-brand-teal px-4 py-2 text-center text-xs text-white"
    >
      <span aria-hidden="true">{offline ? '○ ' : '◌ '}</span>
      {message}
      {queuedNote}
    </div>
  );
}
