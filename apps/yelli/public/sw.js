/*
 * Yelli Service Worker — hand-rolled, Workbox-EQUIVALENT (no Workbox dependency).
 *
 * WHY VANILLA (DECISIONS_LOG "PWA Service Worker strategy", q-W6-02):
 *   - next-pwa / the Workbox webpack plugin is incompatible with Next 16 Turbopack.
 *   - The Workbox runtime via importScripts() from a CDN violates the LAN
 *     "offline-by-design" lock (PRODUCT.md §21 — a LAN deployment must never depend
 *     on a public CDN at runtime).
 *   The Workbox INTENT is preserved with three explicit strategies below.
 *
 * STRATEGIES:
 *   1. cache-first   — /_next/static/* (immutable, content-hashed build assets).
 *   2. network-first — navigation requests; on failure serve the cached app shell
 *                      (PRODUCT.md §21 cached-shell offline UX, flow #21).
 *   3. push UX       — `push` shows ONE notification (no action buttons, PRODUCT.md
 *                      §20, flow #20); `notificationclick` focuses an existing client
 *                      and POSTs it `{ type:'incoming-call', callSessionId }` (the
 *                      client bridge soft-navigates), else opens /app?incoming=….
 *
 * This file is plain JS served from /sw.js (NOT bundled by Next) so it has a stable
 * scope at the origin root. W6b adds the client-side install banner + replay queue.
 */

const CACHE_VERSION = 'yelli-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const SHELL_CACHE = `${CACHE_VERSION}-shell`;

// Minimal app shell precached at install so navigation works offline (flow #21).
const APP_SHELL_URLS = ['/', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((stale) => caches.delete(stale)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// cache-first for immutable build assets.
function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      });
    }),
  );
}

// network-first for navigations; fall back to the cached shell when offline.
function networkFirstShell(request) {
  return fetch(request)
    .then((response) => {
      const copy = response.clone();
      caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
      return response;
    })
    .catch(() =>
      caches
        .open(SHELL_CACHE)
        .then((cache) => cache.match(request).then((cached) => cached || cache.match('/'))),
    );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never intercept cross-origin.

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstShell(request));
  }
});

// Web Push — show exactly ONE notification, no action buttons (PRODUCT.md §20).
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || 'Yelli';
  const options = {
    body: payload.body || 'Incoming call',
    tag: payload.tag || 'yelli-call',
    renotify: true,
    // No `actions` — tap-to-open only (PRODUCT.md §20).
    data: { callSessionId: payload.callSessionId || null, url: payload.url || null },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Tap-to-open (PRODUCT.md §20, flow #20): focus an already-open Yelli client and
// POST it `{ type:'incoming-call', callSessionId }` — the client-side bridge
// (service-worker-bridge.tsx) performs the soft in-app navigation. With no open
// client, open the deep link directly; that fresh app reads the `incoming` param.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const callSessionId = data.callSessionId || null;
  const target =
    data.url || (callSessionId ? `/?incoming=${encodeURIComponent(callSessionId)}` : '/');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.postMessage({ type: 'incoming-call', callSessionId });
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
