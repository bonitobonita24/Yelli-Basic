import { redirect } from 'next/navigation';

import { lanAdminConfigured } from '@/server/auth/lan-admin';

import { SetupForm } from './SetupForm';

/**
 * LAN Anonymous Admin first-run SETUP page (Flow E companion to `/admin/login`).
 * Server-gated: if a passphrase is ALREADY configured this is not a first-run, so
 * setup must refuse — redirect to `/admin/login`. The reciprocal redirect (no
 * passphrase → `/admin/*` routes here) lives in the admin layout guard.
 *
 * Lives in the `(public)` group, outside the gated `/admin` subtree, so it renders
 * for an unauthenticated operator on a fresh LAN deploy.
 */
export const dynamic = 'force-dynamic';

export default async function SetupPage(): Promise<React.JSX.Element> {
  if (await lanAdminConfigured()) redirect('/admin/login');
  return <SetupForm />;
}
