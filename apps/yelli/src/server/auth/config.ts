import { prisma } from "@yelli/db";
import bcrypt from "bcryptjs";
import NextAuth, {
  type DefaultSession,
  type NextAuthConfig,
  type Session,
} from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { env } from "@/env";

/**
 * Auth.js v5 — Credentials provider only (email + password + Turnstile).
 * LAN passphrase admin auth lives elsewhere (HttpOnly yelli_admin_session cookie),
 * not in this Auth.js config.
 *
 * Strategy: JWT. The session() callback re-reads User.securityVersion + isSuspended
 * + tenant.isSuspended from the DB on every call → stale session forces re-auth
 * (V28 / security.md Auth Defaults #6).
 *
 * Note (scaffold simplification): authorize() looks up users by email only — multi-tenant
 * narrowing by tenantSlug from request host is a Phase 7 task. For MVP/single-tenant
 * deployments this is correct; for Cloud SaaS, deferred.
 */

type YelliRole = "admin" | "member";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  turnstileToken: z.string().min(1).optional(),
});

async function verifyTurnstile(token: string, remoteIp: string | null): Promise<boolean> {
  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
  });
  if (remoteIp) body.append("remoteip", remoteIp);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

declare module "next-auth" {
  interface User {
    tenantId: string;
    tenantSlug: string;
    role: YelliRole;
    securityVersion: number;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      tenantId: string;
      tenantSlug: string;
      role: YelliRole;
      securityVersion: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    tenantId: string;
    tenantSlug: string;
    role: YelliRole;
    securityVersion: number;
  }
}

export const authConfig = {
  // NOTE: PrismaAdapter omitted intentionally — JWT strategy + Credentials provider
  // does not require a DB adapter. Add back in Phase 7 if magic-link/email provider
  // is needed. (@auth/prisma-adapter pins @auth/core@0.41.x which conflicts with
  // next-auth's @auth/core@0.35.x until pnpm deduplication is configured.)
  session: { strategy: "jwt" },
  trustHost: env.AUTH_TRUST_HOST,
  secret: env.AUTH_SECRET,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        turnstileToken: { label: "Turnstile", type: "text" },
      },
      async authorize(rawCredentials, request) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const { email, password, turnstileToken } = parsed.data;

        // Turnstile siteverify (Cloud only — skip in LAN mode).
        if (!env.LAN_MODE_ENABLED) {
          if (!turnstileToken) return null;
          const xff = request?.headers?.get("x-forwarded-for");
          const ip = xff?.split(",")[0]?.trim() ?? null;
          const human = await verifyTurnstile(turnstileToken, ip);
          if (!human) return null;
        }

        const user = await prisma.user.findFirst({
          where: { email: email.toLowerCase() },
          include: { tenant: true },
        });
        // Generic failure — never reveal which check failed.
        if (!user || user.isSuspended || user.tenant.isSuspended) return null;

        const passwordOk = await bcrypt.compare(password, user.passwordHash);
        if (!passwordOk) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          tenantId: user.tenantId,
          tenantSlug: user.tenant.slug,
          role: user.role as YelliRole,
          securityVersion: user.securityVersion,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id ?? "";
        token.tenantId = user.tenantId;
        token.tenantSlug = user.tenantSlug;
        token.role = user.role;
        token.securityVersion = user.securityVersion;
      }
      return token;
    },
    async session({ session, token }) {
      const fresh = await prisma.user.findUnique({
        where: { id: token.userId },
        include: { tenant: true },
      });
      if (!fresh || fresh.isSuspended || fresh.tenant.isSuspended) {
        return { ...session, user: undefined as unknown as Session["user"] };
      }
      if (fresh.securityVersion !== token.securityVersion) {
        return { ...session, user: undefined as unknown as Session["user"] };
      }
      session.user = {
        ...session.user,
        id: token.userId,
        tenantId: fresh.tenantId,
        tenantSlug: fresh.tenant.slug,
        role: fresh.role as YelliRole,
        securityVersion: fresh.securityVersion,
      };
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

// Re-export JWT type so consumers can opt into the augmented shape.
export type { JWT };
