/**
 * Yelli Phase 4 Part 3 — Database seed
 *
 * Creates the first admin ("webmaster") in the reserved "_pwbt" platform tenant.
 * Plaintext password is NEVER stored in this file — it is read from
 * process.env.WEBMASTER_PASSWORD at runtime and bcrypt-hashed before insert.
 *
 * Usage:
 *   WEBMASTER_PASSWORD='<from CREDENTIALS.md>' pnpm --filter @yelli/db db:seed
 *
 * The seed is idempotent via upsert — safe to re-run.
 *
 * Slug choice: "_pwbt" is already in RESERVED_SLUGS (packages/shared/src/config/reserved-slugs.ts).
 * It is the Powerbyte-internal system tenant. The webmaster lives here so the slug
 * can never be claimed by a regular tenant signup.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const PLATFORM_TENANT_SLUG = "_pwbt";
const WEBMASTER_EMAIL = "bonitobonita24@gmail.com";
const WEBMASTER_DISPLAY_NAME = "webmaster";
const BCRYPT_ROUNDS = 12;

async function main(): Promise<void> {
  const plaintext = process.env.WEBMASTER_PASSWORD;
  if (!plaintext || plaintext.length < 12) {
    throw new Error(
      "WEBMASTER_PASSWORD env var is required (min 12 chars). " +
        "Read the value from CREDENTIALS.md → First Admin Account section. " +
        "Usage: WEBMASTER_PASSWORD='<value>' pnpm --filter @yelli/db db:seed",
    );
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(plaintext, BCRYPT_ROUNDS);

    // Upsert the platform tenant (slug is the natural key).
    const platformTenant = await prisma.tenant.upsert({
      where: { slug: PLATFORM_TENANT_SLUG },
      update: {},
      create: {
        slug: PLATFORM_TENANT_SLUG,
        displayName: "Yelli Platform",
        isSuspended: false,
        adminPassphraseHash: null, // Cloud tenant — no LAN passphrase
      },
    });

    // Upsert the webmaster user.
    // Key: @@unique([tenantId, email]) — schema.prisma line 100.
    // Update passwordHash on re-run so a new WEBMASTER_PASSWORD value is honoured.
    await prisma.user.upsert({
      where: {
        tenantId_email: {
          tenantId: platformTenant.id,
          email: WEBMASTER_EMAIL,
        },
      },
      update: {
        passwordHash,
      },
      create: {
        tenantId: platformTenant.id,
        email: WEBMASTER_EMAIL,
        displayName: WEBMASTER_DISPLAY_NAME,
        passwordHash,
        role: "admin",
      },
    });

    console.log(
      `✅ Seeded platform tenant "${PLATFORM_TENANT_SLUG}" + webmaster (${WEBMASTER_EMAIL}).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
