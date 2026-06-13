'use client';

import { useEffect } from 'react';

/**
 * Registers the root-scoped Service Worker (/sw.js) once on mount.
 *
 * Rendered from the root layout so the SW (offline app-shell cache + Web Push
 * handler, PRODUCT.md §20/§21) installs on first paint. Registration is the only
 * W6a client concern; the install banner + mutation replay queue land in W6b.
 *
 * No-ops where Service Workers are unavailable (SSR, unsupported browsers, or a
 * non-secure origin) — `serviceWorker` is absent there, so the guard skips cleanly.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('[pwa] service worker registration failed:', err);
    });
  }, []);

  return null;
}
