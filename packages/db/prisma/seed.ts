/**
 * Prisma seed — Yelli platform bootstrap.
 *
 * Two layers:
 *
 *  1. ALWAYS (every environment): ensures the implicit platform tenant exists
 *     (`slug` from PLATFORM_TENANT_SLUG, default "_pwbt") and a webmaster admin
 *     account exists. The webmaster password is taken from WEBMASTER_PASSWORD;
 *     if that env var is absent the webmaster account is left untouched on an
 *     existing DB and SKIPPED on a fresh one (we never invent a weak default for
 *     a real admin account). All password hashing is bcryptjs @ 12 rounds to
 *     match apps/yelli/src/server/auth/config.ts (LOCKED hash algorithm).
 *
 *  2. DEV-ONLY (gated): standardized weak local-review credentials —
 *       admin@mail.com / admin   (role: admin)
 *       user@mail.com  / user    (role: member, lowest-privilege normal role)
 *       LAN admin passphrase (Tenant.adminPassphraseHash, Argon2id) = "admin"
 *     This block runs ONLY when the environment is unambiguously a local dev/test
 *     environment (see `devCredsAllowed()` below). It is HARD-REFUSED on
 *     production and staging so a stray `pnpm db:seed` can never weaken a
 *     deployed instance. See CREDENTIALS.md ("DEV ONLY") + DECISIONS_LOG.
 *
 * Idempotent: re-running upserts by (tenantId, email) and re-hashes — safe to
 * repeat. Never wipes existing rows.
 */
import { hash as argon2Hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12; // LOCKED — matches auth/config.ts
const PLATFORM_TENANT_SLUG = process.env.PLATFORM_TENANT_SLUG ?? '_pwbt';
const PLATFORM_TENANT_NAME = process.env.PLATFORM_TENANT_NAME ?? 'Yelli Platform';

/**
 * Dev credential gate. Weak, well-known credentials (admin/admin, user/user,
 * passphrase "admin") are applied ONLY in a local dev/test context. Returns
 * false — refusing the weak block — for production, staging, or any unset/unknown
 * NODE_ENV that is not explicitly 'development' or 'test'. A belt-and-suspenders
 * SEED_DEV_CREDS=0 escape hatch can force-disable even in development.
 */
function devCredsAllowed(): boolean {
  const env = (process.env.NODE_ENV ?? '').toLowerCase();
  if (env === 'production' || env === 'staging') return false;
  if (process.env.SEED_DEV_CREDS === '0') return false;
  return env === 'development' || env === 'test';
}

async function ensurePlatformTenant(): Promise<string> {
  const tenant = await prisma.tenant.upsert({
    where: { slug: PLATFORM_TENANT_SLUG },
    update: {},
    create: { slug: PLATFORM_TENANT_SLUG, displayName: PLATFORM_TENANT_NAME },
    select: { id: true, slug: true },
  });
  console.log(`✓ platform tenant ready: slug=${tenant.slug}`);
  return tenant.id;
}

async function ensureWebmaster(tenantId: string): Promise<void> {
  const email = process.env.WEBMASTER_EMAIL ?? 'bonitobonita24@gmail.com';
  const password = process.env.WEBMASTER_PASSWORD;
  if (!password) {
    console.log(
      '• WEBMASTER_PASSWORD not set — leaving webmaster account untouched (no weak default invented).',
    );
    return;
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId, email } },
    update: { passwordHash, role: 'admin', isSuspended: false, securityVersion: { increment: 1 } },
    create: { tenantId, email, passwordHash, displayName: 'webmaster', role: 'admin' },
  });
  console.log(`✓ webmaster ensured: ${email} (role=admin)`);
}

async function seedDevCredentials(tenantId: string): Promise<void> {
  if (!devCredsAllowed()) {
    console.log(
      `• Skipping DEV credentials block (NODE_ENV=${process.env.NODE_ENV ?? 'unset'} — weak creds refused outside development/test).`,
    );
    return;
  }
  console.log('• DEV environment — applying standardized local-review credentials…');

  // admin@mail.com / admin  (role: admin)
  const adminHash = await bcrypt.hash('admin', BCRYPT_ROUNDS);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId, email: 'admin@mail.com' } },
    update: {
      passwordHash: adminHash,
      role: 'admin',
      isSuspended: false,
      securityVersion: { increment: 1 },
    },
    create: {
      tenantId,
      email: 'admin@mail.com',
      passwordHash: adminHash,
      displayName: 'Admin',
      role: 'admin',
    },
  });
  console.log('  ✓ admin@mail.com / admin (role=admin)');

  // user@mail.com / user  (role: member — lowest-privilege normal role)
  const userHash = await bcrypt.hash('user', BCRYPT_ROUNDS);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId, email: 'user@mail.com' } },
    update: {
      passwordHash: userHash,
      role: 'member',
      isSuspended: false,
      securityVersion: { increment: 1 },
    },
    create: {
      tenantId,
      email: 'user@mail.com',
      passwordHash: userHash,
      displayName: 'User',
      role: 'member',
    },
  });
  console.log('  ✓ user@mail.com / user (role=member)');

  // LAN admin passphrase (Argon2id) = "admin" — gates /admin/* in LAN edition.
  const passphraseHash = await argon2Hash('admin');
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { adminPassphraseHash: passphraseHash },
  });
  console.log('  ✓ LAN admin passphrase = admin (Argon2id)');
}

async function main(): Promise<void> {
  console.log(`Seeding (NODE_ENV=${process.env.NODE_ENV ?? 'unset'})…`);
  const tenantId = await ensurePlatformTenant();
  await ensureWebmaster(tenantId);
  await seedDevCredentials(tenantId);
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
