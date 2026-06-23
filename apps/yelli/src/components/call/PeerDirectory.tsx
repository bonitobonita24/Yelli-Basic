'use client';

/**
 * Peer Directory (B1 — device-home Flow A entry surface). The live tile list
 * driven by `trpc.devices.list`, replacing the prototype's `sim.devices.list`
 * SWAP BOUNDARY.
 *
 * Visibility / rule snapshot:
 *   • Self is hidden — you don't call yourself.
 *   • Archived devices are hidden — they cannot be CALL targets.
 *   • The CALL button is shown ONLY when the peer's `callRole` allows receiving
 *     (`receiver` or `both`) AND we (selfDeviceId) can call ('caller'/'both').
 *     This is the LOCKED "hide-CALL" half of the Step 3 rule; the server-side
 *     `forbidden-by-role` rejection (CallSession created already-ended) is the
 *     second half and runs regardless.
 *   • Online presence (PRODUCT.md: lastSeenAt within 5 min) shows a green dot;
 *     offline tiles still render but the CALL button is disabled.
 *
 * Click → `useCallEngine().placeCall(...)` — the orchestrator owns the mesh
 * RTCPeerConnection lifecycle. Single-tap places a 1-on-1 call; multi-select
 * (up to 2 peers) starts a group call (cap 3 incl. self) via `placeCall(ids)`.
 */

import { Phone, Users } from 'lucide-react';
import { useState } from 'react';

import { useCallEngine } from '@/components/call/CallEngineProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { trpc } from '@/lib/trpc/react';

/** Max callees selectable for a group call (cap 3 participants incl. self). */
const MAX_GROUP_CALLEES = 2;

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '–';
  return trimmed
    .split(/\s+/)
    .flatMap((n) => (n[0] ? [n[0]] : []))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function isOnline(lastSeenAt: Date | string | null): boolean {
  if (!lastSeenAt) return false;
  const t = typeof lastSeenAt === 'string' ? new Date(lastSeenAt).getTime() : lastSeenAt.getTime();
  return Date.now() - t < ONLINE_WINDOW_MS;
}

export function PeerDirectory(): React.JSX.Element {
  const { selfDeviceId, placeCall, busy } = useCallEngine();
  // Group-call multi-select: device ids chosen for a single group placement.
  const [selected, setSelected] = useState<string[]>([]);

  const toggleSelected = (id: string): void => {
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= MAX_GROUP_CALLEES) return cur; // cap at 2 — ignore extra
      return [...cur, id];
    });
  };

  const listQuery = trpc.devices.list.useQuery(undefined, {
    // Light polling keeps the directory fresh enough for presence without the
    // realtime device-event channel that lands with the broader presence work.
    refetchInterval: 15_000,
  });

  if (listQuery.isPending) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="h-[88px] animate-pulse bg-surface" />
        ))}
      </div>
    );
  }
  if (listQuery.isError || !listQuery.data) {
    // Differentiate no-session (q-W2b-04 deferred) from genuine failures.
    // An UNAUTHORIZED error means the visitor has no session — show a calm
    // sign-in prompt instead of a scary red alert.
    if (listQuery.error?.data?.code === 'UNAUTHORIZED') {
      return (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-text-muted">Sign in to see the people you can call.</p>
          <Button asChild variant="outline" size="sm">
            <a href="/login">Sign in</a>
          </Button>
        </div>
      );
    }
    return (
      <p role="alert" className="text-sm text-error-strong">
        Couldn&apos;t load the directory.
      </p>
    );
  }

  const peers = listQuery.data.filter((d) => d.id !== selfDeviceId && d.archivedAt === null);

  if (peers.length === 0) {
    return <p className="text-sm text-text-muted">No other devices in this organisation yet.</p>;
  }

  // Resolve our own callRole to decide whether to show the CALL action at all.
  const self = listQuery.data.find((d) => d.id === selfDeviceId);
  const selfCanCall = self ? self.callRole === 'caller' || self.callRole === 'both' : false;

  // Selection is only meaningful for peers still present + callable; drop stale ids.
  const validSelected = selected.filter((id) => peers.some((p) => p.id === id));
  const groupCallDisabled = busy || !selfDeviceId || validSelected.length === 0;

  return (
    <div className="space-y-3">
      {selfCanCall && validSelected.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
          <span className="text-sm text-text-primary">
            {validSelected.length === 1
              ? '1 person selected'
              : `${validSelected.length} people selected`}
            {validSelected.length === MAX_GROUP_CALLEES ? ' (max)' : ''}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelected([])}
            >
              Clear
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={groupCallDisabled}
              onClick={() => {
                placeCall(validSelected);
                setSelected([]);
              }}
            >
              <Users className="mr-1.5 size-4" />
              Call {validSelected.length === 1 ? 'them' : 'group'}
            </Button>
          </div>
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="People you can call">
        {peers.map((peer) => {
          const online = isOnline(peer.lastSeenAt);
          const peerCanReceive = peer.callRole === 'receiver' || peer.callRole === 'both';
          const showCall = selfCanCall && peerCanReceive;
          const callDisabled = busy || !online || !selfDeviceId;
          const isSelected = validSelected.includes(peer.id);
          const selectDisabled = !isSelected && validSelected.length >= MAX_GROUP_CALLEES;
          return (
            <li key={peer.id}>
              <Card className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    aria-hidden
                    className="grid size-11 flex-shrink-0 place-items-center rounded-full bg-brand-lavender text-sm font-semibold text-text-primary"
                  >
                    {initials(peer.displayName)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-text-primary">
                      {peer.displayName || 'Unnamed device'}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                      <span
                        aria-hidden
                        className={
                          'inline-block size-2 rounded-full ' +
                          (online ? 'bg-success' : 'bg-text-muted/40')
                        }
                      />
                      {online ? 'Online' : 'Offline'} · {peer.callRole}
                    </div>
                  </div>
                </div>
                {showCall && (
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <label
                      className={
                        'flex cursor-pointer items-center gap-1 text-xs text-text-muted ' +
                        (selectDisabled ? 'cursor-not-allowed opacity-40' : '')
                      }
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={selectDisabled || !online}
                        onChange={() => toggleSelected(peer.id)}
                        aria-label={`Select ${peer.displayName || 'device'} for a group call`}
                        className="size-4 accent-brand-teal"
                      />
                      Group
                    </label>
                    <button
                      type="button"
                      onClick={() => placeCall(peer.id)}
                      disabled={callDisabled}
                      aria-label={`Call ${peer.displayName || 'device'}`}
                      className="grid size-11 place-items-center rounded-full bg-brand-teal text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Phone className="size-5" />
                    </button>
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
