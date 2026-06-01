"use client";

/**
 * Service worker registration helper.
 *
 * Mount from a client component (e.g. layout) inside a `useEffect`:
 *
 *   useEffect(() => { void registerServiceWorker(); }, []);
 *
 * Skips registration in dev unless explicitly forced — Workbox precaching
 * can interfere with HMR otherwise.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  if (process.env["NODE_ENV"] !== "production" && process.env["NEXT_PUBLIC_FORCE_SW"] !== "true") {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return reg;
  } catch (err) {
    console.error("[yelli] service worker registration failed", err);
    return null;
  }
}

export async function unregisterServiceWorker(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  const regs = await navigator.serviceWorker.getRegistrations();
  let any = false;
  for (const reg of regs) {
    if (await reg.unregister()) any = true;
  }
  return any;
}
