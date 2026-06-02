"use client";

import { EndReason } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc-client";
import { useIncomingCall } from "@/hooks/use-incoming-call";

const RING_WINDOW_MS = 30_000;

/**
 * Self-mounting callee-side modal: polls trpc.calls.pending every 3s.
 * Renders nothing when there is no incoming call.
 *
 * TODO Phase 7 sub-feature 3d-2: replace polling with Valkey pub/sub WS subscription.
 */
export function IncomingCallModal() {
  const incoming = useIncomingCall(true);
  const utils = trpc.useUtils();
  const acceptMutation = trpc.calls.accept.useMutation({
    onSettled: () => void utils.calls.pending.invalidate(),
  });
  const rejectMutation = trpc.calls.reject.useMutation({
    onSettled: () => void utils.calls.pending.invalidate(),
  });

  // Auto-dismiss: if the ringing window has already expired, don't render
  // (caller's no-answer timer will have fired; avoid stale modal flash).
  if (!incoming) return null;

  const elapsed = Date.now() - new Date(incoming.startedAt).getTime();
  if (elapsed > RING_WINDOW_MS) return null;

  function handleAccept() {
    if (!incoming) return;
    acceptMutation.mutate({ callSessionId: incoming.callSessionId });
    // Defer "in-call" UI to 3d-3/3d-4 — for now just dismiss.
  }

  function handleReject() {
    if (!incoming) return;
    rejectMutation.mutate({ callSessionId: incoming.callSessionId });
  }

  const isBusy = acceptMutation.isPending || rejectMutation.isPending;

  return (
    <Dialog open>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Incoming Call</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">
              {incoming.callerDisplayName}
            </span>{" "}
            is calling you
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:justify-center">
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={isBusy}
          >
            Decline
          </Button>
          <Button
            variant="default"
            onClick={handleAccept}
            disabled={isBusy}
          >
            Accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
