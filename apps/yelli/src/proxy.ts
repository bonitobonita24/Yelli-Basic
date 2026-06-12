import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { isReservedSlug } from '@yelli/shared';

/**
 * V25 anti-tenant-switching proxy (LOCKED: Next.js 16 proxy.ts convention). Next 16
 * renamed `middleware.ts`/`middleware()` to `proxy.ts`/`proxy()` + `proxyConfig`.
 * Edge-safe: reads the JWT via `getToken` (no DB hit here; the jwt callback owns
 * freshness). `@yelli/shared` is barrel-pure (zod + enums only) — safe to import here.
 *
 * Cloud edition only: cross-check the request subdomain slug against the signed-in
 * `token.tenantSlug` and redirect on mismatch — this is what stops a user typing
 * `other-tenant.yelli.app` to reach a tenant that is not theirs (DECISIONS [Step 6]:
 * `session.tenantId === URL.slug.tenantId` on every Cloud request). LAN is single-
 * tenant and disables the subdomain router entirely (DECISIONS [Step 1]).
 *
 * Edition + base domain come from the runtime env (read directly off process.env,
 * mirroring the existing AUTH_SECRET check — the proxy never imports the zod-parsed
 * `env` module so it stays edge-light). When EDITION is not `cloud`, or no base
 * domain is configured (LAN / dev), the proxy is a transparent pass-through.
 */
function extractTenantSlug(host: string, baseDomain: string): string | null {
  if (!host || host === baseDomain) return null; // apex (e.g. yelli.app) → not a tenant.
  const suffix = '.' + baseDomain;
  if (!host.endsWith(suffix)) return null; // localhost / IP / foreign host → not Cloud-routed.
  const label = host.slice(0, host.length - suffix.length);
  if (label === '' || label.includes('.')) return null; // empty or multi-level → not a slug.
  if (isReservedSlug(label)) return null; // app./www./api. etc. — Traefik owns these routers.
  return label;
}

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return NextResponse.next();

  const edition = process.env.EDITION ?? 'lan';
  const baseDomain = process.env.APP_BASE_DOMAIN;
  // LAN single-tenant (or unconfigured base) → subdomain router disabled.
  if (edition !== 'cloud' || !baseDomain) return NextResponse.next();

  const host = (req.headers.get('host') ?? '').split(':')[0]?.toLowerCase() ?? '';
  const slug = extractTenantSlug(host, baseDomain.toLowerCase());
  if (!slug) return NextResponse.next();

  // Unauthenticated requests pass through — the login page handles them. We only
  // enforce the cross-check for signed-in users carrying a tenantSlug.
  const token = await getToken({ req, secret });
  if (!token?.tenantSlug) return NextResponse.next();

  if (token.tenantSlug !== slug) {
    // Requested subdomain ≠ the user's own tenant → redirect to their own host,
    // preserving path + query (hostname swap keeps any port).
    const url = req.nextUrl.clone();
    url.hostname = `${token.tenantSlug}.${baseDomain}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const proxyConfig = {
  // Intercept every non-static, non-auth request. `api/auth` is excluded so the
  // Auth.js handler runs unproxied; static assets and files are skipped.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\..*).*)'],
};
