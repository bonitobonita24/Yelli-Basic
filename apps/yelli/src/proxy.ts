import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * V25 anti-tenant-switching proxy (LOCKED: Next.js 16 proxy.ts convention). Next 16
 * renamed `middleware.ts`/`middleware()` to `proxy.ts`/`proxy()` + `proxyConfig`.
 * Edge-safe: reads the JWT via `getToken` (no DB hit at this layer; the jwt
 * callback does the DB validation).
 *
 * Cloud edition cross-checks the request subdomain slug against `token.tenantSlug`
 * and redirects on mismatch (prevents typing `other-tenant.yelli.app` to reach
 * another tenant). LAN edition is single-tenant and bypasses the check. The full
 * subdomain-parse + redirect logic lands in the Wire session; this skeleton wires
 * the interception surface + matcher and the edge-safe token read.
 */
export async function proxy(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.next();
  }
  await getToken({ req, secret });
  // TODO (Wire): parse the subdomain slug from req.headers host; if the user is
  // authenticated and token.tenantSlug !== slug → redirect to the user's own
  // tenant host (or /login). LAN single-tenant edition bypasses entirely.
  return NextResponse.next();
}

export const proxyConfig = {
  // Intercept every non-static, non-auth request. `api/auth` is excluded so the
  // Auth.js handler runs unproxied; static assets and files are skipped.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\..*).*)'],
};
