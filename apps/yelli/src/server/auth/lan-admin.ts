import { createHmac, timingSafeEqual } from 'node:crypto';

import { verify as argon2Verify } from '@node-rs/argon2';
import { cookies } from 'next/headers';

import { prisma } from '@yelli/db';

/**
 * LAN Anonymous Admin (LOCKED, Step 6). The LAN edition has no Accounts — a single
 * Argon2id passphrase on `Tenant.adminPassphraseHash` gates `/admin/*` + `/setup`
 * via the HttpOnly `yelli_admin_session` cookie (30-day rolling, SameSite=Lax,
 * Secure on HTTPS). Reset runs via `./scripts/reset-admin-passphrase.sh` on the host.
 *
 * Session token format: `${tenantId}.${issuedAtMs}.${hmacSHA256(tenantId.issuedAtMs, AUTH_SECRET)}`.
 * No DB hit on every request — the HMAC is the integrity proof; issuance recency
 * is checked against TTL. The 5/min/IP rate limit lives at the route handler that
 * wires this (it needs the request IP, which isn't reachable here) — surfaced as a
 * follow-up; this module is pure backend verification + audit.
 *
 * Cloud edition: every Tenant has `adminPassphraseHash: null`, so `signInLanAdmin`
 * always fails on Cloud (which is correct — Cloud uses Auth.js).
 */
export const LAN_ADMIN_COOKIE = 'yelli_admin_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30-day rolling (LOCKED Step 6).

/** AUTH_SECRET must exist + be ≥32 chars — an empty fallback would make the HMAC
 *  signature deterministic and forge-able (auth-bypass). env.ts already enforces
 *  presence via Zod; this is a defence-in-depth fail-closed at the signer. */
function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET is required (>=32 chars) for LAN admin session signing');
  }
  return secret;
}

function hmac(payload: string): string {
  return createHmac('sha256', getAuthSecret()).update(payload).digest('hex');
}

/** Constant-time equal for hex strings of equal length (HMAC compare). */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

function signSessionToken(tenantId: string, issuedAtMs: number): string {
  const payload = `${tenantId}.${issuedAtMs}`;
  return `${payload}.${hmac(payload)}`;
}

function parseSessionToken(token: string): { tenantId: string; issuedAtMs: number } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [tenantId, issuedAtStr, sig] = parts;
  if (!tenantId || !issuedAtStr || !sig) return null;
  const issuedAtMs = Number(issuedAtStr);
  if (!Number.isFinite(issuedAtMs)) return null;
  const expected = hmac(`${tenantId}.${issuedAtStr}`);
  if (!safeEqualHex(sig, expected)) return null;
  return { tenantId, issuedAtMs };
}

/**
 * Resolve the implicit LAN tenant — LAN runs a single tenant per deployment
 * (`EDITION=lan` Step 1). Returns the earliest-created tenant carrying a
 * passphrase hash; null if none configured (`/setup` flow not yet completed).
 */
async function resolveLanTenant(): Promise<{ id: string; adminPassphraseHash: string } | null> {
  const tenant = await prisma.tenant.findFirst({
    where: { adminPassphraseHash: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, adminPassphraseHash: true },
  });
  if (!tenant?.adminPassphraseHash) return null;
  return { id: tenant.id, adminPassphraseHash: tenant.adminPassphraseHash };
}

/**
 * Verify a candidate passphrase against the LAN tenant's Argon2id hash. On success,
 * issues a 30-day signed cookie and emits `lan.admin.login.success`; on failure
 * (or no LAN tenant) emits `lan.admin.login.fail`. AuditLog is L6-excluded so we
 * write through the base client with tenantId passed explicitly (security.md #10).
 *
 * Returns `{ ok: true, tenantId, role: 'admin' }` on success, `{ ok: false }`
 * otherwise. Generic boolean satisfies security.md's "never reveal whether tenant
 * exists" AUTH rule.
 */
export async function signInLanAdmin(
  passphrase: string,
): Promise<{ ok: true; tenantId: string; role: 'admin' } | { ok: false }> {
  const tenant = await resolveLanTenant();
  if (!tenant) {
    // No LAN tenant / setup not done — best-effort audit (no tenantId to bind to).
    await prisma.auditLog
      .create({
        data: {
          tenantId: null,
          actorUserId: null,
          action: 'lan.admin.login.fail',
          targetType: 'Tenant',
          targetId: null,
          payload: { reason: 'no_lan_tenant' },
        },
      })
      .catch(() => {});
    return { ok: false };
  }

  let ok = false;
  try {
    ok = await argon2Verify(tenant.adminPassphraseHash, passphrase);
  } catch {
    ok = false;
  }

  await prisma.auditLog
    .create({
      data: {
        tenantId: tenant.id,
        actorUserId: null,
        action: ok ? 'lan.admin.login.success' : 'lan.admin.login.fail',
        targetType: 'Tenant',
        targetId: tenant.id,
      },
    })
    .catch(() => {});

  if (!ok) return { ok: false };

  const token = signSessionToken(tenant.id, Date.now());
  const store = await cookies();
  store.set(LAN_ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
  return { ok: true, tenantId: tenant.id, role: 'admin' };
}

/** Clear the LAN admin cookie + emit `lan.admin.logout` (best-effort). */
export async function clearLanAdminSession(): Promise<void> {
  const session = await getLanAdminSession();
  const store = await cookies();
  store.delete(LAN_ADMIN_COOKIE);
  if (session.valid) {
    await prisma.auditLog
      .create({
        data: {
          tenantId: session.tenantId,
          actorUserId: null,
          action: 'lan.admin.logout',
          targetType: 'Tenant',
          targetId: session.tenantId,
        },
      })
      .catch(() => {});
  }
}

/**
 * Read + verify the current LAN admin session. Validates HMAC signature + TTL
 * (30-day rolling). Returns `{ valid: true, tenantId, role: 'admin' }` when the
 * cookie is intact and unexpired; `{ valid: false }` otherwise.
 */
export async function getLanAdminSession(): Promise<
  { valid: true; tenantId: string; role: 'admin' } | { valid: false }
> {
  const store = await cookies();
  const token = store.get(LAN_ADMIN_COOKIE)?.value;
  if (!token) return { valid: false };
  const parsed = parseSessionToken(token);
  if (!parsed) return { valid: false };
  if (Date.now() - parsed.issuedAtMs > SESSION_TTL_MS) return { valid: false };
  return { valid: true, tenantId: parsed.tenantId, role: 'admin' };
}
