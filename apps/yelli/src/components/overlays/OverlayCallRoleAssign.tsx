'use client';

import { useState } from 'react';

import type { CallRole } from '@yelli/shared';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc/react';
import { cn } from '@/lib/utils';

/**
 * Assign a device's call role (Flow C — Admin assigns role). Production port of
 * the Phase 3.3 `prototype/src/components/OverlayCallRoleAssign.tsx`
 * (INHERIT-not-REPLACE — recomposed from shadcn Dialog primitives + Clay tokens;
 * raw hex dropped per ui-rules Rule 3). Wave 7 design-refine #2 (eyebrow → heading)
 * is satisfied: "Set call role" is the radix `DialogTitle` (`<h2>`).
 *
 * Self-wired (faithful to the prototype, which self-called `devices.setRole`):
 * the SWAP BOUNDARY `sim.devices.setRole` → `trpc.devices.setRole`. The prototype
 * ALSO hand-appended a second `device.role.assign` audit row to inject the
 * `{from,to}` pair the sim's setRole omitted — that hack is DROPPED. The real
 * server-side `devices.setRole` already emits the §11-canonical
 * `device.role.assign` with the full `{ deviceId, from, to }` payload (W1a), and
 * the client neither can nor should write AuditLog. The "Audit log will record"
 * preview below is display-only and mirrors that server emit verbatim.
 */

// Matches the client device row (DEVICE_SELECT strips tenantId). The directory
// passes a `trpc.devices.list` row, which structurally satisfies this.
type RoleAssignDevice = {
  id: string;
  displayName: string;
  callRole: CallRole;
};

type Props = {
  device: RoleAssignDevice;
  onClose: () => void;
  /** Called after the role change persists (parent refetches the directory). */
  onSaved: () => void;
};

const OPTIONS: ReadonlyArray<{ value: CallRole; label: string; sub: string }> = [
  { value: 'both', label: 'Both', sub: 'Can place and receive calls' },
  { value: 'caller', label: 'Caller only', sub: 'Can only place calls' },
  { value: 'receiver', label: 'Receiver only', sub: 'Can only receive calls' },
];

export default function OverlayCallRoleAssign(props: Props): React.JSX.Element {
  const { device, onClose, onSaved } = props;
  const [selected, setSelected] = useState<CallRole>(device.callRole);

  const setRole = trpc.devices.setRole.useMutation({
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  const isUnchanged = selected === device.callRole;
  const canSave = !isUnchanged && !setRole.isPending;

  const handleSave = (): void => {
    if (!canSave) return;
    // Server emits the §11-canonical `device.role.assign { deviceId, from, to }`.
    setRole.mutate({ id: device.id, role: selected });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !setRole.isPending) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Set call role
          </DialogTitle>
          <DialogDescription className="text-lg font-semibold tracking-tight text-foreground">
            {device.displayName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2" role="radiogroup" aria-label="Call role">
          {OPTIONS.map((opt) => {
            const active = selected === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSelected(opt.value)}
                disabled={setRole.isPending}
                className={cn(
                  'w-full rounded-md border px-4 py-3 text-left transition-colors disabled:opacity-60',
                  active
                    ? 'border-primary bg-primary text-background'
                    : 'border-input bg-surface text-foreground hover:border-primary',
                )}
              >
                <div className="text-sm font-semibold">{opt.label}</div>
                <div className={cn('mt-0.5 text-xs', active ? 'text-background/70' : 'text-muted-foreground')}>
                  {opt.sub}
                </div>
              </button>
            );
          })}
        </div>

        <div className="rounded-md border border-input bg-canvas p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Audit log will record
          </div>
          <div className="mt-1 break-all font-mono text-xs text-text-secondary">
            action=device.role.assign · from={device.callRole} · to={selected} · target=
            {device.displayName}
          </div>
        </div>

        {setRole.isError && (
          <p role="alert" className="text-xs text-error-strong">
            Couldn&apos;t save the role. Please try again.
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={setRole.isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            {setRole.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
