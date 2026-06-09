'use client';

import { useState } from 'react';
import { auditLog, devices, type CallRole, type Device } from '@/lib/sim';

interface OverlayCallRoleAssignProps {
  device: Device;
  onClose: () => void;
  onSaved: () => void;
}

const OPTIONS: Array<{ value: CallRole; label: string; sub: string }> = [
  { value: 'both', label: 'Both', sub: 'Can place and receive calls' },
  { value: 'caller', label: 'Caller only', sub: 'Can only place calls' },
  { value: 'receiver', label: 'Receiver only', sub: 'Can only receive calls' },
];

function OverlayCallRoleAssign({ device, onClose, onSaved }: OverlayCallRoleAssignProps): JSX.Element {
  const [selected, setSelected] = useState<CallRole>(device.callRole);
  const isUnchanged = selected === device.callRole;

  const handleSave = (): void => {
    if (isUnchanged) return;
    const fromRole = device.callRole;
    devices.setRole(device.id, selected, 'admin-prototype');
    // devices.setRole already appends a device.role.assign audit, but its payload
    // omits the explicit {from, to} pair PRODUCT.md §11 mandates for Flow C.
    // Append a second, fully-specified entry so the audit preview matches reality.
    auditLog.append({
      tenantId: device.tenantId,
      actorUserId: 'admin-prototype',
      action: 'device.role.assign',
      payload: { from: fromRole, to: selected, deviceId: device.id, displayName: device.displayName },
    });
    onSaved();
    onClose();
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="overlay-role-assign-title" className="fixed inset-0 z-50 bg-black/40 grid place-items-center px-4">
      <div className="w-full max-w-md bg-white rounded-[20px] p-6 shadow-xl">
        <div id="overlay-role-assign-title" className="text-[12px] font-semibold tracking-[0.16em] uppercase text-[#6a6a6a]">Set call role</div>
        <div className="mt-1 text-[18px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">{device.displayName}</div>

        <div className="mt-5 space-y-2">
          {OPTIONS.map((opt) => {
            const active = selected === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setSelected(opt.value)}
                className={`w-full text-left px-4 py-3 rounded-[12px] border transition ${
                  active
                    ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                    : 'bg-white text-[#0a0a0a] border-[#e5e5e5] hover:border-[#0a0a0a]'
                }`}
              >
                <div className="text-[14px] font-semibold">{opt.label}</div>
                <div className={`text-[12px] mt-0.5 ${active ? 'text-white/70' : 'text-[#6a6a6a]'}`}>{opt.sub}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 rounded-[12px] bg-[#faf5e8] border border-[#e5e5e5] p-3">
          <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">Audit log will record</div>
          <div className="mt-1 text-[12px] text-[#3a3a3a] font-mono break-all">
            action=device.role.assign · from={device.callRole} · to={selected} · target={device.displayName}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="h-11 px-4 rounded-[8px] border border-[#e5e5e5] text-[13px] font-semibold text-[#0a0a0a] hover:border-[#0a0a0a]"
          >Cancel</button>
          <button
            onClick={handleSave}
            disabled={isUnchanged}
            className="h-11 px-4 rounded-[8px] bg-[#0a0a0a] text-white text-[13px] font-semibold hover:bg-[#1f1f1f] disabled:bg-[#e5e5e5] disabled:text-[#9a9a9a]"
          >Save</button>
        </div>
      </div>
    </div>
  );
}

export default OverlayCallRoleAssign;
