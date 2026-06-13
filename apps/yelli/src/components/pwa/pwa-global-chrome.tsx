'use client';

/**
 * Globally-mounted PWA client chrome (W6b). Mounted once at the root (inside
 * `Providers` + `ReplayQueueProvider`) so it spans every route:
 *  - OfflineBanner — cached-shell offline / reconnecting indicator (§21).
 *  - ServiceWorkerBridge — SW → client incoming-call tap-through nav (§20).
 *
 * The InstallBanner is intentionally NOT here — flow #19 scopes it to the idle
 * directory, so it mounts in the `(app)` layout instead.
 */

import { OfflineBanner } from './offline-banner';
import { ServiceWorkerBridge } from './service-worker-bridge';

export function PwaGlobalChrome() {
  return (
    <>
      <OfflineBanner />
      <ServiceWorkerBridge />
    </>
  );
}
