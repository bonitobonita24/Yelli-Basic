'use client';

import { useEffect, useMemo, useState } from 'react';
import Pill from '@/components/Pill';
import CallRoleLabel from '@/components/CallRoleLabel';
import TenantTopBar from '@/components/TenantTopBar';
import BottomNav from '@/components/BottomNav';
import AppFooter from '@/components/AppFooter';
import OverlayIncomingCall from '@/components/OverlayIncomingCall';
import OverlayNamePicker from '@/components/OverlayNamePicker';
import { callSessions, devices, type CallRole, type Device } from '@/lib/sim';

type Screen = 'app' | 'call';
type Overlay = 'incomingCall' | 'namePicker' | 'pwa' | 'offline' | null;

type Props = {
  go: (screen: string) => void;
  overlay: Overlay;
  setOverlay: (o: Overlay) => void;
  myCallRole: CallRole;
  setMyCallRole: (r: CallRole) => void;
  tenantId: string;
  activeCallId: string | null;
  setActiveCallId: (id: string | null) => void;
};

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

export function ScreenApp(props: Props): JSX.Element {
  const { go, overlay, setOverlay, myCallRole, setMyCallRole, tenantId, activeCallId, setActiveCallId } = props;
  const canInitiate = myCallRole === 'caller' || myCallRole === 'both';

  // refreshKey forces re-read of the sim layer after device mutations (rename, etc.)
  const [refreshKey, setRefreshKey] = useState(0);
  const allDevices = useMemo(() => devices.list(tenantId), [tenantId, refreshKey]);
  const visibleMembers = allDevices.filter((d) => d.archivedAt === null);
  const onlineMembers = visibleMembers.filter((d) => {
    const s = deviceStatus(d);
    return s === 'online' || s === 'idle';
  });

  // Pick "me" = first device in tenant (prototype simplification).
  const myDevice: Device | undefined = visibleMembers[0];
  const myName = myDevice?.displayName ?? 'You';

  const placeCall = (calleeDeviceId: string): void => {
    if (!myDevice) return;
    try {
      const session = callSessions.create(myDevice.id, calleeDeviceId);
      setActiveCallId(session.id);
      go('call');
    } catch {
      // forbidden-by-role or cross-tenant — silently ignored in prototype
    }
  };

  const changeMyRole = (r: CallRole): void => {
    if (myDevice) {
      devices.setRole(myDevice.id, r);
    }
    setMyCallRole(r);
  };

  // Flow D — Register Device: auto-open the name picker when me.displayName is
  // unset on first launch. PRODUCT.md §3 says the Device row is server-created
  // on first connect with displayName initially blank; the picker collects it.
  // Current seed populates all names, so this only fires in genuine first-join
  // scenarios — but the Edit button (sidebar "You" card) opens it on demand.
  useEffect(() => {
    if (myDevice && myDevice.displayName.trim().length === 0 && overlay === null) {
      setOverlay('namePicker');
    }
  }, [myDevice, overlay, setOverlay]);

  const saveMyName = (name: string): void => {
    if (!myDevice) return;
    devices.setDisplayName(myDevice.id, name);
    setRefreshKey((k) => k + 1);
    setOverlay(null);
  };

  return (
    <div className="min-h-screen bg-[#fffaf0] flex flex-col pb-20 md:pb-0">
      <TenantTopBar go={go} currentScreen="app" />

      <div className="text-[12px] text-[#6a6a6a] text-center py-1.5 px-4 bg-[#faf5e8] border-b border-[#e5e5e5]">
        Same screen serves LAN (anonymous) + Cloud (auth) + LAN account mode.
      </div>

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 md:px-12 py-6 md:py-12 grid md:grid-cols-12 gap-6 md:gap-8">
        <section className="md:col-span-8 md:order-2 space-y-4 md:space-y-6">
          {canInitiate ? (
            <div className="rounded-[24px] bg-[#1a3a3a] text-white p-8 md:p-12 grid place-items-center min-h-[260px] md:min-h-[280px] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#1a3a3a] via-[#1a3a3a] to-[#0a1a1a]" />
              <div className="relative z-10 text-center">
                <div className="text-[12px] font-semibold tracking-[0.16em] uppercase opacity-70">Ready to call</div>
                <button
                  onClick={() => {
                    const firstCallable = visibleMembers.find(
                      (d) => d.id !== myDevice?.id && d.callRole !== 'caller',
                    );
                    if (firstCallable) placeCall(firstCallable.id);
                  }}
                  className="mt-5 w-36 h-36 md:w-44 md:h-44 rounded-full bg-white text-[#0a0a0a] grid place-items-center hover:scale-[1.02] transition"
                >
                  <div className="text-[40px] md:text-[56px]">📞</div>
                  <div className="text-[14px] font-semibold tracking-[0.08em] mt-1">CALL</div>
                </button>
                <div className="mt-5 text-[13px] opacity-80">Tap a person below, then CALL</div>
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] bg-[#f5f0e0] border border-[#e5e5e5] p-8 md:p-12 grid place-items-center min-h-[200px]">
              <div className="text-center max-w-md">
                <div className="text-[12px] font-semibold tracking-[0.16em] uppercase text-[#6a6a6a]">Receiver-only device</div>
                <div className="mt-3 text-[18px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">CALL is hidden for this device</div>
                <div className="mt-2 text-[13px] text-[#6a6a6a] leading-[1.55]">An admin assigned you the <span className="font-semibold">receiver-only</span> call role. You&apos;ll see incoming calls; the CALL button is hidden per Step 3 enforcement.</div>
              </div>
            </div>
          )}

          <div className="rounded-[16px] border border-[#e5e5e5] bg-[#fffaf0]">
            <div className="px-4 md:px-6 py-4 border-b border-[#e5e5e5] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="text-[14px] font-semibold text-[#0a0a0a]">Directory</div>
                <div className="text-[12px] text-[#6a6a6a]">{onlineMembers.length} online · archived hidden</div>
              </div>
              <input type="search" placeholder="Search…" className="h-11 sm:h-9 px-3 rounded-[8px] border border-[#e5e5e5] bg-[#fffaf0] text-[14px] focus:outline-none focus:border-[#0a0a0a]" />
            </div>
            <ul className="divide-y divide-[#e5e5e5]">
              {visibleMembers.slice(0, 10).map((m) => {
                const status = deviceStatus(m);
                const disabled = status === 'offline';
                const isReceiverOnly = m.callRole === 'receiver';
                const canCallThis = canInitiate && m.callRole !== 'caller' && m.id !== myDevice?.id;
                return (
                  <li key={m.id} className={`flex items-center gap-3 md:gap-4 px-4 md:px-6 py-3 ${disabled ? 'opacity-50' : ''}`}>
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${status === 'online' ? 'bg-[#22c55e]' : status === 'idle' ? 'bg-[#f59e0b]' : 'bg-[#9a9a9a]'}`} />
                    <div className="w-10 h-10 rounded-full bg-[#b8a4ed] grid place-items-center text-[12px] font-semibold text-[#0a0a0a] flex-shrink-0">
                      {m.displayName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-[#0a0a0a] truncate flex items-center gap-2 flex-wrap">
                        <span className="truncate">{m.displayName}</span>
                      </div>
                      <div className="text-[12px] text-[#6a6a6a] truncate">{formatLastSeen(m)}{isReceiverOnly ? ' · Receiver only' : ''}</div>
                    </div>
                    {canCallThis && (
                      <button
                        disabled={disabled}
                        onClick={() => placeCall(m.id)}
                        className="ml-1 h-11 px-4 rounded-[8px] bg-[#0a0a0a] text-white text-[13px] font-semibold disabled:bg-[#e5e5e5] disabled:text-[#9a9a9a] hover:bg-[#1f1f1f] flex-shrink-0"
                      >Call</button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <aside className="md:col-span-4 md:order-1 space-y-4">
          <div className="rounded-[16px] border border-[#e5e5e5] bg-[#fffaf0] p-5 md:p-6">
            <div className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">You</div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[18px] font-semibold tracking-[-0.01em] text-[#0a0a0a] truncate">{myName}</span>
              <button onClick={() => setOverlay('namePicker')} className="text-[12px] text-[#6a6a6a] hover:text-[#0a0a0a] underline h-11 px-2 flex-shrink-0">Edit</button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Pill tone="admin">Admin</Pill>
              <Pill tone="online">Online</Pill>
              <CallRoleLabel role={myCallRole} />
            </div>
            <div className="mt-3 text-[12px] text-[#6a6a6a]">Device: {myDevice?.displayName ?? '—'} · WebSocket connected</div>

            <div className="mt-4 pt-4 border-t border-[#e5e5e5]">
              <div className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a] mb-2">Demo: view as</div>
              <div className="grid grid-cols-3 gap-2">
                {(['both', 'caller', 'receiver'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => changeMyRole(r)}
                    className={`h-11 px-2 rounded-[8px] text-[12px] font-semibold border ${myCallRole === r ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]' : 'bg-[#fffaf0] text-[#0a0a0a] border-[#e5e5e5] hover:border-[#0a0a0a]'}`}
                  >{r === 'both' ? 'Both' : r === 'caller' ? 'Caller' : 'Receiver'}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-1 gap-3">
            <button onClick={() => setOverlay('pwa')} className="text-left rounded-[16px] border border-dashed border-[#0a0a0a]/30 bg-[#faf5e8] p-4 md:p-5 hover:bg-[#f5f0e0] min-h-[64px]">
              <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">Demo</div>
              <div className="mt-1 text-[13px] text-[#3a3a3a]">PWA install banner →</div>
            </button>
            <button onClick={() => setOverlay('offline')} className="text-left rounded-[16px] border border-dashed border-[#0a0a0a]/30 bg-[#faf5e8] p-4 md:p-5 hover:bg-[#f5f0e0] min-h-[64px]">
              <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">Demo</div>
              <div className="mt-1 text-[13px] text-[#3a3a3a]">Offline reconnecting banner →</div>
            </button>
            <button
              onClick={() => {
                if (!myDevice) return;
                const callerPeer = visibleMembers.find(
                  (d) => d.id !== myDevice.id && d.callRole !== 'receiver',
                );
                if (!callerPeer) return;
                try {
                  const session = callSessions.create(callerPeer.id, myDevice.id);
                  setActiveCallId(session.id);
                  setOverlay('incomingCall');
                } catch {
                  // forbidden-by-role — silently ignored in prototype
                }
              }}
              className="text-left rounded-[16px] border border-dashed border-[#0a0a0a]/30 bg-[#faf5e8] p-4 md:p-5 hover:bg-[#f5f0e0] min-h-[64px]"
            >
              <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">Demo</div>
              <div className="mt-1 text-[13px] text-[#3a3a3a]">Incoming call modal →</div>
            </button>
          </div>
        </aside>
      </main>

      <AppFooter />
      <BottomNav go={go} currentScreen="app" />

      {/* Wave 4A — Flow B (Receive). Other overlays remain TODO. */}
      {overlay === 'incomingCall' && (() => {
        const session = activeCallId ? callSessions.byId(activeCallId) : null;
        const callerDevice = session ? devices.byId(session.callerDeviceId) : null;
        if (!session || !callerDevice) return null;
        return (
          <OverlayIncomingCall
            callerName={callerDevice.displayName}
            callerDeviceName={callerDevice.displayName}
            onAccept={() => {
              setOverlay(null);
              go('call');
            }}
            onReject={() => {
              callSessions.end(session.id, 'declined');
              setActiveCallId(null);
              setOverlay(null);
            }}
          />
        );
      })()}
      {overlay === 'namePicker' && myDevice && (
        myDevice.displayName.trim().length > 0 ? (
          <OverlayNamePicker
            initialName={myDevice.displayName}
            onSave={saveMyName}
            onClose={() => setOverlay(null)}
          />
        ) : (
          <OverlayNamePicker initialName={myDevice.displayName} onSave={saveMyName} />
        )
      )}
      {overlay === 'pwa' && null}
      {overlay === 'offline' && null}
    </div>
  );
}
