'use client';

import { useState, type FormEvent } from 'react';
import TenantTopBar from '@/components/TenantTopBar';
import AppFooter from '@/components/AppFooter';
import BottomNav from '@/components/BottomNav';
import { adminSession } from '@/lib/sim';

type Props = {
  go: (screen: string) => void;
  tenantId: string;
};

export function ScreenAdminLogin(props: Props): JSX.Element {
  const { go, tenantId } = props;
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    const result = adminSession.login(tenantId, passphrase);
    if (result.ok) {
      go('admin-members');
    } else {
      setError("Couldn't sign in");
      setPassphrase('');
    }
  };

  return (
    <div className="min-h-screen bg-[#fffaf0] flex flex-col pb-20 md:pb-0">
      <TenantTopBar go={go} currentScreen="admin-login" />
      <main className="flex-1 max-w-md w-full mx-auto px-4 md:px-6 py-12 md:py-16 flex flex-col justify-center">
        <div className="rounded-[16px] border border-[#e5e5e5] bg-[#fffaf0] p-6 md:p-8">
          <div className="text-[12px] font-semibold tracking-[0.16em] uppercase text-[#6a6a6a]">LAN admin</div>
          <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">Sign in</h1>
          <p className="mt-2 text-[13px] text-[#6a6a6a] leading-[1.55]">
            Enter the admin passphrase to access the admin console. The passphrase was captured during first-run setup.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="passphrase" className="block text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">
                Passphrase
              </label>
              <input
                id="passphrase"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                autoFocus
                className="mt-2 w-full h-11 px-3 rounded-[8px] border border-[#e5e5e5] bg-[#fffaf0] text-[14px] focus:outline-none focus:border-[#0a0a0a]"
              />
            </div>
            {error !== null && (
              <div className="text-[13px] text-[#b91c1c]" role="alert">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={passphrase.length === 0}
              className="w-full h-11 rounded-[8px] bg-[#0a0a0a] text-white text-[14px] font-semibold disabled:bg-[#e5e5e5] disabled:text-[#9a9a9a] hover:bg-[#1f1f1f]"
            >
              Sign in
            </button>
            <div className="text-[12px] text-[#6a6a6a]">
              Demo passphrase: <span className="font-mono">yelli-admin</span>
            </div>
          </form>
        </div>
      </main>
      <AppFooter />
      <BottomNav go={go} currentScreen="admin-login" />
    </div>
  );
}
