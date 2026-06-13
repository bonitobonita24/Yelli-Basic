'use client';

import { useEffect, useState } from 'react';

const DEVICE_ID_KEY = 'yelli.device-id';

/**
 * Stable per-browser device identity (W1b / S4).
 *
 * The signaling transport (`useSignaling`) and the W6a push subscription are keyed
 * by a deviceId. This generates one lazily on first use and persists it in
 * localStorage so the same browser keeps a stable identity across reloads.
 *
 * Returns `null` on the server and during the first client render (localStorage is
 * browser-only); the consuming component must treat a null id as "not yet ready"
 * and stay disabled until it resolves. A v4 UUID is sufficient for a stable
 * identifier — the UUIDv7 ordering the offline replay queue needs is a W6b concern,
 * not an identity concern.
 *
 * NOTE: this is a transport/identity convenience only. The authoritative
 * device↔user binding (q-W2b-04) lands with the device-session model; until then
 * the id is advisory and the signaling socket stays idle without a signaling URL.
 */
export function useDeviceId(): string | null {
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    let id = window.localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(DEVICE_ID_KEY, id);
    }
    setDeviceId(id);
  }, []);

  return deviceId;
}
