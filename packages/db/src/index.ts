import { PrismaClient } from '@prisma/client';

// `var` is required for a `declare global` augmentation of globalThis.
declare global {
  var __yelliPrisma: PrismaClient | undefined;
}

/**
 * Base (unguarded) PrismaClient — singleton in dev to survive HMR.
 * Tenant-scoped callers apply the L6 guard per request:
 *   prisma.$extends(tenantGuardExtension(ctx.tenantId))
 * Super-Admin uses this base client directly (no L6) per the LOCKED tRPC
 * Middleware Chain decision — never inline if/else inside resolvers.
 */
export const prisma: PrismaClient = globalThis.__yelliPrisma ?? new PrismaClient();

if (process.env['NODE_ENV'] !== 'production') {
  globalThis.__yelliPrisma = prisma;
}

export type { PrismaClient } from '@prisma/client';
export * from '@prisma/client';

export * from './audit';
export * from './rls';
export * from './middleware/tenant-guard';
