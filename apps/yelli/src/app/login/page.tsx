'use client';

import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Inner component that reads searchParams (wrapped in Suspense by the page export).
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';

  const [tenantSlug, setTenantSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const result = await signIn('credentials', {
        tenantSlug: tenantSlug.trim(),
        email: email.trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid credentials. Please check your workspace, email, and password.');
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        {/* Brand mark */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-brand-teal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 512 512"
              className="w-8 h-8"
              aria-hidden="true"
            >
              <path
                d="M160 150 L256 280 L352 150"
                fill="none"
                stroke="#fffaf0"
                strokeWidth="64"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line
                x1="256"
                y1="280"
                x2="256"
                y2="372"
                stroke="#fffaf0"
                strokeWidth="64"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            Sign in to Yelli
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Dual-mode calling for marine ops and small teams
          </p>
        </div>

        {/* Login card */}
        <div
          className="rounded-2xl border border-border bg-surface p-8 shadow-sm"
        >
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="tenantSlug" className="text-sm font-medium text-text-primary">
                Workspace
              </Label>
              <Input
                id="tenantSlug"
                type="text"
                autoComplete="organization"
                placeholder="your-workspace"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                required
                disabled={pending}
                className="min-h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-text-primary">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={pending}
                className="min-h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-text-primary">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={pending}
                className="min-h-11"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="text-sm rounded-lg px-3 py-2.5 bg-error/10 text-error-strong"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full min-h-11 font-medium"
              disabled={pending}
            >
              {pending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-text-muted mt-6">
          Powerbyte IT Solutions &mdash; Lipa City, Philippines
        </p>
        {/* RA 10173: privacy notice at point of data collection (security.md R33) */}
        <p className="text-center text-xs text-text-muted mt-2">
          By signing in you acknowledge our{' '}
          <a
            href="/privacy"
            className="underline underline-offset-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-sm"
          >
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
