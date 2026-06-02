"use client";

import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { createYelliTrpcClient } from "@yelli/api-client";
import type { AppRouter } from "@/server/trpc/root";
import superjson from "superjson";

/**
 * React Query tRPC hooks — used by client components for queries + mutations.
 * Usage: `const { data } = trpc.user.me.useQuery()`.
 *
 * The QueryClient provider (D11) calls trpc.createClient() using makeTrpcLinks()
 * and pairs it with a TanStack QueryClient.
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Link factory for the QueryClient provider (D11).
 * Separate from makeTrpcClient so the React provider and vanilla client
 * stay independent.
 */
export function makeTrpcLinks(url: string) {
  return [
    // No generic arg on httpBatchLink — the link type is inferred by the tRPC
    // QueryClient provider that consumes this array. Passing AppRouter here hits
    // the same BuiltRouter vs Router<any,any> structural mismatch as in
    // @yelli/api-client (suppressed there with @ts-expect-error on the unbound
    // generic). Omitting the generic avoids the constraint check at this layer.
    httpBatchLink({ url, transformer: superjson }),
  ];
}

/**
 * Concrete-typed vanilla client for non-React contexts (e.g. Server Actions,
 * imperative client-side fetches, or test harnesses).
 *
 * TS-EXPECT-ERROR VERIFICATION:
 *   createYelliTrpcClient<AppRouter> passes the concrete router type.
 *   The @ts-expect-error inside @yelli/api-client suppresses the
 *   TransformerOptions<AnyRouter> constraint mismatch. With AppRouter
 *   bound here, the suppression is doing its job (resolves the generic)
 *   — it should NOT surface as "unused @ts-expect-error" in api-client's
 *   own typecheck because the error is on the unbound-generic side.
 *   If apps/yelli typecheck ever reports "unused @ts-expect-error" inside
 *   node_modules/@yelli/api-client, the constraint was fixed upstream —
 *   remove the suppression in Phase 7.
 */
export function makeTrpcClient(opts: {
  url: string;
  headers?: () => Record<string, string | null>;
}) {
  // @ts-expect-error tRPC v11: AppRouter (BuiltRouter) does not structurally
  // satisfy AnyRouter (Router<any,any>) — the `lazy` property is absent on
  // BuiltRouter._def. This is the same RC-era mismatch suppressed in
  // @yelli/api-client. No runtime impact; remove when tRPC RC stabilises.
  return createYelliTrpcClient<AppRouter>({
    url: opts.url,
    ...(opts.headers !== undefined
      ? {
          headers: () => {
            const raw = opts.headers!();
            // Filter null values — HTTPHeaders expects string values only.
            return Object.fromEntries(
              Object.entries(raw).filter(([, v]) => v !== null),
            ) as Record<string, string>;
          },
        }
      : {}),
  });
}
