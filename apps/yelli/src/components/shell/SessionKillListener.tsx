'use client';

import { signOut, useSession } from 'next-auth/react';

import { useDeviceId } from '@/lib/device-id';
import { useSignaling } from '@/hooks/useSignaling';

/**
 * Root-mounted session-kill PUSH listener (W1b / S4 — Step 6 LOCKED hybrid push+pull,
 * 30s SLO).
 *
 * Step 6 invalidates a session two ways:
 *   • PULL — the Auth.js jwt/session callback DB-revalidates `securityVersion` +
 *     `isSuspended` on every protected call, so a role/tenant/suspension change
 *     forces re-auth on the next navigation or tRPC call. This path is ALREADY live
 *     (config.ts) and is what guarantees the SLO for normal interaction.
 *   • PUSH — the signaling socket pairs an `unauthorized` frame + "Session ended."
 *     then closes with CLOSE_POLICY_VIOLATION; `useSignaling` recognises that and
 *     fires `onSessionKill`. This component wires that push to an immediate sign-out
 *     so an idle tab is evicted without waiting for the next interaction.
 *
 * Renders nothing — it only owns the listener. It mounts once in the app shell.
 *
 * Lives behind the same idle-until-ready posture S1 shipped `useSignaling` with:
 * the socket only connects when a signaling URL is configured
 * (`NEXT_PUBLIC_SIGNALING_URL`, optional — absent in LAN/dev) AND a device id has
 * resolved. `getToken` fetches the encrypted Auth.js JWT from a server route; that
 * route (`/api/auth/ws-token`) lands with the device-session model (q-W2b-04), so
 * until then `getToken` returns null and the push path stays dormant — the PULL path
 * keeps covering the SLO. No crash, no behaviour change, in either edition.
 */
async function fetchWsToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/ws-token', { method: 'GET' });
    if (!res.ok) return null;
    const body = (await res.json()) as { token?: string };
    return body.token ?? null;
  } catch {
    return null;
  }
}

export function SessionKillListener(): null {
  const { data: session } = useSession();
  const deviceId = useDeviceId();

  useSignaling({
    deviceId,
    getToken: fetchWsToken,
    // Only a signed-in (Cloud) browser with a resolved device id is a session-kill
    // PUSH target. LAN-anonymous admins carry no Auth.js JWT, so `getToken` would
    // return null regardless; gating here avoids the needless connect attempt.
    enabled: Boolean(session && deviceId),
    callbacks: {
      onSessionKill: () => {
        void signOut({ callbackUrl: '/admin/login' });
      },
    },
  });

  return null;
}
