import { AuditTargetType } from "@prisma/client";
import { prisma, writeAuditLog } from "@yelli/db";
import { middleware } from "../trpc";

/**
 * L5 audit logger — always active per security.md L5.
 *
 * Wraps a mutation procedure: runs the procedure, and on success writes an
 * AuditLog row via writeAuditLog (packages/db). Does NOT log read procedures
 * (queries) — only mutations.
 *
 * Action naming convention (LOCKED in DECISIONS_LOG.md "Audit Trail"):
 *   "<entity>.<verb>" — e.g. "device.archive", "user.role.promote".
 *   Platform router uses PLATFORM:-prefix per security.md Superadmin rule #2.
 *
 * `targetType` — required. Pass the AuditTargetType matching the entity this
 * action operates on (User, Tenant, Device, Invitation, ExportJob).
 *
 * Usage:
 *   const archiveDevice = protectedProcedure
 *     .use(requireTenant())
 *     .use(withAudit("device.archive", AuditTargetType.Device))
 *     .input(...)
 *     .mutation(async ({ ctx, input }) => { ... })
 *
 * The middleware reads ctx.session.user for actor identity and ctx.session.user.tenantId
 * for the audit row. Platform-level actions (PLATFORM:-prefixed) set tenantId null
 * in their own explicit writeAuditLog calls — they do not compose this middleware.
 */
export function withAudit(action: string, targetType: AuditTargetType) {
  return middleware(async ({ ctx, next, path }) => {
    const result = await next();
    if (result.ok && ctx.session?.user) {
      try {
        await writeAuditLog(prisma, {
          tenantId: ctx.session.user.tenantId ?? null,
          actorUserId: ctx.session.user.id,
          action,
          targetType,
          targetId: null,
          payload: { trpcPath: path },
        });
      } catch (err) {
        // Audit failure must not break the mutation it's auditing.
        // Phase 7 wires this to GlitchTip (operations.observability).
        console.error("[audit-log] write failed", { action, err });
      }
    }
    return result;
  });
}
