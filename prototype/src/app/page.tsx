'use client';

import { useEffect, useState } from 'react';
import { ScreenApp } from '@/screens/ScreenApp';
import { ScreenActiveCall } from '@/screens/ScreenActiveCall';
import { ScreenAdminMembers } from '@/screens/ScreenAdminMembers';
import { seedDefaults, tenants, type CallRole } from '@/lib/sim';

type Screen = 'app' | 'call' | 'admin-members';
type Overlay = 'incomingCall' | 'namePicker' | 'pwa' | 'offline' | null;

export default function HomePage(): JSX.Element {
  const [screen, setScreen] = useState<Screen>('app');
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [myCallRole, setMyCallRole] = useState<CallRole>('both');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    seedDefaults({ edition: 'lan', lanAccountMode: false });
    const list = tenants.list();
    const first = list[0];
    if (first) {
      setTenantId(first.id);
    }
  }, []);

  if (!tenantId) {
    return (
      <main className="min-h-screen bg-[#fffaf0] grid place-items-center">
        <div className="text-[14px] text-[#6a6a6a]">Initializing prototype…</div>
      </main>
    );
  }

  const go = (s: string): void => setScreen(s as Screen);

  if (screen === 'call') {
    return (
      <ScreenActiveCall
        go={go}
        activeCallId={activeCallId}
        tenantId={tenantId}
      />
    );
  }

  if (screen === 'admin-members') {
    return <ScreenAdminMembers go={go} tenantId={tenantId} />;
  }

  return (
    <ScreenApp
      go={go}
      overlay={overlay}
      setOverlay={setOverlay}
      myCallRole={myCallRole}
      setMyCallRole={setMyCallRole}
      tenantId={tenantId}
      activeCallId={activeCallId}
      setActiveCallId={setActiveCallId}
    />
  );
}
