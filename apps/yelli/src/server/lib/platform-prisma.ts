import { PrismaClient } from "@prisma/client";

/**
 * Dedicated PrismaClient WITHOUT the L6 tenant-guard extension.
 * USED ONLY by src/server/trpc/routers/platform.ts (super-admin / _pwbt router).
 *
 * Why a separate client (locked in DECISIONS_LOG.md "Super-Admin and Platform-Level Roles"):
 *   Inline if/else "if (isSuperadmin) skip tenant filter" inside tenant-scoped resolvers
 *   spreads across every router over time and becomes impossible to audit. Instead,
 *   the super-admin router uses this isolated client. The regular @yelli/db `prisma`
 *   export remains the tenant-guarded path for all other routers.
 *
 * Singleton pattern matches @yelli/db — globalThis cache in dev avoids
 * "too many connections" on Next.js HMR.
 */

declare global {
  // eslint-disable-next-line no-var
  var __yelliPlatformPrisma: PrismaClient | undefined;
}

export const platformPrisma: PrismaClient =
  globalThis.__yelliPlatformPrisma ?? new PrismaClient();

if (process.env["NODE_ENV"] !== "production") {
  globalThis.__yelliPlatformPrisma = platformPrisma;
}
