import { createTRPCReact } from '@trpc/react-query';

import type { AppRouter } from '@/server/trpc/root';

/**
 * Client tRPC hooks. Type-only import of AppRouter (erased — no server code reaches
 * the client bundle). The Provider — httpBatchLink + superjson transformer (must
 * match the server) + QueryClient — is mounted by the Wire session.
 */
export const trpc = createTRPCReact<AppRouter>();
