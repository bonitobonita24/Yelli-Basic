'use client';

import { Archive, ArchiveRestore, Pencil, Trash2, UserCog } from 'lucide-react';
import { useState } from 'react';

import OverlayCallRoleAssign from '@/components/overlays/OverlayCallRoleAssign';
import OverlayNamePicker from '@/components/overlays/OverlayNamePicker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { trpc, type RouterOutputs } from '@/lib/trpc/react';
import { cn } from '@/lib/utils';

/**
 * Admin → Members (the device directory · PROTOTYPE.md Flow G "Manage Devices").
 * Production port of the Phase 3.3 signed-off `prototype/src/screens/ScreenAdminMembers.tsx`
 * (INHERIT-not-REPLACE). In Yelli a "member" IS a device, so there is no separate
 * `ScreenAdminDevices` — this single directory is the devices surface.
 *
 * SWAP BOUNDARY wiring (replaces the prototype's `sim.devices`):
 *   - `trpc.devices.list`           — the directory rows (status derived client-side)
 *   - `trpc.devices.setDisplayName` — rename (via the ported OverlayNamePicker, S3a)
 *   - `trpc.devices.setRole`        — role change (via the ported OverlayCallRoleAssign, S3b)
 *   - `trpc.devices.archive`        — single-device archive (Wave 9: emits `device.archive`;
 *                                     the mass cron `device.archive.batch` lives in packages/jobs
 *                                     and is NOT a router procedure — the split is honored server-side)
 *   - `trpc.devices.unarchive` / `trpc.devices.delete`
 *
 * Fully a Client Component (tRPC-react-query hooks + filter state) — matching the
 * ScreenActiveCall (S3b) precedent. The chrome (TenantTopBar / BottomNav / AppFooter)
 * is intentionally dropped: the W1b app-shell mounts this behind the admin gate and
 * owns navigation. The hand-rolled prototype `<table>` is recomposed with the shadcn
 * `Table` primitive + Clay semantic tokens (ui-rules Rule 3 — no raw hex), keeping the
 * prototype's responsive desktop-table / mobile-card split. Destructive actions confirm
 * via an inline shadcn Dialog (no `window.confirm`). Loading uses shadcn `<Skeleton>`
 * (ui-rules Rule 11 PATH A).
 */

type DeviceRow = RouterOutputs['devices']['list'][number];
type Filter = 'all' | 'online' | 'archived';
type DeviceStatus = 'online' | 'idle' | 'offline' | 'archived';

const ONLINE_WINDOW_MS = 5 * 60 * 1000; // PRODUCT.md presence rule (5 min).

function deviceStatus(d: DeviceRow): DeviceStatus {
  if (d.archivedAt !== null) return 'archived';
  const age = Date.now() - new Date(d.lastSeenAt).getTime();
  if (age <= ONLINE_WINDOW_MS) return 'online';
  if (age <= ONLINE_WINDOW_MS * 3) return 'idle';
  return 'offline';
}

