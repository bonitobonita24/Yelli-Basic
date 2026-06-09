'use client';

import { useEffect, useState } from 'react';
import Pill from '@/components/Pill';
import TenantTopBar from '@/components/TenantTopBar';
import BottomNav from '@/components/BottomNav';
import AppFooter from '@/components/AppFooter';
import { tenantExports, subscribe, type ExportJob } from '@/lib/sim';

interface ScreenAdminExportProps {
  go: (screen: string) => void;
  tenantId: string;
}

function relTime(iso: string | null): string {
  if (!iso) return '—';
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

function timeUntil(iso: string | null): string {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'expired';
  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

function formatBytes(n: number | null): string {
  if (n === null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function statusTone(s: ExportJob['status']): 'admin' | 'member' | 'neutral' {
  if (s === 'ready') return 'member';
  if (s === 'expired') return 'neutral';
  return 'admin';
}

export function ScreenAdminExport({ go, tenantId }: ScreenAdminExportProps): JSX.Element {
  const [rows, setRows] = useState<ExportJob[]>(() => tenantExports.list(tenantId));
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    const refresh = (): void => setRows(tenantExports.list(tenantId));
    const unsubExports = subscribe('tenantExports', refresh);
    // Tick every 5s so countdowns + expiry transitions stay live without a write.
    const tick = window.setInterval(refresh, 5000);
    refresh();
    return () => {
      unsubExports();
      window.clearInterval(tick);
    };
  }, [tenantId]);

  const onRequest = (): void => {
    setRequesting(true);
    tenantExports.request({ tenantId, requestedByUserId: null });
    setRows(tenantExports.list(tenantId));
    window.setTimeout(() => setRequesting(false), 600);
  };

  const onDownload = (job: ExportJob): void => {
    if (job.status !== 'ready' || !job.signedUrl) return;
    tenantExports.markDownloaded(job.id);
    setRows(tenantExports.list(tenantId));
    // Sim: open the stub URL in a new tab (404 is expected — it is a stub).
    window.open(job.signedUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fffaf0]">
      <TenantTopBar go={go} currentScreen="admin-export" />
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 md:px-12 py-6 md:py-12 space-y-6 pb-24 md:pb-12">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[24px] md:text-[32px] font-semibold text-[#0a0a0a]">Tenant Export</h1>
            <p className="text-[14px] text-[#6a6a6a] mt-1 max-w-[640px]">
              Request a full JSON snapshot of this tenant (users, devices, invitations, call
              sessions, audit log). The job runs asynchronously; a signed URL becomes available
              when ready and stays valid for 24 hours.
            </p>
          </div>
          <button
            onClick={onRequest}
            disabled={requesting}
            className="h-11 px-5 rounded-[12px] bg-[#0a0a0a] text-white text-[14px] font-semibold disabled:opacity-50 hover:bg-[#1a1a1a]"
          >
            {requesting ? 'Requesting…' : 'Request export'}
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="border border-dashed border-[#e5e5e5] rounded-[12px] p-8 text-center text-[14px] text-[#6a6a6a]">
            No exports yet. Click <span className="font-medium text-[#0a0a0a]">Request export</span> to start one.
          </div>
        ) : (
          <ul className="divide-y divide-[#e5e5e5] border border-[#e5e5e5] rounded-[12px] bg-white">
            {rows.map((job) => {
              const ready = job.status === 'ready';
              return (
                <li key={job.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={statusTone(job.status)}>{job.status}</Pill>
                    <span className="font-mono text-[12px] text-[#3a3a3a]">
                      {job.id.slice(0, 8)}
                    </span>
                    <span className="text-[12px] text-[#6a6a6a]">
                      requested {relTime(job.requestedAt)}
                    </span>
                    {ready && (
                      <span className="text-[12px] text-[#6a6a6a]">
                        · {formatBytes(job.payloadBytes)} · {timeUntil(job.expiresAt)}
                      </span>
                    )}
                    {job.downloadedAt && (
                      <span className="text-[12px] text-[#6a6a6a]">
                        · downloaded {relTime(job.downloadedAt)}
                      </span>
                    )}
                    <button
                      onClick={() => onDownload(job)}
                      disabled={!ready}
                      className="ml-auto h-9 px-3 rounded-[8px] border border-[#e5e5e5] text-[13px] font-medium text-[#0a0a0a] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f5f0e0]"
                    >
                      Download
                    </button>
                  </div>
                  {ready && job.signedUrl && (
                    <div className="mt-2 text-[11px] font-mono text-[#6a6a6a] break-all">
                      {job.signedUrl}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="text-[12px] text-[#6a6a6a] border-t border-[#e5e5e5] pt-4">
          <span className="font-medium text-[#3a3a3a]">Phase 4 swap:</span> in production the
          request enqueues a BullMQ job that streams the snapshot to S3 and returns a 24h
          presigned URL. The sim mirrors the same status machine
          (<span className="font-mono">queued → processing → ready → expired</span>) and audit
          actions (<span className="font-mono">tenant.export.requested</span>,
          <span className="font-mono"> tenant.export.ready</span>,
          <span className="font-mono"> tenant.export.downloaded</span>).
        </div>
      </main>
      <AppFooter />
      <BottomNav go={go} currentScreen="admin-export" />
    </div>
  );
}
