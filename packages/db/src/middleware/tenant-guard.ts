import { Prisma } from "@prisma/client";

/**
 * L6 — Prisma extension that auto-injects tenantId into EVERY query.
 *
 * Uses $allOperations (NOT a method list) so any future Prisma method is covered
 * automatically. DO NOT replace $allOperations with a list of individual methods —
 * any unlisted method becomes an unguarded tenant bypass (security.md L6 mandate).
 *
 * SPREAD ORDER INVARIANT:
 *   tenantId is injected LAST on both `where` and `data` to guarantee the bound
 *   value wins over any caller-supplied value.
 *   e.g.  a.where = { ...a.where, tenantId }  ← injected last → injection wins
 *         a.data  = { ...row,     tenantId }  ← injected last → injection wins
 *
 * MISMATCH DEFENSE-IN-DEPTH:
 *   Any caller-supplied tenantId that mismatches the bound tenantId triggers a
 *   throw — silent override would mask L6 violation attempts and hide caller bugs.
 *   "undefined" is treated as "not specified" on the where branch (allowed; the
 *   injection will fill it in). Explicit wrong values always throw.
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

          // Inject tenantId on the where clause for reads + targeted writes.
          // tenantId comes LAST so the bound value always wins over any caller value.
          // Defense-in-depth: caller explicitly supplying a DIFFERENT tenantId throws
          // rather than being silently overridden — surfaces L6 violation attempts.
          if (args !== null && typeof args === "object" && "where" in args) {
            const a = args as { where?: Record<string, unknown> };
            if (
              a.where !== undefined &&
              a.where !== null &&
              typeof a.where === "object" &&
              "tenantId" in a.where &&
              a.where.tenantId !== undefined &&
              a.where.tenantId !== tenantId
            ) {
              throw new Error(
                `tenant-guard: refused query — caller where.tenantId="${String(a.where.tenantId)}" mismatches bound tenantId="${tenantId}" (L6 violation attempt)`
              );
            }
            a.where = { ...a.where, tenantId };
          }

          // Inject tenantId into create/createMany data payload.
          // tenantId comes LAST so the bound value always wins over any caller value.
          // Throws on any row that explicitly carries a mismatched tenantId.
          if (operation === "create" || operation === "createMany") {
            const a = args as { data?: unknown };
            if (Array.isArray(a.data)) {
              a.data = (a.data as Record<string, unknown>[]).map((row) => {
                if ("tenantId" in row && row.tenantId !== tenantId) {
                  throw new Error(
                    `tenant-guard: refused create — caller data.tenantId="${String(row.tenantId)}" mismatches bound tenantId="${tenantId}" (L6 violation attempt)`
                  );
                }
                return { ...row, tenantId };
              });
            } else if (a.data !== null && typeof a.data === "object") {
              const row = a.data as Record<string, unknown>;
              if ("tenantId" in row && row.tenantId !== tenantId) {
                throw new Error(
                  `tenant-guard: refused create — caller data.tenantId="${String(row.tenantId)}" mismatches bound tenantId="${tenantId}" (L6 violation attempt)`
                );
              }
              a.data = { ...row, tenantId };
            }
          }

          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
          return query(args);
        },
      },
    },
  });
}
