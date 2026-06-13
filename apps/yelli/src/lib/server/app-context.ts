import { prisma } from '@yelli/db';

import { auth } from '@/server/auth/config';
import { getLanAdminSession } from '@/server/auth/lan-admin';

/**
 * Server-resolved app-shell context (W1b / S4).
 *
 * The app shell needs three things the chrome can't safely fetch client-side:
 *   1. `isAdmin` — Cloud admins carry `role: 'admin'` on the Auth.js session; LAN
 *      admins carry NO Auth.js session at all — they hold the signed
 *      `yelli_admin_session` cookie (Step 6). A client `useSession()` is therefore
 *      blind to LAN admins, so the role MUST be resolved server-side from BOTH
 *      sources and passed down as a prop.
 *   2. `brand` — the brief named `trpc.brand.get`, which does not exist (the `brand`
 *      router only has `update`). The brand lives on `Tenant` and is exposed by
 *      `tenants.get` — but `tenants.get` is a `protectedProcedure` and throws
 *      UNAUTHORIZED for LAN-anonymous admins (no Auth.js user). Resolving the brand
 *      server-side from the tenant id works for BOTH editions and avoids a client
 *      round-trip flash. (Brief-vs-reality reconciliation, same class as S3c/S3d.)
 *   3. `userLabel` — the avatar/name shown in the top bar.
 *
 * Uses the base (unguarded) prisma client for a tenant SELF-lookup by id — there is
 * no cross-tenant exposure (the id comes from the verified session/cookie), and the
 * L6 tenant-guard is a tRPC-context concern, not an app-shell concern.
 */
export type AppShellBrand = {
  displayName: string;
  slug: string;
  logoUrl: string | null;
};

export type AppShellContext = {
  isAdmin: boolean;
  tenantId: string | null;
  userLabel: string | null;
  brand: AppShellBrand | null;
};

export async function resolveAppShellContext(): Promise<AppShellContext> {
  const session = await auth();

  let tenantId: string | null = session?.user?.tenantId ?? null;
  let isAdmin = session?.user?.role === 'admin';
  let userLabel: string | null = session?.user?.name ?? session?.user?.email ?? null;

  // LAN-anonymous admin path: no Auth.js session, but a valid signed cookie.
  if (!session) {
    const lan = await getLanAdminSession();
    if (lan.valid) {
      tenantId = lan.tenantId;
      isAdmin = true;
      userLabel = 'Admin';
    }
  }

  let brand: AppShellBrand | null = null;
  if (tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { displayName: true, slug: true, logoUrl: true },
    });
    if (tenant) brand = tenant;
  }

  return { isAdmin, tenantId, userLabel, brand };
}
