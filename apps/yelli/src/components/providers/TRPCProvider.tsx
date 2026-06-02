"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { trpc, makeTrpcLinks } from "@/lib/trpc-client";

/**
 * Wires React Query + tRPC client links for client components.
 * Mount once at the root layout; `useQuery`/`useMutation` hooks under it
 * resolve through this client.
 *
 * Notes:
 * - The client per-render pattern (`useState(() => ...)`) keeps the QueryClient
 *   stable across re-renders without leaking between requests in RSC.
 * - URL is computed relative — works for both dev (localhost:46848) and
 *   prod (yelli.app). For Server Action callers, see makeTrpcClient in
 *   src/lib/trpc-client.ts.
 * - Uses makeTrpcLinks() from trpc-client.ts (no transformer: superjson arg —
 *   see D9 comments re: RC-era TransformerOptions constraint mismatch).
 */
function trpcUrl(): string {
  if (typeof window !== "undefined") return "/api/trpc";
  // SSR fallback — Next.js RSC may not supply window; use env or localhost.
  const base =
    process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:46848";
  return `${base.replace(/\/$/, "")}/api/trpc`;
}

export function TRPCProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // V31.3 dual-path loading — keep stale data visible while refetching.
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({ links: makeTrpcLinks(trpcUrl()) }),
  );

  return (
    <SessionProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </trpc.Provider>
    </SessionProvider>
  );
}
