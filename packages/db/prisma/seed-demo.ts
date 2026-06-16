/**
 * Demo hydration seed — Yelli local DEV review dataset.
 *
 * Purpose: populate the dev DB (tenant `_pwbt`) with a realistic, demo-presentable
 * dataset so the owner can review a fully-alive app locally instead of an empty
 * shell. This is a DEV-ONLY tool — it is HARD-REFUSED on production/staging.
 *
 * Idempotent: every entity upserts on a natural key (or a deterministic synthetic
 * cuid derived from a stable demo tag), so re-running this script never duplicates
 * rows and never wipes existing data. Safe to repeat.
 *
 * Scope: only the platform tenant (`PLATFORM_TENANT_SLUG`, default `_pwbt`).
 * It layers ON TOP of the baseline `prisma/seed.ts` (tenant + admin/user accounts) —
 * run the baseline seed first if the DB is fresh.
 *
 * Field-name notes (verified against schema.prisma):
 *  - Tenant fields are camelCase columns (no per-field @map); User/Device/etc. map
 *    to snake_case. We go through Prisma so mapping is automatic.
 *  - Invitation.invitedByUserId is nullable (post-0002): LAN-admin actor → null.
 *  - AuditLog.action MUST be a value from @yelli/shared AUDIT_ACTIONS (verbatim).
 *  - AuditLog.actorUserId is nullable: LAN-admin / system events → null.
 *  - CallSession requires caller/callee device + role-at-call; endedAt/durationSec
 *    /endReason are nullable (null = still ringing/connected).
 */
import { createHash } from 'node:crypto';
import { PrismaClient, type Role, type CallRole, type EndReason } from '@prisma/client';

const prisma = new PrismaClient();

const PLATFORM_TENANT_SLUG = process.env.PLATFORM_TENANT_SLUG ?? '_pwbt';
const DEMO_TAG = 'demo'; // marks all rows authored by this script

/** DEV gate — identical policy to prisma/seed.ts. Never weakens prod/staging. */
function devSeedAllowed(): boolean {
  const env = (process.env.NODE_ENV ?? '').toLowerCase();
  if (env === 'production' || env === 'staging') return false;
  if (process.env.SEED_DEV_CREDS === '0') return false;
  // Default-allow for unset NODE_ENV: this is a manually-invoked dev tool and the
  // dev container runs with NODE_ENV unset in some shells. Refuse only on the two
  // explicitly-deployed envs above.
  return true;
}

/** Deterministic cuid-shaped id from a stable key — gives us idempotent upserts
 *  for models whose natural key isn't a DB unique constraint (Device, CallSession,
 *  AuditLog). Re-running with the same key targets the same row. */
function stableId(prefix: string, key: string): string {
  const h = createHash('sha256').update(`${prefix}:${key}`).digest('hex').slice(0, 24);
  return `c${prefix.slice(0, 3)}${h}`; // cuid-ish; only needs to be a stable unique string
}

const daysAgo = (d: number, h = 0, m = 0): Date => {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() - d);
  t.setUTCHours(h, m, 0, 0);
  return t;
};

