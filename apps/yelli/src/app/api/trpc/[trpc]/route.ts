import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/trpc/root";
import { createTRPCContext } from "@/server/trpc/trpc";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
    onError({ path, error }) {
      if (process.env["NODE_ENV"] !== "production") {
        console.error(`[trpc] ${path ?? "<unknown>"}:`, error);
      }
    },
  });

export { handler as GET, handler as POST };
