import { auth } from "./config";

export type { Session } from "next-auth";

/**
 * Thin re-export of Auth.js v5 `auth()` for use in tRPC context + RSC pages.
 * Returns the (re-validated) session or null. The session callback already
 * blanks out `user` on stale securityVersion / suspension — callers can treat
 * `session.user === undefined` as unauthenticated.
 */
export async function getServerSession() {
  return auth();
}
