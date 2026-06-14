'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Display-name picker overlay (Flow D — Register Device first-join naming, plus
 * the later directory "Edit name" path). Production port of the Phase 3.3
 * `prototype/src/components/OverlayNamePicker.tsx` (INHERIT-not-REPLACE — the
 * bespoke overlay is recomposed from shadcn Dialog primitives + Clay semantic
 * tokens; the controlled-component contract is preserved verbatim).
 *
 * Trigger (Wave 5 lock): the parent app-shell renders this on `device.first_join`
 * with an empty `initialName` → first-join mode (non-cancellable: no Cancel, no X,
 * no overlay/Esc dismissal — the device MUST be named before continuing). When
 * re-opened later to rename, `initialName` is the current name and `onClose` is
 * supplied → cancellable.
 *
 * This stays a pure controlled component: the parent owns the mutation and wires
 * `onSave` to `trpc.devices.setDisplayName` (first_join vs rename branch lives in
 * the router). `saving` lets the parent disable the actions while that call is in
 * flight.
 */

const MAX_LEN = 24;

type Props = {
  /** Current display name; empty string = first-join (non-cancellable) mode. */
  initialName: string;
  /** Called with the trimmed name when the user confirms a changed, non-empty value. */
  onSave: (name: string) => void;
  /** Supplied only in rename mode — enables Cancel / X / outside-click dismissal. */
  onClose?: () => void;
  /** Parent mutation in-flight — disables the actions to prevent double-submit. */
  saving?: boolean;
  /**
   * Optional first-launch pre-fill (PRODUCT.md Flow 6 owner refinement): seeds the
   * input with a generated readable default (e.g. "Swift Heron") WITHOUT changing the
   * first-join baseline. The "changed" check still compares against `initialName`, so
   * with an empty `initialName` + a `seedValue`, accepting the default as-is already
   * counts as a save-able value (the user need not retype it). Has no effect in rename
   * mode (where `initialName` is the current name).
   */
  seedValue?: string;
};

export default function OverlayNamePicker(props: Props): React.JSX.Element {
  const { initialName, onSave, onClose, saving = false, seedValue } = props;
  const [value, setValue] = useState(seedValue ?? initialName);

  const trimmed = value.trim();
  const isFirstJoin = initialName.trim().length === 0;
  const canCancel = !isFirstJoin && typeof onClose === 'function';
  const canSave = trimmed.length > 0 && trimmed !== initialName.trim() && !saving;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && canCancel) onClose?.();
      }}
    >
      <DialogContent
        // Hide the built-in close (X) in non-cancellable first-join mode without
        // touching the shared dialog primitive.
        className={cn('max-w-md', !canCancel && '[&>button]:hidden')}
        onInteractOutside={(e) => {
          if (!canCancel) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (!canCancel) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl tracking-tight">
            What should we call you?
          </DialogTitle>
          <DialogDescription>
            This is the name your colleagues see when you appear in the directory.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={MAX_LEN}
            placeholder="e.g. Maria"
            autoFocus
            aria-label="Your display name"
          />
          <div className="text-xs text-muted-foreground">
            {trimmed.length}/{MAX_LEN} characters
          </div>
        </div>

        <DialogFooter>
          {canCancel && (
            <Button variant="outline" onClick={() => onClose?.()} disabled={saving}>
              Cancel
            </Button>
          )}
          <Button onClick={() => canSave && onSave(trimmed)} disabled={!canSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
