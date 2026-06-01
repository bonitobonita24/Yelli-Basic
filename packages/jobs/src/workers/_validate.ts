/**
 * Shared payload guard for every worker.
 * security.md Queue Safety rule 1+2: reject jobs missing tenantId or userId.
 */
export interface BaseTenantUserPayload {
  tenantId: string;
  userId: string;
}

export function assertTenantUser(payload: unknown): asserts payload is BaseTenantUserPayload {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Job payload must be an object");
  }
  const p = payload as Record<string, unknown>;
  if (typeof p.tenantId !== "string" || p.tenantId.length === 0) {
    throw new Error("Job payload missing required tenantId");
  }
  if (typeof p.userId !== "string" || p.userId.length === 0) {
    throw new Error("Job payload missing required userId");
  }
}

export function log(
  level: "info" | "warn" | "error",
  msg: string,
  ctx: Record<string, unknown> = {}
): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level,
      msg,
      ...ctx,
    })
  );
}
