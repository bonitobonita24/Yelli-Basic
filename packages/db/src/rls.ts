import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * L2 — PostgreSQL Row-Level Security context setter.
 * Sets the session variable that RLS policies read.
 * Must be called inside a transaction; the `true` 3rd arg scopes the setting
 * to the current transaction only.
 */
export async function setTenantContext(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<void> {
  await tx.$executeRawUnsafe(
    `SELECT set_config('app.current_tenant_id', $1, true)`,
    tenantId
  );
}

/**
 * Execute a function inside a tenant-scoped transaction.
 * Every multi-tenant operation that crosses table boundaries should use this.
 */
export async function withTenant<T>(
  prisma: PrismaClient,
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await setTenantContext(tx, tenantId);
    return fn(tx);
  });
}
