import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __yelliPrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__yelliPrisma ?? new PrismaClient();

if (process.env["NODE_ENV"] !== "production") {
  globalThis.__yelliPrisma = prisma;
}

export type { PrismaClient } from "@prisma/client";
export * from "@prisma/client";
