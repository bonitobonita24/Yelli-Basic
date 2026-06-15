import { TRPCError } from '@trpc/server';

import { middleware } from '../trpc';

/**
 * Structured server-side error logger (security.md: never leak internals to client).
 *
 * Logs failures server-side with structured JSON fields (mirrors the `log()`
 * convention from @yelli/jobs/_validate.ts):
 *   { level, msg, code, path, requestId?, userId?, tenantId?, stack? }
 *
 * Security rules enforced:
 *   1. Stack traces and raw cause messages are logged server-side only; they
 *      NEVER propagate to the client response. The tRPC errorFormatter (trpc.ts)
 *      stays default (no client-facing detail added here — add an explicit
 *      errorFormatter at the router root if custom client messages are needed).
 *   2. Internal error codes (INTERNAL_SERVER_ERROR) are re-emitted as generic
 *      "An unexpected error occurred" messages toward the client via tRPC's
 *      built-in shape (we do not override the message here; the default tRPC
 *      error shape already strips the cause for INTERNAL_SERVER_ERROR in prod).
 *   3. requestId, userId, tenantId are extracted from ctx only when present —
 *      never fabricated. This middleware must run AFTER auth/tenant-scope if
 *      those fields are desired on the log line (chain step 6).
 */
export const errorMiddleware = middleware(async ({ ctx, path, next }) => {
  const result = await next();

  if (!result.ok) {
    const error = result.error;
    const isDev = process.env['NODE_ENV'] !== 'production';

    // Extract available identity fields from ctx (populated by earlier chain steps).
    const userId = (ctx as { user?: { id?: string } }).user?.id ?? undefined;
    const tenantId =
      (ctx as { tenantId?: string }).tenantId ??
      (ctx as { session?: { user?: { tenantId?: string } } }).session?.user?.tenantId ??
      undefined;

    // Structured log line — stack in dev only, never in prod (security.md §SEC #9).
    const logLine: Record<string, unknown> = {
      level: 'error',
      msg: '[trpc] procedure error',
      path,
      code: error.code,
      // Human-readable cause for server-side ops visibility.
      cause: error.message,
      ...(userId !== undefined && { userId }),
      ...(tenantId !== undefined && { tenantId }),
      ...(isDev && error.cause instanceof Error
        ? { stack: error.cause.stack }
        : isDev && error instanceof TRPCError && error.cause
          ? { stack: String(error.cause) }
          : {}),
    };

    console.error(JSON.stringify(logLine));
  }

  return result;
});
