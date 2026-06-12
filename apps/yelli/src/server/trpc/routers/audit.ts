import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { Prisma } from '@yelli/db';

import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

/**
 * Audit router — read-only AuditLog view for the admin Audit screen (Phase 3.3
 * `sim.auditLog.recent` SWAP BOUNDARY, ScreenAdminAudit). Admin-gated, paginated,
 * filterable by §11 action prefix.
 *
 * SECURITY: AuditLog is EXCLUDED from the L6 tenant-guard, so the guard does NOT
 * auto-inject tenantId here — the read MUST scope `tenantId: ctx.tenantId`
 * explicitly (security.md #10: export/report queries carry tenantId in every WHERE
 * clause). tenantId is omitted from returned rows (security.md #13).
 */
const AUDIT_SELECT = {
  id: true,
  action: true,
  targetType: true,
  targetId: true,
  actorUserId: true,
  payload: true,
  createdAt: true,
} satisfies Prisma.AuditLogSelect;

function requireAdmin(role: string): void {
  if (role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin role required.' });
  }
}

export const auditRouter = router({
  /** Most-recent-first audit entries for the caller's tenant. Cursor-paginated by
   *  id; optional `actionPrefix` filters by §11 namespace (e.g. "device." / "user."). */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(200).default(50),
        cursor: z.string().min(1).optional(),
        actionPrefix: z.string().min(1).max(40).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const rows = await ctx.db.auditLog.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(input.actionPrefix ? { action: { startsWith: input.actionPrefix } } : {}),
        },
        select: AUDIT_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | null = null;
      if (rows.length > input.limit) {
        const extra = rows.pop();
        nextCursor = extra?.id ?? null;
      }
      return { items: rows, nextCursor };
    }),
});
