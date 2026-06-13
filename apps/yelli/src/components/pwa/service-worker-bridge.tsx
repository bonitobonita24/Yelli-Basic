'use client';

/**
 * Service-Worker → client tap-through bridge (PRODUCT.md §20, flow #20).
 *
 * Locked §20 contract: on `notificationclick`, the SW focuses an already-open
 * client and POSTS it `{ type: 'incoming-call', callSessionId }` (the no-client
 * case opens `/app?incoming=…` instead — `public/sw.js`). This component is the
 * client half: it listens for that message and performs a soft in-app navigation
 * to the deep link so the already-open SPA jumps straight to the incoming call.
 *
 * It does NOT consume the call itself — reading `?incoming=` / re-fetching pending
 * call state (`call.pending`) and rendering the Accept/Reject modal is the
 * device-home call-engine's job. This is purely the navigation bridge.
 */

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface IncomingCallMessage {
  type: 'incoming-call';
  callSessionId: string | null;
}

function isIncomingCallMessage(data: unknown): data is IncomingCallMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === 'incoming-call'
  );
}

export function ServiceWorkerBridge() {
  const router = useRouter();

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      if (!isIncomingCallMessage(event.data)) return;
      const { callSessionId } = event.data;
      router.push(callSessionId ? `/app?incoming=${encodeURIComponent(callSessionId)}` : '/app');
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [router]);

  return null;
}
