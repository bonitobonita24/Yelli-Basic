"use client";

import { trpc } from "@/lib/trpc-client";

/**
 * Polls trpc.calls.pending every 3s to surface an incoming-call invite
 * targeting any of the current user's active devices. Returns null when none.
 *
 * TODO Phase 7 sub-feature 3d-2: replace polling with Valkey pub/sub WS subscription.
 */
export function useIncomingCall(enabled = true) {
  const { data } = trpc.calls.pending.useQuery(undefined, {
    enabled,
    refetchInterval: enabled ? 3000 : false,
    refetchOnWindowFocus: enabled,
  });
  return data ?? null;
}
