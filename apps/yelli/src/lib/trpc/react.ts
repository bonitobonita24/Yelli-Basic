import { createTRPCReact } from '@trpc/react-query';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

import type { AppRouter } from '@/server/trpc/root';

/**
 * Client tRPC hooks. Type-only import of AppRouter (erased — no server code reaches
 * the client bundle). The Provider — httpBatchLink + superjson transformer (must
 * match the server) + QueryClient — is mounted by the Wire session.
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Inferred procedure I/O types for client components — the exact wire shapes (the
 * `*_SELECT` projections, not the raw Prisma models). Use e.g.
 * `RouterOutputs['devices']['list'][number]` for a directory row.
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
