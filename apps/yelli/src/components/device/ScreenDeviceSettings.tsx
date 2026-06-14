'use client';

import { Pencil } from 'lucide-react';
import { useState } from 'react';

import { useCallEngine } from '@/components/call/CallEngineProvider';
import OverlayNamePicker from '@/components/overlays/OverlayNamePicker';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useDeviceName } from '@/lib/device-name';
import { trpc } from '@/lib/trpc/react';

/**
 * Personal device settings (PRODUCT.md `/settings` · Page 7 "Settings drawer").
 *
 * The device-user's OWN surface (distinct from the admin `ScreenAdminMembers`
 * directory) where they can change the display name they chose on first launch
 * (Flow 6 "editable later from Settings"). Reuses the same `OverlayNamePicker` in
 * RENAME mode (current name pre-filled, cancellable). Persistence mirrors the
 * first-launch path: localStorage-first, with a best-effort server mirror when this
 * browser owns a matching device row.
 *
 * Rename-lock: PRODUCT.md describes a global rename-lock toggle, but no such field
 * exists in the schema / no admin toggle is implemented yet (it is unbuilt product
 * surface beyond this task). So rename is currently always available. This component
 * is structured so that when a `renameLocked` signal exists later, it can disable the
 * button and surface the locked state without a rewrite — see the `renameLocked`
 * placeholder below (always false today).
 */
export function ScreenDeviceSettings(): React.JSX.Element {
  const { selfDeviceId } = useCallEngine();
  const { name, ready, save } = useDeviceName();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const setDisplayName = trpc.devices.setDisplayName.useMutation();
  const utils = trpc.useUtils();

  // Placeholder for the (unimplemented) global rename-lock toggle. Always false today;
  // when the toggle lands this becomes a real signal (tenant setting) and the UI below
  // already handles the locked state.
  const renameLocked = false;

  const current = ready ? (name ?? '') : '';

  const handleSave = (chosen: string): void => {
    setSaving(true);
    save(chosen);
    void utils.devices.list
      .fetch()
      .then((rows) => {
        const owned = rows.find((d) => d.id === selfDeviceId);
        if (!owned) return;
        return setDisplayName.mutateAsync({ id: owned.id, displayName: chosen }).then(() => {
          void utils.devices.list.invalidate();
        });
      })
      .catch(() => {
        // No owned row / no session / offline — localStorage name still applies.
      })
      .finally(() => {
        setSaving(false);
        setEditing(false);
      });
  };

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-8 md:px-12 md:py-12">
      <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
      <p className="mt-1 text-sm text-text-muted">
        Manage how you appear to other devices on this network.
      </p>

      <Card className="mt-6 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
              Display name
            </div>
            <div className="mt-1 truncate text-base font-semibold text-text-primary">
              {ready ? current || 'Unnamed device' : '…'}
            </div>
            <div className="mt-1 text-xs text-text-muted">
              This is the name shown in the directory and incoming-call screen.
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setEditing(true)}
            disabled={!ready || renameLocked}
            aria-label="Change display name"
          >
            <Pencil className="mr-2 h-4 w-4" />
            Change
          </Button>
        </div>
        {renameLocked && (
          <p className="mt-3 text-xs text-text-muted" role="note">
            Name changes are locked by your administrator.
          </p>
        )}
      </Card>

      {editing && (
        <OverlayNamePicker
          initialName={current}
          onClose={() => setEditing(false)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}
