import { initTRPC } from '@trpc/server';
import superjson from 'superjson';

import type { Context } from './context';

/**
 * tRPC v11 base. The superjson transformer is configured here AND must be mirrored
 * on the client links (the Wire-session Provider sets it on httpBatchLink). The
 * `error` middleware handles server-side logging, so errorFormatter stays default
 * for the scaffold.
 */
const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const middleware = t.middleware;

/** Unguarded base procedure. Compose tiers in ./procedures — never use directly. */
export const baseProcedure = t.procedure;
