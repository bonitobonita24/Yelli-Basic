import { NextResponse } from 'next/server';
import { z } from 'zod';

import { setLanAdminPassphrase } from '@/server/auth/lan-admin';

/**
 * LAN Anonymous Admin first-run SETUP endpoint (Step 6 LOCKED, companion to
 * `/api/admin/login`). Non-tRPC: manual auth required. Sets the initial
 * `Tenant.adminPassphraseHash` (Argon2id) via `setLanAdminPassphrase` ONLY on
 * first-run (no passphrase configured yet), then mints the `yelli_admin_session`
 * cookie so the operator is logged straight in.
 *
 * Mirrors `/api/admin/login`'s structure exactly: Zod body validation, a confirm
 * field, process-local 5/min/IP rate limit (LAN is single-process — sufficient;
 * migrates to the Valkey token bucket when it lands), and `runtime = 'nodejs'`
 * (Argon2id is native, never Edge).
 *
 * Generic { ok: false } on EVERY failure (bad input, mismatch, already-configured,
 * no tenant, rate-limited) — security.md AUTH error-message rule (never reveal
 * whether the LAN tenant / setup-state is the reason). The already-configured case
 * is indistinguishable from any other failure to the client.
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

// Min length is a usability floor, not a strength oracle — failures stay generic.
const bodySchema = z
  .object({
    passphrase: z.string().min(8).max(256),
    confirm: z.string().min(1).max(256),
  })
  .refine((b) => b.passphrase === b.confirm, { path: ['confirm'] });

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

  const result = await setLanAdminPassphrase(parsed.data.passphrase);
  if (!result.ok) {
    // 409-ish state (already configured) is folded into a generic 401 so the client
    // cannot distinguish first-run-refused from any other failure (no setup-state leak).
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
