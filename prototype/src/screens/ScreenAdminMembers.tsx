'use client';

import { useMemo, useState } from 'react';
import Pill from '@/components/Pill';
import CallRoleLabel from '@/components/CallRoleLabel';
import TenantTopBar from '@/components/TenantTopBar';
import BottomNav from '@/components/BottomNav';
import AppFooter from '@/components/AppFooter';
import OverlayCallRoleAssign from '@/components/OverlayCallRoleAssign';
import { devices, type Device } from '@/lib/sim';

interface ScreenAdminMembersProps {
  go: (screen: string) => void;
  tenantId: string;
}

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function deviceStatus(d: Device): 'online' | 'idle' | 'offline' | 'archived' {
  if (d.archivedAt !== null) return 'archived';
  const lastSeen = new Date(d.lastSeenAt).getTime();
  const age = Date.now() - lastSeen;
  if (age <= ONLINE_WINDOW_MS) return 'online';
  if (age <= ONLINE_WINDOW_MS * 3) return 'idle';
  return 'offline';
}

function formatLastSeen(d: Device): string {
  const status = deviceStatus(d);
  if (status === 'online') return 'now';
  const age = Date.now() - new Date(d.lastSeenAt).getTime();
  const mins = Math.floor(age / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function StatusPill({ status }: { status: 'online' | 'idle' | 'offline' | 'archived' }): JSX.Element {
  const map = {
    online: { tone: 'online' as const, label: 'Online' },
    idle: { tone: 'admin' as const, label: 'Idle' },
    offline: { tone: 'admin' as const, label: 'Offline' },
    archived: { tone: 'admin' as const, label: 'Archived' },
  };
  const cfg = map[status];
  return <Pill tone={cfg.tone}>{cfg.label}</Pill>;
}

export function ScreenAdminMembers({ go, tenantId }: ScreenAdminMembersProps): JSX.Element {
  const [refreshKey, setRefreshKey] = useState(0);
  const [target, setTarget] = useState<Device | null>(null);

  const allDevices = useMemo(() => devices.list(tenantId), [tenantId, refreshKey]);
  const visible = allDevices.filter((d) => d.archivedAt === null);
  const onlineCount = visible.filter((d) => {
    const s = deviceStatus(d);
    return s === 'online' || s === 'idle';
  }).length;
  const archivedCount = allDevices.length - visible.length;

  const handleSaved = (): void => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen bg-[#fffaf0] flex flex-col pb-20 md:pb-0">
      <TenantTopBar go={go} currentScreen="admin-members" />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 md:px-12 py-6 md:py-12 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <div className="text-[12px] font-semibold tracking-[0.16em] uppercase text-[#6a6a6a]">Admin</div>
            <h1 className="mt-1 text-[28px] md:text-[32px] font-semibold tracking-[-0.02em] text-[#0a0a0a]">Members</h1>
            <div className="mt-1 text-[13px] text-[#6a6a6a]">Manage device call roles</div>
          </div>
          <div className="text-[13px] text-[#6a6a6a]">
            {allDevices.length} device{allDevices.length === 1 ? '' : 's'} · {onlineCount} online
          </div>
        </header>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="flex flex-wrap gap-2">
            <button className="h-9 px-3 rounded-full bg-[#0a0a0a] text-white text-[12px] font-semibold">All · {allDevices.length}</button>
            <button className="h-9 px-3 rounded-full bg-white border border-[#e5e5e5] text-[#0a0a0a] text-[12px] font-semibold hover:border-[#0a0a0a]">Online · {onlineCount}</button>
            <button className="h-9 px-3 rounded-full bg-white border border-[#e5e5e5] text-[#0a0a0a] text-[12px] font-semibold hover:border-[#0a0a0a]">Archived · {archivedCount}</button>
          </div>
          <div className="flex-1">
            <input
              type="search"
              placeholder="Search members…"
              className="w-full h-11 sm:h-9 px-3 rounded-[8px] border border-[#e5e5e5] bg-white text-[14px] focus:outline-none focus:border-[#0a0a0a]"
            />
          </div>
        </div>

        {/* Mobile: card list */}
        <ul className="md:hidden space-y-3">
          {visible.map((d) => {
            const status = deviceStatus(d);
            return (
              <li key={d.id} className="rounded-[16px] border border-[#e5e5e5] bg-white p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#b8a4ed] grid place-items-center text-[12px] font-semibold text-[#0a0a0a] flex-shrink-0">
                  {initials(d.displayName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-[#0a0a0a] truncate">{d.displayName}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <StatusPill status={status} />
                    <CallRoleLabel role={d.callRole} />
                  </div>
                  <div className="mt-1 text-[12px] text-[#6a6a6a]">{formatLastSeen(d)}</div>
                </div>
                <button
                  onClick={() => setTarget(d)}
                  className="h-11 px-3 rounded-[8px] border border-[#e5e5e5] text-[12px] font-semibold text-[#0a0a0a] hover:border-[#0a0a0a] flex-shrink-0"
                >Change role</button>
              </li>
            );
          })}
        </ul>

        {/* Desktop: table */}
        <div className="hidden md:block rounded-[16px] border border-[#e5e5e5] bg-white overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-[#faf5e8] border-b border-[#e5e5e5]">
              <tr>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">Name</th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">Status</th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">Call role</th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">Last seen</th>
                <th className="px-6 py-3 text-right text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e5e5]">
              {visible.map((d) => {
                const status = deviceStatus(d);
                return (
                  <tr key={d.id}>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#b8a4ed] grid place-items-center text-[11px] font-semibold text-[#0a0a0a]">
                          {initials(d.displayName)}
                        </div>
                        <div className="text-[14px] font-semibold text-[#0a0a0a]">{d.displayName}</div>
                      </div>
                    </td>
                    <td className="px-6 py-3"><StatusPill status={status} /></td>
                    <td className="px-6 py-3"><CallRoleLabel role={d.callRole} /></td>
                    <td className="px-6 py-3 text-[13px] text-[#6a6a6a]">{formatLastSeen(d)}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => setTarget(d)}
                        className="h-9 px-3 rounded-[8px] border border-[#e5e5e5] text-[12px] font-semibold text-[#0a0a0a] hover:border-[#0a0a0a]"
                      >Change role</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>

      <AppFooter />
      <BottomNav go={go} currentScreen="admin-members" />

      {target && (
        <OverlayCallRoleAssign
          device={target}
          onClose={() => setTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