async function main(): Promise<void> {
  if (!devSeedAllowed()) {
    console.error(
      `REFUSED: demo hydration is dev-only (NODE_ENV=${process.env.NODE_ENV ?? 'unset'}).`,
    );
    process.exitCode = 1;
    return;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: PLATFORM_TENANT_SLUG },
    select: { id: true },
  });
  if (!tenant) {
    console.error(
      `REFUSED: platform tenant "${PLATFORM_TENANT_SLUG}" not found. Run the baseline seed first (pnpm db:seed).`,
    );
    process.exitCode = 1;
    return;
  }
  const tenantId = tenant.id;
  console.log(`Hydrating demo data for tenant ${PLATFORM_TENANT_SLUG} (${tenantId})…`);

  // ── Branding (so the app chrome shows a real name/logo) ──────────────────────
  // logoUrl uses a data: URI (a minimal teal SVG placeholder) so it satisfies the
  // app's CSP `img-src 'self' data: blob:` without any external network request.
  // The previous https://placehold.co/… URL was blocked by CSP in dev review.
  const DEMO_LOGO_DATA_URI =
    'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22128%22%20height%3D%22128%22%20viewBox%3D%220%200%20128%20128%22%3E%3Crect%20width%3D%22128%22%20height%3D%22128%22%20rx%3D%2216%22%20fill%3D%22%230d9488%22%2F%3E%3Ctext%20x%3D%2264%22%20y%3D%2278%22%20font-family%3D%22system-ui%2Csans-serif%22%20font-size%3D%2248%22%20font-weight%3D%22700%22%20fill%3D%22%23fff%22%20text-anchor%3D%22middle%22%3EPB%3C%2Ftext%3E%3C%2Fsvg%3E';
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { displayName: 'Powerbyte Demo Org', logoUrl: DEMO_LOGO_DATA_URI },
  });

  // ── Members (Users) — varied roles. Upsert on (tenantId, email). ─────────────
  const members: Array<{ email: string; displayName: string; role: Role; suspended?: boolean }> = [
    { email: 'maria.santos@demo.yelli.app', displayName: 'Maria Santos', role: 'admin' },
    { email: 'james.cruz@demo.yelli.app', displayName: 'James Cruz', role: 'member' },
    { email: 'aisha.khan@demo.yelli.app', displayName: 'Aisha Khan', role: 'member' },
    { email: 'leo.tanaka@demo.yelli.app', displayName: 'Leo Tanaka', role: 'member' },
    { email: 'nina.reyes@demo.yelli.app', displayName: 'Nina Reyes', role: 'member' },
    { email: 'omar.haddad@demo.yelli.app', displayName: 'Omar Haddad', role: 'member', suspended: true },
  ];
  const memberIds: Record<string, string> = {};
  for (const m of members) {
    const u = await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email: m.email } },
      update: { displayName: m.displayName, role: m.role, isSuspended: m.suspended ?? false },
      create: {
        tenantId,
        email: m.email,
        // demo accounts are not login targets; a fixed non-secret bcrypt-shaped string is fine
        passwordHash: '$2a$12$demoDEMOdemoDEMOdemoDEoXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx',
        displayName: m.displayName,
        role: m.role,
        isSuspended: m.suspended ?? false,
        lastLoginAt: daysAgo(Math.floor(Math.random() * 5)),
      },
    });
    memberIds[m.email] = u.id;
  }
  console.log(`✓ ${members.length} demo members`);

  // ── Devices — readable display names, varied call roles, owned by members. ───
  type DevSpec = { key: string; name: string; owner: string | null; role: CallRole; daysOld: number; archived?: boolean };
  const devs: DevSpec[] = [
    { key: 'maria-laptop', name: "Maria's Laptop", owner: 'maria.santos@demo.yelli.app', role: 'both', daysOld: 40 },
    { key: 'maria-phone', name: "Maria's Phone", owner: 'maria.santos@demo.yelli.app', role: 'both', daysOld: 38 },
    { key: 'james-desktop', name: "James's Desktop", owner: 'james.cruz@demo.yelli.app', role: 'caller', daysOld: 30 },
    { key: 'aisha-tablet', name: "Aisha's Tablet", owner: 'aisha.khan@demo.yelli.app', role: 'both', daysOld: 25 },
    { key: 'leo-phone', name: "Leo's Phone", owner: 'leo.tanaka@demo.yelli.app', role: 'receiver', daysOld: 20 },
    { key: 'nina-laptop', name: "Nina's Laptop", owner: 'nina.reyes@demo.yelli.app', role: 'both', daysOld: 15 },
    { key: 'reception-kiosk', name: 'Reception Kiosk', owner: null, role: 'receiver', daysOld: 50 },
    { key: 'lobby-display', name: 'Lobby Display', owner: null, role: 'receiver', daysOld: 12 },
    { key: 'old-loaner', name: 'Old Loaner (Archived)', owner: null, role: 'both', daysOld: 90, archived: true },
  ];
  const deviceIds: Record<string, string> = {};
  for (const d of devs) {
    const id = stableId('dev', d.key);
    const data = {
      tenantId,
      userId: d.owner ? memberIds[d.owner] : null,
      displayName: d.name,
      callRole: d.role,
      browserFingerprint: `fp_demo_${d.key}`,
      assignedRoleAt: d.role !== 'both' ? daysAgo(d.daysOld - 1) : null,
      lastSeenAt: daysAgo(Math.floor(Math.random() * 3)),
      archivedAt: d.archived ? daysAgo(5) : null,
      createdAt: daysAgo(d.daysOld),
    };
    await prisma.device.upsert({ where: { id }, update: data, create: { id, ...data } });
    deviceIds[d.key] = id;
  }
  console.log(`✓ ${devs.length} demo devices`);

  // ── Call sessions — spanning recent dates, varied outcomes. ──────────────────
  type CallSpec = {
    key: string; caller: string; callee: string;
    daysOld: number; hour: number;
    connected: boolean; durationSec: number | null; endReason: EndReason | null;
    callerRole: CallRole; calleeRole: CallRole;
  };
  const calls: CallSpec[] = [
    { key: 'c1', caller: 'maria-laptop', callee: 'leo-phone', daysOld: 1, hour: 9, connected: true, durationSec: 312, endReason: 'completed', callerRole: 'both', calleeRole: 'receiver' },
    { key: 'c2', caller: 'james-desktop', callee: 'reception-kiosk', daysOld: 1, hour: 11, connected: true, durationSec: 84, endReason: 'completed', callerRole: 'caller', calleeRole: 'receiver' },
    { key: 'c3', caller: 'aisha-tablet', callee: 'nina-laptop', daysOld: 2, hour: 14, connected: false, durationSec: null, endReason: 'no_answer', callerRole: 'both', calleeRole: 'both' },
    { key: 'c4', caller: 'maria-phone', callee: 'lobby-display', daysOld: 2, hour: 16, connected: true, durationSec: 540, endReason: 'completed', callerRole: 'both', calleeRole: 'receiver' },
    { key: 'c5', caller: 'nina-laptop', callee: 'leo-phone', daysOld: 3, hour: 10, connected: false, durationSec: null, endReason: 'declined', callerRole: 'both', calleeRole: 'receiver' },
    { key: 'c6', caller: 'james-desktop', callee: 'aisha-tablet', daysOld: 4, hour: 13, connected: true, durationSec: 1230, endReason: 'completed', callerRole: 'caller', calleeRole: 'both' },
    { key: 'c7', caller: 'maria-laptop', callee: 'reception-kiosk', daysOld: 5, hour: 15, connected: true, durationSec: 47, endReason: 'peer_disconnect', callerRole: 'both', calleeRole: 'receiver' },
    { key: 'c8', caller: 'aisha-tablet', callee: 'lobby-display', daysOld: 6, hour: 9, connected: false, durationSec: null, endReason: 'busy', callerRole: 'both', calleeRole: 'receiver' },
    { key: 'c9', caller: 'nina-laptop', callee: 'maria-phone', daysOld: 8, hour: 17, connected: true, durationSec: 205, endReason: 'completed', callerRole: 'both', calleeRole: 'both' },
    { key: 'c10', caller: 'leo-phone', callee: 'james-desktop', daysOld: 11, hour: 12, connected: false, durationSec: null, endReason: 'cancelled', callerRole: 'receiver', calleeRole: 'caller' },
    { key: 'c11', caller: 'maria-laptop', callee: 'aisha-tablet', daysOld: 14, hour: 10, connected: true, durationSec: 678, endReason: 'completed', callerRole: 'both', calleeRole: 'both' },
    { key: 'c12', caller: 'james-desktop', callee: 'lobby-display', daysOld: 20, hour: 14, connected: true, durationSec: 159, endReason: 'completed', callerRole: 'caller', calleeRole: 'receiver' },
  ];
  for (const c of calls) {
    const id = stableId('cal', c.key);
    const startedAt = daysAgo(c.daysOld, c.hour, 5);
    const connectedAt = c.connected ? new Date(startedAt.getTime() + 4000) : null;
    const endedAt = c.durationSec != null && connectedAt
      ? new Date(connectedAt.getTime() + c.durationSec * 1000)
      : c.connected ? null : new Date(startedAt.getTime() + 30000);
    const data = {
      tenantId,
      callerDeviceId: deviceIds[c.caller],
      calleeDeviceId: deviceIds[c.callee],
      callerRoleAtCall: c.callerRole,
      calleeRoleAtCall: c.calleeRole,
      startedAt,
      connectedAt,
      endedAt,
      durationSec: c.durationSec,
      endReason: c.endReason,
    };
    await prisma.callSession.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  console.log(`✓ ${calls.length} demo call sessions`);

  // ── Invitations — pending + accepted + revoked-ish (expired). ────────────────
  // tokenHash is @unique → natural idempotency key.
  type InvSpec = { email: string; invitedBy: string | null; daysOld: number; status: 'pending' | 'accepted' | 'expired' };
  const invites: InvSpec[] = [
    { email: 'pending.one@demo.yelli.app', invitedBy: 'maria.santos@demo.yelli.app', daysOld: 1, status: 'pending' },
    { email: 'pending.two@demo.yelli.app', invitedBy: 'maria.santos@demo.yelli.app', daysOld: 2, status: 'pending' },
    { email: 'james.cruz@demo.yelli.app', invitedBy: 'maria.santos@demo.yelli.app', daysOld: 30, status: 'accepted' },
    { email: 'aisha.khan@demo.yelli.app', invitedBy: null, daysOld: 25, status: 'accepted' }, // LAN-admin invite → null actor
    { email: 'expired.invite@demo.yelli.app', invitedBy: 'maria.santos@demo.yelli.app', daysOld: 20, status: 'expired' },
  ];
  for (const inv of invites) {
    const tokenHash = `demohash_${createHash('sha256').update(`inv:${inv.email}`).digest('hex').slice(0, 32)}`;
    const createdAt = daysAgo(inv.daysOld);
    const data = {
      tenantId,
      invitedByUserId: inv.invitedBy ? memberIds[inv.invitedBy] : null,
      email: inv.email,
      tokenHash,
      createdAt,
      expiresAt: inv.status === 'expired' ? daysAgo(inv.daysOld - 3) : daysAgo(inv.daysOld - 14),
      acceptedAt: inv.status === 'accepted' ? daysAgo(inv.daysOld - 1) : null,
    };
    await prisma.invitation.upsert({ where: { tokenHash }, update: data, create: data });
  }
  console.log(`✓ ${invites.length} demo invitations`);

  // ── Audit log — recent activity using §11-canonical action strings. ──────────
  // Idempotent: delete prior demo-tagged audit rows (payload.demo===DEMO_TAG) then
  // re-insert. Audit rows have no natural unique key, so tag-and-replace keeps the
  // set stable across re-runs without touching real audit entries.
  await prisma.auditLog.deleteMany({
    where: { tenantId, payload: { path: ['demo'], equals: DEMO_TAG } },
  });
  const maria = memberIds['maria.santos@demo.yelli.app'];
  const james = memberIds['james.cruz@demo.yelli.app'];
  type Audit = { action: string; actor: string | null; targetType: 'User' | 'Tenant' | 'Invitation' | 'Device' | 'ExportJob'; targetId: string | null; daysOld: number; extra?: Record<string, unknown> };
  const audits: Audit[] = [
    { action: 'tenant.branding.update', actor: maria, targetType: 'Tenant', targetId: tenantId, daysOld: 6 },
    { action: 'device.create', actor: null, targetType: 'Device', targetId: deviceIds['lobby-display'], daysOld: 12, extra: { name: 'Lobby Display' } },
    { action: 'device.role.assign', actor: maria, targetType: 'Device', targetId: deviceIds['leo-phone'], daysOld: 19, extra: { role: 'receiver' } },
    { action: 'device.rename', actor: maria, targetType: 'Device', targetId: deviceIds['old-loaner'], daysOld: 7, extra: { from: 'Loaner', to: 'Old Loaner (Archived)' } },
    { action: 'device.archive', actor: maria, targetType: 'Device', targetId: deviceIds['old-loaner'], daysOld: 5 },
    { action: 'invitation.create', actor: maria, targetType: 'Invitation', targetId: null, daysOld: 2, extra: { email: 'pending.two@demo.yelli.app' } },
    { action: 'invitation.accept', actor: null, targetType: 'Invitation', targetId: null, daysOld: 29, extra: { email: 'james.cruz@demo.yelli.app' } },
    { action: 'user.role.promote', actor: null, targetType: 'User', targetId: maria, daysOld: 35, extra: { to: 'admin' } },
    { action: 'user.suspend', actor: maria, targetType: 'User', targetId: memberIds['omar.haddad@demo.yelli.app'], daysOld: 9 },
    { action: 'call.start', actor: null, targetType: 'User', targetId: james, daysOld: 1 },
    { action: 'call.connected', actor: null, targetType: 'User', targetId: james, daysOld: 1 },
    { action: 'call.end', actor: null, targetType: 'User', targetId: james, daysOld: 1, extra: { durationSec: 84 } },
    { action: 'lan.admin.login.success', actor: null, targetType: 'Tenant', targetId: null, daysOld: 1 },
    { action: 'lan.admin.logout', actor: null, targetType: 'Tenant', targetId: null, daysOld: 1 },
  ];
  for (const a of audits) {
    await prisma.auditLog.create({
      data: {
        tenantId,
        actorUserId: a.actor,
        action: a.action,
        targetType: a.targetType,
        targetId: a.targetId,
        payload: { demo: DEMO_TAG, ...(a.extra ?? {}) },
        createdAt: daysAgo(a.daysOld, 8, 30),
      },
    });
  }
  console.log(`✓ ${audits.length} demo audit-log entries`);

  console.log('Demo hydration complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
