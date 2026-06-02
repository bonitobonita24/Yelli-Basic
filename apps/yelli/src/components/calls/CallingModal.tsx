"use client";

import { useEffect, useRef } from "react";
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

interface CallingModalProps {
  open: boolean;
  calleeDisplayName: string;
  callSessionId: string | null;
  onClose: () => void;
}

/** Caller-side modal: "Calling …" + CANCEL + 30s no-answer auto-end. */
export function CallingModal({
  open,
  calleeDisplayName,
  callSessionId,
  onClose,
}: CallingModalProps) {
  const endMutation = trpc.calls.end.useMutation();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any existing timer helper
  function clearTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  // Start 30s no-answer timer when modal opens with a live callSessionId
  useEffect(() => {
    if (!open || !callSessionId) return;

    timerRef.current = setTimeout(() => {
      endMutation.mutate(
        { callSessionId, endReason: EndReason.no_answer },
        { onSettled: onClose },
      );
    }, 30_000);

    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, callSessionId]);

  // Also clear timer when modal closes externally
  useEffect(() => {
    if (!open) clearTimer();
  }, [open]);

  function handleCancel() {
    clearTimer();
    if (callSessionId) {
      endMutation.mutate(
        { callSessionId, endReason: EndReason.cancelled },
        { onSettled: onClose },
      );
    } else {
      // Invite mutation still in-flight — just close; server invite will expire
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleCancel(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Calling…</DialogTitle>
          <DialogDescription>
            Calling <span className="font-medium text-foreground">{calleeDisplayName}</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={endMutation.isPending}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
