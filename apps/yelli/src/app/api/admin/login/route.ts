import { NextResponse } from 'next/server';
import { z } from 'zod';

import { signInLanAdmin } from '@/server/auth/lan-admin';

/**
 * LAN Anonymous Admin login endpoint (Step 6 LOCKED). The Auth.js authorize()
 * path handles Cloud user accounts; this Route Handler handles the LAN-only
 * passphrase flow that mints a `yelli_admin_session` cookie via `signInLanAdmin`.
 *
 * Rate limit — 5 attempts / minute / IP (LOCKED Step 6) — enforced inline at the
 * Route Handler boundary because the tRPC `rateLimitMiddleware` is itself still a
 * skeleton (no Valkey enforcement yet) and this path is non-tRPC. The map is
 * process-local; LAN runs single-process so this is sufficient. When the Valkey
 * token-bucket middleware lands, this should migrate to that shared store.
 *
 * Generic { ok: false } on EVERY failure (bad input, no LAN tenant, wrong
 * passphrase, rate-limited) — security.md AUTH error-message rule (never reveal
 * whether the LAN tenant / setup-state / passphrase is correct).
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

const attempts = new Map<string, number[]>();

function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || 'unknown';
  const real = req.headers.get('x-real-ip');
  return real?.trim() || 'unknown';
}

/** True if the IP is over budget; records the attempt timestamp either way. */
function exceedsRateLimit(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const prior = (attempts.get(ip) ?? []).filter((t) => t > cutoff);
  prior.push(now);
  attempts.set(ip, prior);
  return prior.length > RATE_LIMIT_MAX;
}

const bodySchema = z.object({ passphrase: z.string().min(1).max(256) });

export async function POST(req: Request): Promise<NextResponse> {
  if (exceedsRateLimit(clientIp(req))) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const result = await signInLanAdmin(parsed.data.passphrase);
  if (!result.ok) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
