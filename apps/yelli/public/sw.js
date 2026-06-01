/* eslint-disable */
// Yelli service worker — V31 scaffold
// LOCKED Offline Behavior:
//   - cached shell + "Reconnecting…" banner (banner lives in UI; this SW handles fetch fallback)
//   - idempotent mutations queue with UUIDv7 keys; call.invite/accept/reject/end NEVER queued
//   - server dedup via Valkey SET keyed by (actorUserId, idempotencyKey), 24h TTL
// LOCKED Web Push UX:
//   - tap-to-open (focus existing client or open /app?incoming={callSessionId})
//   - NO action buttons (uniform cross-platform incl iOS PWA)
//   - 410 GONE auto-prunes expired endpoints (handled by BullMQ email worker)
//
// Phase 7 will introduce a proper build step (workbox-webpack-plugin or similar)
// to inject precache manifest. For now: minimal cached shell + push handler.

importScripts("https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js");

if (workbox) {
  workbox.core.setCacheNameDetails({ prefix: "yelli", suffix: "v1" });
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  // Cached shell for navigation requests (SPA fallback).
  workbox.routing.registerRoute(
    ({ request }) => request.mode === "navigate",
    new workbox.strategies.NetworkFirst({
      cacheName: "yelli-shell",
      networkTimeoutSeconds: 3,
    })
  );

  // Static assets: stale-while-revalidate.
  workbox.routing.registerRoute(
    ({ request }) =>
      ["style", "script", "image", "font"].includes(request.destination),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: "yelli-assets",
    })
  );

  // API: NEVER cache. Idempotent mutations queue separately (TODO Phase 7).
  workbox.routing.registerRoute(
    ({ url }) => url.pathname.startsWith("/api/"),
    new workbox.strategies.NetworkOnly()
  );
}

// ── Web Push handler ─────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Yelli", body: event.data.text() };
  }
  const { title = "Incoming call", body = "", callSessionId } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: callSessionId || "yelli-call",
      renotify: !!callSessionId,
      requireInteraction: false,
      data: { callSessionId },
    })
  );
});

// LOCKED Web Push UX — tap-to-open: focus existing client or open /app?incoming=
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const callSessionId = event.notification.data?.callSessionId;
  const targetUrl = callSessionId ? `/app?incoming=${callSessionId}` : "/app";

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientsList) {
        if (client.url.includes("/app") && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(targetUrl);
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
    })()
  );
});

// 410 GONE auto-prune is handled server-side by the BullMQ email worker.
// Service worker just logs unexpected errors.
self.addEventListener("error", (event) => {
  console.error("[yelli-sw]", event.message);
});
