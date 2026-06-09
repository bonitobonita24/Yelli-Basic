'use client';

import { useMemo, useState } from 'react';
import Pill from '@/components/Pill';
import TenantTopBar from '@/components/TenantTopBar';
import BottomNav from '@/components/BottomNav';
import AppFooter from '@/components/AppFooter';
import { invitations, users, type Invitation } from '@/lib/sim';

interface ScreenAdminInvitationsProps {
  go: (screen: string) => void;
  tenantId: string;
}

type Status = 'pending' | 'accepted' | 'expired';

function statusOf(inv: Invitation): Status {
  if (inv.acceptedAt !== null) return 'accepted';
  if (new Date(inv.expiresAt).getTime() <= Date.now()) return 'expired';
  return 'pending';
}

function StatusPill({ status }: { status: Status }): JSX.Element {
  const map: Record<Status, { tone: 'online' | 'admin'; label: string }> = {
    pending: { tone: 'online', label: 'Pending' },
    accepted: { tone: 'admin', label: 'Accepted' },
    expired: { tone: 'admin', label: 'Expired' },
  };
  const cfg = map[status];
  return <Pill tone={cfg.tone}>{cfg.label}</Pill>;
}

/** Ensure a tenant-admin user exists so invitations have an `invitedByUserId`.
 *  LAN-anonymous seed has no users — we synthesize a stub admin on demand so
 *  the invite flow is walkable without changing the global seed mode. */
function ensureAdminUser(tenantId: string): string {
  const existing = users.list(tenantId).find((u) => u.role === 'admin');
  if (existing) return existing.id;
  const created = users.create({
    tenantId,
    email: 'admin@yelli.local',
    displayName: 'LAN Admin',
    role: 'admin',
  });
  return created.id;
}

export function ScreenAdminInvitations({ go, tenantId }: ScreenAdminInvitationsProps): JSX.Element {
  const [refreshKey, setRefreshKey] = useState(0);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const all = useMemo(() => invitations.list(tenantId), [tenantId, refreshKey]);
  const pending = all.filter((i) => statusOf(i) === 'pending');

  const handleCreate = (e: React.FormEvent): void => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Enter a valid email');
      return;
    }
    const adminId = ensureAdminUser(tenantId);
    invitations.create(tenantId, trimmed, adminId);
    setEmail('');
    setError(null);
    setRefreshKey((k) => k + 1);
  };

  const handleRevoke = (id: string): void => {
    invitations.expire(id);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen bg-[#fffaf0] flex flex-col pb-20 md:pb-0">
      <TenantTopBar go={go} currentScreen="admin-invitations" />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 md:px-12 py-6 md:py-12 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <div className="text-[12px] font-semibold tracking-[0.16em] uppercase text-[#6a6a6a]">Admin</div>
            <h1 className="mt-1 text-[28px] md:text-[32px] font-semibold tracking-[-0.02em] text-[#0a0a0a]">Invitations</h1>
            <div className="mt-1 text-[13px] text-[#6a6a6a]">Invite a member by email · 7-day expiry</div>
          </div>
          <div className="text-[13px] text-[#6a6a6a]">
            {pending.length} pending · {all.length} total
          </div>
        </header>

        <section className="rounded-[16px] border border-[#e5e5e5] bg-white p-4 md:p-6">
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3 sm:items-start">
            <div className="flex-1">
              <label className="block text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a] mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder="member@example.com"
                className="w-full h-11 px-3 rounded-[8px] border border-[#e5e5e5] bg-white text-[14px] focus:outline-none focus:border-[#0a0a0a]"
              />
              {error && <div className="mt-1 text-[12px] text-[#b1453b]">{error}</div>}
            </div>
            <button
              type="submit"
              className="h-11 px-5 rounded-[8px] bg-[#0a0a0a] text-white text-[13px] font-semibold sm:mt-[22px] hover:opacity-90"
            >Send invite</button>
          </form>
        </section>

        <section className="rounded-[16px] border border-[#e5e5e5] bg-white overflow-hidden">
          {all.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-[#6a6a6a]">No invitations yet</div>
          ) : (
            <ul className="divide-y divide-[#e5e5e5]">
              {all.map((inv) => {
                const status = statusOf(inv);
                return (
                  <li key={inv.id} className="p-4 md:px-6 md:py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-[#0a0a0a] truncate">{inv.email}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <StatusPill status={status} />
                        <span className="text-[12px] text-[#6a6a6a]">
                          {status === 'pending' && `expires ${new Date(inv.expiresAt).toLocaleDateString()}`}
                          {status === 'accepted' && inv.acceptedAt && `accepted ${new Date(inv.acceptedAt).toLocaleDateString()}`}
                          {status === 'expired' && 'expired'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {status === 'pending' && (
                        <>
                          <button
                            onClick={() => go(`join-invite:${inv.id}`)}
                            className="h-9 px-3 rounded-[8px] border border-[#e5e5e5] text-[12px] font-semibold text-[#0a0a0a] hover:border-[#0a0a0a]"
                          >Open link</button>
                          <button
                            onClick={() => handleRevoke(inv.id)}
                            className="h-9 px-3 rounded-[8px] border border-[#e5e5e5] text-[12px] font-semibold text-[#b1453b] hover:border-[#b1453b]"
                          >Revoke</button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      <AppFooter />
      <BottomNav go={go} currentScreen="admin-invitations" />
    </div>
  );
}
