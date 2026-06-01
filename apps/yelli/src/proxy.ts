import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * V25 anti-tenant-switching proxy (Next.js 16 — renamed from middleware.ts).
 *
 * Cloud routing rule (LOCKED in DECISIONS_LOG.md "Tenancy Model"): traffic to
 * `<slug>.yelli.app` MUST belong to the tenant whose slug matches the
 * subdomain. If the authenticated user's JWT carries a DIFFERENT tenantSlug,
 * redirect them to THEIR tenant's subdomain instead of serving the requested
 * one (silently). This blocks the tenant-switching URL bar attack covered by
 * security.md "TENANT MIDDLEWARE SAFETY".
 *
 * LAN mode (env.LAN_MODE_ENABLED): single implicit tenant slug=default, no
 * subdomain logic — proxy short-circuits.
 *
 * Reserved subdomains (www, api, app, _pwbt, etc. — locked at 18 values):
 * non-tenant routes (_pwbt = super-admin console, www = marketing, etc.) —
 * those bypass the cross-check.
 */

const RESERVED_SUBDOMAINS = new Set([
  "www", "api", "app", "admin", "staging", "dev",
  "_pwbt", "pwbt", "status", "blog", "docs",
  "mail", "smtp", "mx", "support", "help", "auth", "cdn",
]);

function extractSubdomain(host: string | null): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0];
  if (!hostname) return null;
  const apexes = ["yelli.app", "yelli-staging.app"];
  for (const apex of apexes) {
    if (hostname === apex) return null; // apex itself, no subdomain
    if (hostname.endsWith(`.${apex}`)) {
      return hostname.slice(0, hostname.length - apex.length - 1);
    }
  }
  // Dev / localhost / IP — no subdomain routing
  return null;
}

export async function proxy(req: NextRequest) {
  // LAN mode short-circuit
  if (process.env["LAN_MODE_ENABLED"] === "true") {
    return NextResponse.next();
  }

  const host = req.headers.get("host");
  const subdomain = extractSubdomain(host);
  if (!subdomain) return NextResponse.next();
  if (RESERVED_SUBDOMAINS.has(subdomain)) return NextResponse.next();

  // Decode session JWT (Edge-safe — no DB hit).
  const token = await getToken({
    req,
    secret: process.env["AUTH_SECRET"],
    secureCookie: process.env["NODE_ENV"] === "production",
  });

  // Unauthenticated requests pass through — login page enforces auth itself.
  if (!token || typeof token["tenantSlug"] !== "string") return NextResponse.next();

  // V25 cross-check: session tenant must match URL subdomain.
  if (token["tenantSlug"] !== subdomain) {
    const url = req.nextUrl.clone();
    // Rewrite to the user's actual tenant subdomain.
    const apex = host?.split(".").slice(-2).join(".") ?? "yelli.app";
    url.host = `${token["tenantSlug"]}.${apex}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const proxyConfig = {
  // Run on every route except static + Next.js internals.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|api/health|api/auth).*)",
  ],
};
