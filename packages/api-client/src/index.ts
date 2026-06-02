/**
 * Yelli typed tRPC client factory.
 *
 * apps/yelli (Part 5) defines AppRouter. To consume:
 *   import type { AppRouter } from "@yelli/yelli/server/trpc/_app";
 *   import { createYelliTrpcClient } from "@yelli/api-client";
 *   export const trpc = createYelliTrpcClient<AppRouter>({ url: "/api/trpc" });
 *
 * Generic factory avoids the circular dep that would result if api-client
 * imported the concrete AppRouter at type-only level from apps/yelli.
 */
import {
  createTRPCClient,
  httpBatchLink,
  type CreateTRPCClient,
  type HTTPHeaders,
} from "@trpc/client";
import type { AnyRouter } from "@trpc/server";
import superjson from "superjson";

export interface CreateYelliTrpcClientOptions {
  /** Absolute or relative URL to the tRPC HTTP endpoint (e.g. "/api/trpc"). */
  url: string;
  /**
   * Optional headers callback — e.g. attach Auth.js session cookie on server-side fetches.
   * Called per-request. May be async.
   */
  headers?: () => HTTPHeaders | Promise<HTTPHeaders>;
}

export function createYelliTrpcClient<TRouter extends AnyRouter>(
  opts: CreateYelliTrpcClientOptions,
): CreateTRPCClient<TRouter> {
  return createTRPCClient<TRouter>({
    links: [
      // @ts-expect-error tRPC v11: TransformerOptions<TRouter["_def"]["_config"]["$types"]>
      // cannot be satisfied by an unbound generic (AnyRouter). This resolves at the call
      // site in apps/yelli (Part 5) where TRouter = concrete AppRouter. No runtime impact.
      httpBatchLink<TRouter>({
        transformer: superjson,
        url: opts.url,
        ...(opts.headers !== undefined ? { headers: opts.headers } : {}),
      }),
    ],
  });
}

// Re-export shared types/schemas for downstream consumers that only import @yelli/api-client.
export * from "@yelli/shared";
