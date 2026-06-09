'use client';

import { useMemo, useState } from 'react';
import Pill from '@/components/Pill';
import TenantTopBar from '@/components/TenantTopBar';
import BottomNav from '@/components/BottomNav';
import AppFooter from '@/components/AppFooter';
import { auditLog, users, devices, type AuditLog } from '@/lib/sim';

interface ScreenAdminAuditProps {
  go: (screen: string) => void;
  tenantId: string;
}

type Prefix = 'all' | 'device' | 'invitation' | 'lan' | 'user';

const PREFIXES: Array<{ key: Prefix; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'device', label: 'device.*' },
  { key: 'invitation', label: 'invitation.*' },
  { key: 'lan', label: 'lan.*' },
  { key: 'user', label: 'user.*' },
];

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function resolveActor(row: AuditLog): { label: string; tone: 'admin' | 'member' | 'neutral' } {
  if (row.actorUserId === null) return { label: 'LAN admin', tone: 'admin' };
  const u = users.byId(row.actorUserId);
  if (u) return { label: u.displayName, tone: u.role === 'admin' ? 'admin' : 'member' };
  const d = devices.byId(row.actorUserId);
  if (d) return { label: d.displayName, tone: 'neutral' };
  return { label: row.actorUserId.slice(0, 8), tone: 'neutral' };
}

export function ScreenAdminAudit({ go, tenantId }: ScreenAdminAuditProps): JSX.Element {
  const [prefix, setPrefix] = useState<Prefix>('all');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    const all = auditLog.recent(tenantId, 200);
    const byPrefix = prefix === 'all' ? all : all.filter((r) => r.action.startsWith(`${prefix}.`));
    const q = query.trim().toLowerCase();
    if (q === '') return byPrefix;
    return byPrefix.filter((r) => {
      if (r.action.toLowerCase().includes(q)) return true;
      try {
        return JSON.stringify(r.payload).toLowerCase().includes(q);
      } catch {
        return false;
      }
    });
  }, [tenantId, prefix, query]);

  return (
    <div className="min-h-screen flex flex-col bg-[#fffaf0]">
      <TenantTopBar go={go} currentScreen="admin-audit" />
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 md:px-12 py-6 md:py-12 space-y-6 pb-24 md:pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[24px] md:text-[32px] font-semibold text-[#0a0a0a]">Audit</h1>
            <p className="text-[14px] text-[#6a6a6a] mt-1">Recent tenant activity (read-only, latest 200)</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {PREFIXES.map((p) => {
            const active = prefix === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setPrefix(p.key)}
                className={`px-3 h-9 rounded-[8px] text-[13px] font-medium border ${
                  active
                    ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                    : 'bg-[#fffaf0] text-[#3a3a3a] border-[#e5e5e5] hover:bg-[#f5f0e0]'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search action or payload…"
          className="w-full h-11 px-3 rounded-[12px] border border-[#e5e5e5] bg-white text-[14px] text-[#0a0a0a] placeholder:text-[#6a6a6a] focus:outline-none focus:border-[#0a0a0a]"
        />

        {rows.length === 0 ? (
          <div className="border border-dashed border-[#e5e5e5] rounded-[12px] p-8 text-center text-[14px] text-[#6a6a6a]">
            No audit entries match the current filters.
          </div>
        ) : (
          <ul className="divide-y divide-[#e5e5e5] border border-[#e5e5e5] rounded-[12px] bg-white">
            {rows.map((row) => {
              const actor = resolveActor(row);
              const isOpen = expanded === row.id;
              return (
                <li key={row.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[12px] text-[#0a0a0a] bg-[#f5f0e0] px-2 py-0.5 rounded">
                      {row.action}
                    </span>
                    <Pill tone={actor.tone}>{actor.label}</Pill>
                    <span className="text-[12px] text-[#6a6a6a]">{relTime(row.createdAt)}</span>
                    <button
                      onClick={() => setExpanded(isOpen ? null : row.id)}
                      className="ml-auto text-[12px] text-[#3a3a3a] hover:text-[#0a0a0a] underline"
                    >
                      {isOpen ? 'Hide payload' : 'Show payload'}
                    </button>
                  </div>
                  {isOpen && (
                    <pre className="mt-3 bg-[#0a0a0a] text-[#a4d4c5] text-[12px] p-3 rounded-[8px] overflow-x-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(row.payload, null, 2)}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <AppFooter />
      <BottomNav go={go} currentScreen="admin-audit" />
    </div>
  );
}
