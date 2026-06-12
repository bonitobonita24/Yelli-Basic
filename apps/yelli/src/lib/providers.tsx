'use client';

// Mounted from the (server) root layout. Composes the three client providers the
// app shell needs: Auth.js session, tRPC client, and the react-query cache.
//   - SessionProvider gets the server-resolved session so the first paint has the
//     real auth state (no client round-trip flash — supports the Flow E gate W1b wires).
//   - tRPC transformer (superjson) is set on httpBatchLink to MATCH the server (trpc.ts).

import { httpBatchLink } from '@trpc/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import superjson from 'superjson';
import { useState, type ReactNode } from 'react';

import { trpc } from './trpc/react';

function getBaseUrl(): string {
  if (typeof window !== 'undefined') return '';
  return `http://localhost:${process.env.PORT ?? '46848'}`;
}

export function Providers({
  children,
  session,
}: {
  children: ReactNode;
  session: Session | null;
}) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <SessionProvider session={session}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </trpc.Provider>
    </SessionProvider>
  );
}
