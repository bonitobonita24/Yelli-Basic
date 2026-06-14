'use client';

import { useState } from 'react';

import OverlayNamePicker from '@/components/overlays/OverlayNamePicker';
import { useCallEngine } from '@/components/call/CallEngineProvider';
import { useDeviceName } from '@/lib/device-name';
import { trpc } from '@/lib/trpc/react';

/**
 * First-launch device display-name prompt (PRODUCT.md Flow 6 / Page 5).
 *
 * OWNER REFINEMENT: a fresh device defaults to a generated readable name (e.g.
 * "Swift Heron") instead of the literal "Guest" — see `lib/device-name.ts`. On a
 * device that has never saved a name, this renders `OverlayNamePicker` in first-join
 * (non-cancellable) mode with the generated name PRE-FILLED via `initialName`, so the
 * user can accept it as-is or edit, then Save. Once saved it never re-prompts (the
 * `yelli.device-name` localStorage key gates it).
 *
 * Persistence is localStorage-first per Flow 6 ("saved to localStorage → used in the
 * directory + incoming-call modal"). When this browser ALSO owns a matching device row
 * (its `selfDeviceId` appears in `trpc.devices.list`), we opportunistically mirror the
 * name to the server via `trpc.devices.setDisplayName` so the directory other peers see
 * reflects it and the `device.first_join` audit fires. That mirror is best-effort: a
 * pure LAN-anonymous device-user (no owned row / no session) simply keeps the
 * localStorage name and the mutation is skipped — never a crash.
 *
 * Note OverlayNamePicker's `canSave` requires `trimmed !== initialName.trim()`, i.e.
 * the user must touch the field at least once. We seed the picker with an EMPTY
 * `initialName` (first-join mode → non-cancellable, no X/Esc) and pass the generated
 * default as the input's starting value through `seedValue`, so "accept as-is" still
 * counts as a change against the empty baseline and Save is enabled immediately.
 */
export function DeviceNamePrompt(): React.JSX.Element | null {
  const { selfDeviceId } = useCallEngine();
  const { name, isSet, ready, save } = useDeviceName();
  const [saving, setSaving] = useState(false);

  const setDisplayName = trpc.devices.setDisplayName.useMutation();
  const utils = trpc.useUtils();

  // Not ready (SSR / pre-localStorage) or already named → render nothing.
  if (!ready || isSet || !name) return null;

  const handleSave = (chosen: string): void => {
    setSaving(true);
    // 1) localStorage is the authoritative store for the device-user identity.
    save(chosen);

    // 2) Best-effort server mirror when this browser owns a matching device row.
    void utils.devices.list
      .fetch()
      .then((rows) => {
        const owned = rows.find((d) => d.id === selfDeviceId);
        if (!owned) return; // pure anonymous / no owned row — localStorage is enough.
        return setDisplayName.mutateAsync({ id: owned.id, displayName: chosen }).then(() => {
          void utils.devices.list.invalidate();
        });
      })
      .catch(() => {
        // FORBIDDEN (no session) / offline / no row — localStorage name still stands.
      })
      .finally(() => setSaving(false));
  };

  return (
    <OverlayNamePicker
      // Empty initialName → first-join (non-cancellable) mode; `seedValue` pre-fills
      // the input with the generated readable default so Save is enabled on accept.
      initialName=""
      seedValue={name}
      onSave={handleSave}
      saving={saving}
    />
  );
}
