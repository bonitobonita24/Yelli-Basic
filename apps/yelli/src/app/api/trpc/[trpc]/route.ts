import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { createContext } from '@/server/trpc/context';
import { appRouter } from '@/server/trpc/root';

/** tRPC v11 fetch adapter — App Router catch-all handler for /api/trpc/*. */
const handler = (req: Request): Promise<Response> =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
