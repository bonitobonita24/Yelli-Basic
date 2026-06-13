'use client';

import { Phone, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Incoming-call ring overlay (Flow A/B — Receive). Production port of the Phase
 * 3.3 `prototype/src/components/OverlayIncomingCall.tsx` (INHERIT-not-REPLACE —
 * the bespoke overlay is recomposed from shadcn Dialog primitives + Clay
 * semantic tokens; raw hex dropped per ui-rules Rule 3). Wave 7 design-refine #2
 * (eyebrow `<div>` → heading) is satisfied here: "Incoming call" is the radix
 * `DialogTitle` (renders an `<h2>` and is the `aria-labelledby` target).
 *
 * Pure controlled component (same contract as `OverlayNamePicker`): the parent
 * app-shell (W1b call-orchestration) renders this on an inbound `calls.start`
 * fan-out (bus `call-signal` / WS `peer-offline` etc.) and wires:
 *   onAccept  → `trpc.calls.connect` + `useSignaling.sendAnswer`
 *   onReject  → `trpc.calls.end({ reason: 'declined' })` + `useSignaling.sendHangup`
 * Those cross-cutting concerns (the single WS socket + navigation) live in the
 * orchestrator, never in this presentational overlay.
 *
 * Non-cancellable: the user must explicitly Accept or Reject — outside-click,
 * Esc, and the built-in X are all suppressed (you answer the phone, you don't
 * dismiss it).
 */

type Props = {
  callerName: string;
  callerDeviceName: string;
  onAccept: () => void;
  onReject: () => void;
  /** Parent action in-flight (connect/decline mutation) — disables both buttons. */
  busy?: boolean;
};

function initials(name: string): string {
  return name
    .split(' ')
    .flatMap((n) => (n[0] ? [n[0]] : []))
    .slice(0, 2)
    .join('');
}

export default function OverlayIncomingCall(props: Props): React.JSX.Element {
  const { callerName, callerDeviceName, onAccept, onReject, busy = false } = props;

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent
        // Suppress the built-in close (X) — answering is the only exit.
        className="max-w-md [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="items-center text-center">
          <DialogTitle className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Incoming call
          </DialogTitle>
          <DialogDescription className="sr-only">
            {callerName} is calling from {callerDeviceName}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid place-items-center text-center">
          <div
            aria-hidden
            className="grid size-24 place-items-center rounded-full bg-brand-peach text-[32px] font-semibold text-primary"
          >
            {initials(callerName)}
          </div>
          <div className="mt-4 text-xl font-semibold tracking-tight text-foreground">
            {callerName}
          </div>
          <div className="mt-1 text-[13px] text-muted-foreground">{callerDeviceName}</div>
          <p className="mt-4 max-w-[300px] text-xs leading-relaxed text-muted-foreground">
            In-app ring while the tab is open. Native push wakes the device when the app is
            closed (PWA installed only).
          </p>
        </div>

        <div className="flex items-center justify-center gap-8 pt-2">
          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={onReject}
            disabled={busy}
            aria-label="Reject call"
            className="size-16 rounded-full"
          >
            <X className="size-6" />
          </Button>
          <Button
            type="button"
            size="icon"
            onClick={onAccept}
            disabled={busy}
            aria-label="Accept call"
            className="size-16 rounded-full bg-success text-background hover:bg-success-strong"
          >
            <Phone className="size-6" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
