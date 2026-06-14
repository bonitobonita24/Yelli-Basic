'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * LAN Anonymous Admin first-run SETUP form (Flow E). Visual twin of
 * `ScreenAdminLogin` / `/admin/login` — same shadcn primitives + Clay semantic
 * tokens (INHERIT-not-REPLACE; no new visual style). Captures the initial admin
 * passphrase + confirmation and POSTs to `/api/admin/setup`, which sets the hash
 * and mints `yelli_admin_session` in one shot, logging the operator straight in.
 *
 * Generic "Couldn't complete setup" on every failure (mismatch, too short,
 * already-configured, rate-limited) — security.md AUTH error rule. Client-side
 * confirm/length checks are usability only; the route re-validates authoritatively.
 *
 * On success: navigate to `/admin/settings` then `router.refresh()` so the
 * server-side admin gate re-reads the freshly-set cookie (App Router analog of the
 * Flow E re-render fix used on the login page).
 */
const SETUP_HOME = '/admin/settings';
const MIN_LEN = 8;

export function SetupForm(): React.JSX.Element {
  const router = useRouter();
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = passphrase.length > 0 && confirm.length > 0 && !submitting;

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!canSubmit) return;

    // Usability pre-checks (the route is the authority; these just save a round trip).
    if (passphrase.length < MIN_LEN) {
      setError(`Passphrase must be at least ${MIN_LEN} characters.`);
      return;
    }
    if (passphrase !== confirm) {
      setError("Passphrases don't match.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase, confirm }),
      });
      if (res.ok) {
        router.push(SETUP_HOME);
        router.refresh();
        return;
      }
      setError("Couldn't complete setup");
      setPassphrase('');
      setConfirm('');
    } catch {
      setError("Couldn't complete setup");
      setPassphrase('');
      setConfirm('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-4 py-12 md:py-16">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            LAN admin
          </div>
          <CardTitle className="text-2xl tracking-tight">First-run setup</CardTitle>
          <CardDescription className="leading-relaxed">
            Choose an admin passphrase for this deployment. It gates the admin console
            and can be reset on the host. Keep it somewhere safe — it is not recoverable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label
                htmlFor="passphrase"
                className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              >
                Passphrase
              </Label>
              <Input
                id="passphrase"
                type="password"
                autoComplete="new-password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                disabled={submitting}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="confirm"
                className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              >
                Confirm passphrase
              </Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={submitting}
              />
            </div>
            {error !== null && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={!canSubmit} className="w-full">
              {submitting ? 'Setting up…' : 'Set passphrase'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
