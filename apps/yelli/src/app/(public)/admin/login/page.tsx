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
 * LAN Anonymous Admin login page (Flow E). Production port of the Phase 3.3
 * `prototype/src/screens/ScreenAdminLogin.tsx` (INHERIT-not-REPLACE — visuals
 * mapped onto shadcn primitives + Clay semantic tokens; the demo-passphrase hint
 * and prototype chrome [TenantTopBar/AppFooter/BottomNav] are intentionally
 * dropped — chrome lands with the app-shell port).
 *
 * Wiring (S3a / DECISIONS_LOG q-S3a-01 [A]): the page does NOT call next-auth
 * `signIn()`. LAN admin is the LOCKED Step 6 cookie path — it client-POSTs the
 * passphrase to the relocated Route Handler `/api/admin/login`, which calls
 * `signInLanAdmin()` and mints the `yelli_admin_session` HMAC cookie. The page
 * never sees the cookie; it only reacts to `{ ok }`.
 *
 * Generic "Couldn't sign in" on every failure (bad passphrase, rate-limited,
 * no LAN tenant) — security.md AUTH error-message rule (never reveal which).
 */

// Locked admin landing (DECISIONS_LOG Step 6 — admin console root). The route is
// built in a later admin-UI session; navigating here is the correct destination.
const ADMIN_HOME = '/admin/members';

export default function AdminLoginPage(): React.JSX.Element {
  const router = useRouter();
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = passphrase.length > 0 && !submitting;

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase }),
      });
      if (res.ok) {
        // Flow E gate re-render fix (DECISIONS_LOG deferral #1, Phase 4 pickup).
        // The prototype bug — `go('admin-members')` was a setState no-op when the
        // user was already on that screen, so successful auth appeared stuck — does
        // not exist under real URL navigation. The production fix is structurally
        // different (per the deferral): navigate for real, then invalidate the RSC
        // Router Cache so the server-side admin gate re-reads the freshly-set
        // `yelli_admin_session` cookie. `router.refresh()` is the App Router analog
        // of the deferral's "react-query invalidation".
        router.push(ADMIN_HOME);
        router.refresh();
        return;
      }
      setError("Couldn't sign in");
      setPassphrase('');
    } catch {
      setError("Couldn't sign in");
      setPassphrase('');
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
          <CardTitle className="text-2xl tracking-tight">Sign in</CardTitle>
          <CardDescription className="leading-relaxed">
            Enter the admin passphrase to access the admin console. The passphrase was
            captured during first-run setup.
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
                autoComplete="current-password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                disabled={submitting}
                autoFocus
              />
            </div>
            {error !== null && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={!canSubmit} className="w-full">
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
