import { Prisma } from "@prisma/client";

/**
 * L6 — Prisma extension that auto-injects tenantId into EVERY query.
 *
 * Uses $allOperations (NOT a method list) so any future Prisma method is covered
 * automatically. DO NOT replace $allOperations with a list of individual methods —
 * any unlisted method becomes an unguarded tenant bypass (security.md L6 mandate).
 *
 * Excluded models (not tenant-scoped — caller passes tenantId explicitly or uses
 * a dedicated unguarded Prisma client):
 *   - Tenant            (it IS the tenant)
 *   - AuditLog          (tenantId nullable; superadmin actions are platform-level)
 *   - Account/Session/VerificationToken (Auth.js — scoped via User relation)
 *
 * Usage:
 *   const tenantPrisma = prisma.$extends(tenantGuardExtension(ctx.tenantId));
 *   const users = await tenantPrisma.user.findMany();  // auto-scoped to tenantId
 *
 * Super-Admin: use a SEPARATE PrismaClient WITHOUT this extension, never inline
 * if/else inside resolvers (security.md superadmin rule).
 */
const EXCLUDED_MODELS = new Set([
  "Tenant",
  "AuditLog",
  "Account",
  "Session",
  "VerificationToken",
]);

export function tenantGuardExtension(tenantId: string) {
  return Prisma.defineExtension({
    name: "yelli-tenant-guard",
    query: {
      $allModels: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async $allOperations({ model, operation, args, query }: any) {
          if (EXCLUDED_MODELS.has(model as string)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
            return query(args);
          }

          // Inject tenantId on the where clause for reads + targeted writes
          if (args !== null && typeof args === "object" && "where" in args) {
            const a = args as { where?: Record<string, unknown> };
            a.where = { ...a.where, tenantId };
          }

          // Inject tenantId into create/createMany data payload
          if (operation === "create" || operation === "createMany") {
            const a = args as { data?: unknown };
            if (Array.isArray(a.data)) {
              a.data = (a.data as Record<string, unknown>[]).map((row) => ({
                tenantId,
                ...row,
              }));
            } else if (a.data !== null && typeof a.data === "object") {
              a.data = {
                tenantId,
                ...(a.data as Record<string, unknown>),
              };
            }
          }

          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
          return query(args);
        },
      },
    },
  });
}
