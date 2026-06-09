'use client';

import { useMemo, useState } from 'react';
import AppFooter from '@/components/AppFooter';
import { invitations, users, type Invitation } from '@/lib/sim';

interface ScreenJoinByInviteProps {
  go: (screen: string) => void;
  tenantId: string;
  invitationId: string | null;
}

type Phase = 'review' | 'accepted' | 'invalid';

export function ScreenJoinByInvite({ go, tenantId, invitationId }: ScreenJoinByInviteProps): JSX.Element {
  const initial: { inv: Invitation | null; phase: Phase } = useMemo(() => {
    if (!invitationId) return { inv: null, phase: 'invalid' };
    const inv = invitations.byId(invitationId);
    if (!inv) return { inv: null, phase: 'invalid' };
    if (inv.tenantId !== tenantId) return { inv: null, phase: 'invalid' };
    if (inv.acceptedAt !== null) return { inv, phase: 'accepted' };
    if (new Date(inv.expiresAt).getTime() <= Date.now()) return { inv, phase: 'invalid' };
    return { inv, phase: 'review' };
  }, [invitationId, tenantId]);

  const [phase, setPhase] = useState<Phase>(initial.phase);
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAccept = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!initial.inv) return;
    const name = displayName.trim();
    if (!name) {
      setError('Enter your name');
      return;
    }
    // Provision the member user, then mark the invitation accepted (audit emit
    // `invitation.accept` happens inside the sim repo).
    const existing = users.byEmail(initial.inv.email, tenantId);
    if (!existing) {
      users.create({
        tenantId,
        email: initial.inv.email,
        displayName: name,
        role: 'member',
      });
    }
    invitations.accept(initial.inv.id);
    setPhase('accepted');
  };

  return (
    <div className="min-h-screen bg-[#fffaf0] flex flex-col">
      <main className="flex-1 grid place-items-center px-4 py-12">
        <div className="w-full max-w-[480px] rounded-[16px] border border-[#e5e5e5] bg-white p-6 md:p-8 space-y-5">
          <div>
            <div className="text-[12px] font-semibold tracking-[0.16em] uppercase text-[#6a6a6a]">Yelli</div>
            <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-[#0a0a0a]">Join invitation</h1>
          </div>

          {phase === 'invalid' && (
            <div className="space-y-3">
              <div className="text-[14px] text-[#0a0a0a]">
                This invitation is invalid, expired, or has been revoked.
              </div>
              <button
                onClick={() => go('admin-invitations')}
                className="h-11 px-4 rounded-[8px] bg-[#0a0a0a] text-white text-[13px] font-semibold hover:opacity-90"
              >Back to invitations</button>
            </div>
          )}

          {phase === 'accepted' && initial.inv && (
            <div className="space-y-3">
              <div className="text-[14px] text-[#0a0a0a]">
                Invitation for <span className="font-semibold">{initial.inv.email}</span> accepted. The member can now sign in.
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => go('app')}
                  className="h-11 px-4 rounded-[8px] bg-[#0a0a0a] text-white text-[13px] font-semibold hover:opacity-90"
                >Open directory</button>
                <button
                  onClick={() => go('admin-invitations')}
                  className="h-11 px-4 rounded-[8px] border border-[#e5e5e5] text-[13px] font-semibold text-[#0a0a0a] hover:border-[#0a0a0a]"
                >Back to invitations</button>
              </div>
            </div>
          )}

          {phase === 'review' && initial.inv && (
            <form onSubmit={handleAccept} className="space-y-4">
              <div className="text-[14px] text-[#0a0a0a]">
                You've been invited as <span className="font-semibold">{initial.inv.email}</span>.
              </div>
              <div>
                <label className="block text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a] mb-1">Your name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => { setDisplayName(e.target.value); setError(null); }}
                  placeholder="e.g. Sam Reyes"
                  className="w-full h-11 px-3 rounded-[8px] border border-[#e5e5e5] bg-white text-[14px] focus:outline-none focus:border-[#0a0a0a]"
                  autoFocus
                />
                {error && <div className="mt-1 text-[12px] text-[#b1453b]">{error}</div>}
              </div>
              <button
                type="submit"
                className="h-11 px-5 rounded-[8px] bg-[#0a0a0a] text-white text-[13px] font-semibold hover:opacity-90"
              >Accept &amp; join</button>
            </form>
          )}
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
