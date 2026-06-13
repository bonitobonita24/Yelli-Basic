'use client';

import { useMemo, useState } from 'react';

import { AUDIT_ACTIONS } from '@yelli/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc, type RouterOutputs } from '@/lib/trpc/react';

/**
 * Admin → Audit (PROTOTYPE.md Flow H "Audit View"). Production port of the Phase 3.3
 * signed-off `prototype/src/screens/ScreenAdminAudit.tsx` (INHERIT-not-REPLACE).
 *
 * Naming reconciliation: the S3d brief calls this "ScreenAuditView"; the canonical
 * codebase name — matching the prototype source, the sibling ported `ScreenAdmin*`
 * screens (S3c), and the W4 audit-router doc — is ScreenAdminAudit. Same class of
 * name reconciliation as S3c's ScreenAdminMembers.
 *
 * SWAP BOUNDARY wiring (replaces the prototype's `sim.auditLog.recent`):
 *   - `trpc.audit.list` — cursor-paginated, admin-gated, newest-first AuditLog view;
 *     optional `actionPrefix` filters by §11 namespace.
 *
 * Filter chips — WAVE-11 HARD CONTRACT. The chip set is DERIVED from the LOCKED
 * §11-canonical vocabulary (`@yelli/shared` AUDIT_ACTIONS) so it matches verbatim and
 * can never drift from the single source of truth. The prototype's hand-listed 5-chip
 * subset (all/device/invitation/lan/user) predated the `call.*`/`tenant.*`/`pwa.*`
 * namespace additions; deriving the chips from AUDIT_ACTIONS is the production-correct
 * realization of "filter chips matching §11-canonical vocabulary verbatim".
 *
 * Reconciliations vs the sim (same substitution class as S3a/S3c — the production wire
 * shape governs the prototype affordance):
 *   - Pagination: the sim returned a flat latest-200 list; the production router is
 *     cursor-paginated (default 50). Realized as `useInfiniteQuery` + a "Load more"
 *     button — the brief's "paginated audit log". Client search filters loaded pages
 *     (faithful to the sim's client-side search).
 *   - Actor: the sim joined users/devices to show a display name + role-toned Pill.
 *     The audit wire returns only `actorUserId` (no join; tenantId stripped per
 *     security.md #13, no name on the row). So actor renders as "System" (null actor —
 *     cron / LAN-anonymous origin) or the short actor id. No name lookup is invented.
 *
 * Fully a Client Component (tRPC-react-query + filter/search state). Chrome dropped
 * (W1b mounts behind the admin gate). Clay semantic tokens only (ui-rules Rule 3);
 * loading = shadcn `<Skeleton>` (ui-rules Rule 11 PATH A). On-dark payload block uses
 * the `white` keyword (no on-dark token exists — W7/S3b posture; tokens.css unchanged).
 */

type AuditRow = RouterOutputs['audit']['list']['items'][number];

// Top-level §11 namespaces, derived from the LOCKED vocabulary (verbatim — Wave-11).
// Every AUDIT_ACTIONS entry is dot-segmented, so slice-to-first-dot yields a string.
const NAMESPACES = Array.from(new Set(AUDIT_ACTIONS.map((a) => a.slice(0, a.indexOf('.')))));
const CHIPS: Array<{ key: string; label: string; prefix: string | undefined }> = [
  { key: 'all', label: 'All', prefix: undefined },
  ...NAMESPACES.map((ns) => ({ key: ns, label: `${ns}.*`, prefix: `${ns}.` })),
];

function relTime(value: string | Date): string {
  const diff = Date.now() - new Date(value).getTime();
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function actorLabel(actorUserId: string | null): string {
  return actorUserId === null ? 'System' : actorUserId.slice(0, 8);
}

function matchesQuery(row: AuditRow, q: string): boolean {
  if (row.action.toLowerCase().includes(q)) return true;
  try {
    return JSON.stringify(row.payload).toLowerCase().includes(q);
  } catch {
    return false;
  }
}

export default function ScreenAdminAudit(): React.JSX.Element {
  const [selected, setSelected] = useState('all');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const actionPrefix = CHIPS.find((c) => c.key === selected)?.prefix;

  const auditQuery = trpc.audit.list.useInfiniteQuery(
    { limit: 50, actionPrefix },
    { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined },
  );

  const rows = useMemo(() => {
    const all = auditQuery.data?.pages.flatMap((p) => p.items) ?? [];
    const q = query.trim().toLowerCase();
    return q === '' ? all : all.filter((r) => matchesQuery(r, q));
  }, [auditQuery.data, query]);

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 px-4 py-6 md:px-12 md:py-12">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
            Admin
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">
            Audit
          </h1>
          <div className="mt-1 text-sm text-text-muted">Recent tenant activity · read-only</div>
        </div>
        <div className="text-sm text-text-muted">{rows.length} shown</div>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by action namespace">
        {CHIPS.map((c) => (
          <Button
            key={c.key}
            type="button"
            size="sm"
            variant={selected === c.key ? 'default' : 'outline'}
            aria-pressed={selected === c.key}
            onClick={() => setSelected(c.key)}
            className="font-mono"
          >
            {c.label}
          </Button>
        ))}
      </div>

      <Input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search action or payload…"
        aria-label="Search audit entries"
      />

      <section className="overflow-hidden rounded-lg border border-border bg-surface">
        {auditQuery.isPending ? (
          <ul className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="p-4 md:px-6 md:py-4">
                <Skeleton className="h-5 w-56" />
                <Skeleton className="mt-2 h-4 w-32" />
              </li>
            ))}
          </ul>
        ) : auditQuery.isError ? (
          <div className="p-8 text-center text-sm text-error-strong">
            Couldn&apos;t load the audit log. Please refresh and try again.
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted">
            No audit entries match the current filters.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => {
              const isOpen = expanded === row.id;
              return (
                <li key={row.id} className="p-4 md:px-6 md:py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-border bg-canvas px-2 py-0.5 font-mono text-xs text-text-primary">
                      {row.action}
                    </span>
                    <Badge variant="outline" className="rounded-pill">
                      {actorLabel(row.actorUserId)}
                    </Badge>
                    <span className="text-xs text-text-muted">{relTime(row.createdAt)}</span>
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : row.id)}
                      className="ml-auto text-xs text-text-secondary underline hover:text-text-primary"
                      aria-expanded={isOpen}
                    >
                      {isOpen ? 'Hide payload' : 'Show payload'}
                    </button>
                  </div>
                  {isOpen && (
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-text-primary p-3 font-mono text-xs text-white">
                      {JSON.stringify(row.payload, null, 2)}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {auditQuery.hasNextPage && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => void auditQuery.fetchNextPage()}
            disabled={auditQuery.isFetchingNextPage}
          >
            {auditQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