function formatLastSeen(d: DeviceRow): string {
  if (deviceStatus(d) === 'online') return 'now';
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
    .flatMap((n) => (n[0] ? [n[0]] : []))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const STATUS_BADGE: Record<DeviceStatus, { className: string; label: string }> = {
  online: { className: 'border-success/30 bg-success/15 text-success-strong', label: 'Online' },
  idle: { className: 'border-warning/40 bg-warning/15 text-warning-strong', label: 'Idle' },
  offline: { className: 'border-border bg-canvas text-text-muted', label: 'Offline' },
  archived: { className: 'border-border bg-canvas text-text-muted', label: 'Archived' },
};

function StatusBadge({ status }: { status: DeviceStatus }): React.JSX.Element {
  const cfg = STATUS_BADGE[status];
  return (
    <Badge variant="outline" className={cn('rounded-pill', cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

const ROLE_BADGE: Record<DeviceRow['callRole'], { className: string; label: string }> = {
  both: { className: 'border-transparent bg-text-primary text-white', label: 'Caller + Receiver' },
  caller: {
    className: 'border-brand-lavender/60 bg-brand-lavender/25 text-text-primary',
    label: 'Caller',
  },
  receiver: {
    className: 'border-brand-mint/70 bg-brand-mint/30 text-text-primary',
    label: 'Receiver only',
  },
};

function CallRoleBadge({ role }: { role: DeviceRow['callRole'] }): React.JSX.Element {
  const cfg = ROLE_BADGE[role];
  return (
    <Badge variant="outline" className={cn('rounded-pill', cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

export default function ScreenAdminMembers(): React.JSX.Element {
  const utils = trpc.useUtils();
  const devicesQuery = trpc.devices.list.useQuery();

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [roleTarget, setRoleTarget] = useState<DeviceRow | null>(null);
  const [renameTarget, setRenameTarget] = useState<DeviceRow | null>(null);
  const [confirm, setConfirm] = useState<{ device: DeviceRow; kind: 'archive' | 'remove' } | null>(
    null,
  );

  const invalidate = (): Promise<void> => utils.devices.list.invalidate();

  const rename = trpc.devices.setDisplayName.useMutation({
    onSuccess: async () => {
      await invalidate();
      setRenameTarget(null);
    },
  });
  const archive = trpc.devices.archive.useMutation({
    onSuccess: async () => {
      await invalidate();
      setConfirm(null);
    },
  });
  const unarchive = trpc.devices.unarchive.useMutation({ onSuccess: () => void invalidate() });
  const remove = trpc.devices.delete.useMutation({
    onSuccess: async () => {
      await invalidate();
      setConfirm(null);
    },
  });

  if (devicesQuery.isPending) {
    return (
      <div className="mx-auto w-full max-w-[1280px] space-y-6 px-4 py-6 md:px-12 md:py-12">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-64" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (devicesQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-12 md:py-12">
        <div className="rounded-lg border border-error-strong/30 bg-error-strong/10 p-6 text-sm text-error-strong">
          Couldn&apos;t load the directory. Please refresh and try again.
        </div>
      </div>
    );
  }

  const all = devicesQuery.data;
  const active = all.filter((d) => d.archivedAt === null);
  const onlineCount = active.filter((d) => {
    const s = deviceStatus(d);
    return s === 'online' || s === 'idle';
  }).length;
  const archivedCount = all.length - active.length;

  const matchesSearch = (d: DeviceRow): boolean =>
    search.trim() === '' || d.displayName.toLowerCase().includes(search.trim().toLowerCase());

  const visible = (
    filter === 'archived'
      ? all.filter((d) => d.archivedAt !== null)
      : filter === 'online'
        ? active.filter((d) => {
            const s = deviceStatus(d);
            return s === 'online' || s === 'idle';
          })
        : active
  ).filter(matchesSearch);

  const rowActions = (d: DeviceRow): React.JSX.Element => {
    if (d.archivedAt !== null) {
      return (
        <div className="flex flex-wrap justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => unarchive.mutate({ id: d.id })}
            disabled={unarchive.isPending}
          >
            <ArchiveRestore className="size-3.5" />
            Unarchive
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-error-strong hover:border-error-strong hover:text-error-strong"
            onClick={() => setConfirm({ device: d, kind: 'remove' })}
          >
            <Trash2 className="size-3.5" />
            Remove
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap justify-end gap-1.5">
        <Button variant="outline" size="sm" onClick={() => setRoleTarget(d)}>
          <UserCog className="size-3.5" />
          Change role
        </Button>
        <Button variant="outline" size="sm" onClick={() => setRenameTarget(d)}>
          <Pencil className="size-3.5" />
          Rename
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirm({ device: d, kind: 'archive' })}
        >
          <Archive className="size-3.5" />
          Archive
        </Button>
      </div>
    );
  };

  const filterBtn = (key: Filter, label: string): React.JSX.Element => (
    <Button
      variant={filter === key ? 'default' : 'outline'}
      size="sm"
      className="rounded-pill"
      onClick={() => setFilter(key)}
    >
      {label}
    </Button>
  );

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 px-4 py-6 md:px-12 md:py-12">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
            Admin
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">
            Members
          </h1>
          <div className="mt-1 text-sm text-text-muted">
            Manage devices, roles, and archive state
          </div>
        </div>
        <div className="text-sm text-text-muted">
          {all.length} device{all.length === 1 ? '' : 's'} · {onlineCount} online
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          {filterBtn('all', `All · ${active.length}`)}
          {filterBtn('online', `Online · ${onlineCount}`)}
          {filterBtn('archived', `Archived · ${archivedCount}`)}
        </div>
        <div className="flex-1">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members…"
            aria-label="Search members"
          />
        </div>
      </div>

      {visible.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-text-muted">
          {filter === 'archived' ? 'No archived devices.' : 'No devices match this filter.'}
        </div>
      )}

      {/* Mobile: card list */}
      <ul className="space-y-3 md:hidden">
        {visible.map((d) => {
          const status = deviceStatus(d);
          return (
            <li key={d.id} className="space-y-3 rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center gap-3">
                <div
                  aria-hidden
                  className="grid size-10 flex-shrink-0 place-items-center rounded-full bg-brand-lavender text-xs font-semibold text-text-primary"
                >
                  {initials(d.displayName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-text-primary">
                    {d.displayName}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={status} />
                    <CallRoleBadge role={d.callRole} />
                  </div>
                  <div className="mt-1 text-xs text-text-muted">{formatLastSeen(d)}</div>
                </div>
              </div>
              {rowActions(d)}
            </li>
          );
        })}
      </ul>

      {/* Desktop: table */}
      {visible.length > 0 && (
        <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
          <Table>
            <TableHeader className="bg-surface-card">
              <TableRow>
                <TableHead className="text-text-muted">Name</TableHead>
                <TableHead className="text-text-muted">Status</TableHead>
                <TableHead className="text-text-muted">Call role</TableHead>
                <TableHead className="text-text-muted">Last seen</TableHead>
                <TableHead className="text-right text-text-muted">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((d) => {
                const status = deviceStatus(d);
                return (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          aria-hidden
                          className="grid size-9 place-items-center rounded-full bg-brand-lavender text-xs font-semibold text-text-primary"
                        >
                          {initials(d.displayName)}
                        </div>
                        <div className="text-sm font-semibold text-text-primary">
                          {d.displayName}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={status} />
                    </TableCell>
                    <TableCell>
                      <CallRoleBadge role={d.callRole} />
                    </TableCell>
                    <TableCell className="text-sm text-text-muted">{formatLastSeen(d)}</TableCell>
                    <TableCell className="text-right">{rowActions(d)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Change-role overlay (S3b — self-wired to trpc.devices.setRole). */}
      {roleTarget && (
        <OverlayCallRoleAssign
          device={roleTarget}
          onClose={() => setRoleTarget(null)}
          onSaved={() => void invalidate()}
        />
      )}

      {/* Rename overlay (S3a — parent wires onSave → trpc.devices.setDisplayName). */}
      {renameTarget && (
        <OverlayNamePicker
          initialName={renameTarget.displayName}
          onClose={() => setRenameTarget(null)}
          onSave={(name) => rename.mutate({ id: renameTarget.id, displayName: name })}
          saving={rename.isPending}
        />
      )}

      {/* Destructive confirm (archive / permanent remove). */}
      {confirm && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirm(null);
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {confirm.kind === 'remove' ? 'Remove device' : 'Archive device'}
              </DialogTitle>
              <DialogDescription>
                {confirm.kind === 'remove'
                  ? `Remove “${confirm.device.displayName}” permanently? This cannot be undone.`
                  : `Archive “${confirm.device.displayName}”? They will no longer appear in the active directory.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              {confirm.kind === 'remove' ? (
                <Button
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => remove.mutate({ id: confirm.device.id })}
                  disabled={remove.isPending}
                >
                  {remove.isPending ? 'Removing…' : 'Remove'}
                </Button>
              ) : (
                <Button
                  onClick={() => archive.mutate({ id: confirm.device.id })}
                  disabled={archive.isPending}
                >
                  {archive.isPending ? 'Archiving…' : 'Archive'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
