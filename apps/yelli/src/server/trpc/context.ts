import type { Session } from 'next-auth';

import { auth } from '@/server/auth/config';

/**
 * Per-request tRPC context. The Auth.js v5 universal `auth()` reads the JWT
 * session from cookies — no DB hit here; the jwt callback already DB-validates
 * securityVersion + isSuspended on every call (LOCKED V28).
 */
export type Context = {
  session: Session | null;
};

export async function createContext(): Promise<Context> {
  const session = await auth();
  return { session };
}
