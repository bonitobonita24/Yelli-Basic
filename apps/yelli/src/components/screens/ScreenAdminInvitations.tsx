'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc, type RouterOutputs } from '@/lib/trpc/react';
import { cn } from '@/lib/utils';

/**
 * Admin → Invitations (PROTOTYPE.md Flow F "Invite member by email"). Production
 * port of the Phase 3.3 signed-off `prototype/src/screens/ScreenAdminInvitations.tsx`
 * (INHERIT-not-REPLACE).
 *
 * SWAP BOUNDARY wiring (replaces the prototype's `sim.invitations`):
 *   - `trpc.invitations.list`   — all invites (newest first; admin-gated)
 *   - `trpc.invitations.create` — invite by email (invitedBy = the session user, so
 *                                 the prototype's `ensureAdminUser` sim hack vanishes)
 *   - `trpc.invitations.revoke` — immediately expire a pending invite
 *   - `trpc.invitations.resend` — re-issue a fresh token + 7-day window
 *
 * Prototype-affordance reconciliation: the prototype's "Open link" action navigated
 * the sim to the join screen using the raw invite id. In production the raw token is
 * NEVER returned to the client (INVITATION_SELECT omits tokenHash; the token travels
 * only in the queued email), so a client-side invite URL cannot be reconstructed.
 * The production-correct re-delivery is `resend` — so pending invites expose
 * Resend + Revoke (same intent, faithful to "manage the pending invite"). Same
 * substitution class as S3a's Flow E gate fix.
 *
 * Fully a Client Component (tRPC-react-query). Chrome dropped (W1b mounts behind the
 * admin gate). Clay semantic tokens only (ui-rules Rule 3). Loading = shadcn
 * `<Skeleton>` (ui-rules Rule 11 PATH A).
 */

type InvitationRow = RouterOutputs['invitations']['list'][number];
type Status = 'pending' | 'accepted' | 'expired';

function statusOf(inv: InvitationRow): Status {
  if (inv.acceptedAt !== null) return 'accepted';
  if (new Date(inv.expiresAt).getTime() <= Date.now()) return 'expired';
  return 'pending';
}

// Tones reproduced verbatim from the signed-off prototype Pill mapping:
// pending → green, accepted + expired → ink (INHERIT-not-REPLACE).
const STATUS_BADGE: Record<Status, { className: string; label: string }> = {
  pending: { className: 'border-success/30 bg-success/15 text-success-strong', label: 'Pending' },
  accepted: { className: 'border-transparent bg-text-primary text-white', label: 'Accepted' },
  expired: { className: 'border-transparent bg-text-primary text-white', label: 'Expired' },
};

function StatusBadge({ status }: { status: Status }): React.JSX.Element {
  const cfg = STATUS_BADGE[status];
  return (
    <Badge variant="outline" className={cn('rounded-pill', cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

export default function ScreenAdminInvitations(): React.JSX.Element {
  const utils = trpc.useUtils();
  const invitationsQuery = trpc.invitations.list.useQuery();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const invalidate = (): Promise<void> => utils.invitations.list.invalidate();

  const create = trpc.invitations.create.useMutation({
    onSuccess: async () => {
      await invalidate();
      setEmail('');
      setError(null);
    },
    onError: (e) => setError(e.message),
  });
  const revoke = trpc.invitations.revoke.useMutation({ onSuccess: () => void invalidate() });
  const resend = trpc.invitations.resend.useMutation({ onSuccess: () => void invalidate() });

  const handleCreate = (e: React.FormEvent): void => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Enter a valid email');
      return;
    }
    create.mutate({ email: trimmed });
  };

  const all = invitationsQuery.data ?? [];
  const pending = all.filter((i) => statusOf(i) === 'pending');
  const busyId = revoke.variables?.id ?? resend.variables?.id;

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 px-4 py-6 md:px-12 md:py-12">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
            Admin
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">
            Invitations
          </h1>
          <div className="mt-1 text-sm text-text-muted">
            Invite a member by email · 7-day expiry
          </div>
        </div>
        <div className="text-sm text-text-muted">
          {pending.length} pending · {all.length} total
        </div>
      </header>

      <section className="rounded-lg border border-border bg-surface p-4 md:p-6">
        <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <Label
              htmlFor="invite-email"
              className="mb-1 block uppercase tracking-[0.08em] text-text-muted"
            >
              Email
            </Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="member@example.com"
              aria-invalid={error !== null}
            />
            {error && (
              <p role="alert" className="mt-1 text-xs text-error-strong">
                {error}
              </p>
            )}
          </div>
          <Button type="submit" disabled={create.isPending} className="sm:mt-6">
            {create.isPending ? 'Sending…' : 'Send invite'}
          </Button>
        </form>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-surface">
        {invitationsQuery.isPending ? (
          <ul className="divide-y divide-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="p-4 md:px-6 md:py-4">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="mt-2 h-4 w-32" />
              </li>
            ))}
          </ul>
        ) : invitationsQuery.isError ? (
          <div className="p-8 text-center text-sm text-error-strong">
            Couldn&apos;t load invitations. Please refresh and try again.
          </div>
        ) : all.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted">No invitations yet</div>
        ) : (
          <ul className="divide-y divide-border">
            {all.map((inv) => {
              const status = statusOf(inv);
              const busy = busyId === inv.id && (revoke.isPending || resend.isPending);
              return (
                <li
                  key={inv.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center md:px-6 md:py-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-text-primary">
                      {inv.email}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StatusBadge status={status} />
                      <span className="text-xs text-text-muted">
                        {status === 'pending' &&
                          `expires ${new Date(inv.expiresAt).toLocaleDateString()}`}
                        {status === 'accepted' &&
                          inv.acceptedAt &&
                          `accepted ${new Date(inv.acceptedAt).toLocaleDateString()}`}
                        {status === 'expired' && 'expired'}
                      </span>
                    </div>
                  </div>
                  {status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resend.mutate({ id: inv.id })}
                        disabled={busy}
                      >
                        {busy && resend.variables?.id === inv.id ? 'Resending…' : 'Resend'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-error-strong hover:border-error-strong hover:text-error-strong"
                        onClick={() => revoke.mutate({ id: inv.id })}
                        disabled={busy}
                      >
                        Revoke
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
