import bcrypt from 'bcryptjs';

import { prisma } from '@yelli/db';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';

/**
 * Auth.js v5 — Credentials provider + JWT sessions, NO PrismaAdapter
 * (LOCKED: Auth.js v5 without PrismaAdapter — Credentials + JWT only). The
 * Account/Session/VerificationToken tables stay empty until Phase 7 adds
 * magic-link providers (which need the adapter back).
 *
 * The jwt callback DB-validates User.securityVersion + isSuspended on every call
 * and returns null on mismatch — preserving the V28 session-invalidation guarantee
 * under the stateless JWT strategy (security.md §AUTH #6). The session callback
 * surfaces the validated identity onto session.user.
 *
 * `authorize()` is the Cloud sign-in path (multi-tenant). Tenants resolve from the
 * required `tenantSlug` credential; the subdomain proxy (V25) injects the matching
 * value at the login form. LAN edition uses a different path entirely (no Auth.js
 * User — see ./lan-admin.ts cookie session).
 *
 * Hash algorithm — bcryptjs at 12 rounds — is LOCKED (DECISIONS "Webmaster password
 * hash algorithm"); Argon2id is reserved for Tenant.adminPassphraseHash (LAN admin).
 * Generic null-returns on any failure satisfy the security.md AUTH error-message
 * rule (never reveal whether tenant/email exists).
 */
const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        tenantSlug: { label: 'Tenant', type: 'text' },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password, tenantSlug } = parsed.data;

        const tenant = await prisma.tenant.findUnique({
          where: { slug: tenantSlug },
          select: { id: true, slug: true, isSuspended: true },
        });
        if (!tenant || tenant.isSuspended) return null;

        const user = await prisma.user.findUnique({
          where: { tenantId_email: { tenantId: tenant.id, email } },
          select: {
            id: true,
            email: true,
            displayName: true,
            passwordHash: true,
            role: true,
            tenantId: true,
            isSuspended: true,
            securityVersion: true,
          },
        });
        if (!user || user.isSuspended) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // Record last-login best-effort (non-blocking; failure must not block sign-in).
        prisma.user
          .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch(() => {});

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          role: user.role,
          tenantId: user.tenantId,
          tenantSlug: tenant.slug,
          securityVersion: user.securityVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign-in: persist identity onto the token.
      if (user) {
        token.userId = user.id ?? '';
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.tenantSlug = user.tenantSlug;
        token.securityVersion = user.securityVersion;
        return token;
      }
      // Subsequent calls: DB-validate freshness (LOCKED V28). 30s Valkey freshness
      // cache lands in the Wire session to avoid a DB hit per request.
      if (token.userId) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.userId },
          select: {
            isSuspended: true,
            securityVersion: true,
            role: true,
            tenantId: true,
            tenant: { select: { slug: true } },
          },
        });
        if (!fresh || fresh.isSuspended || fresh.securityVersion !== token.securityVersion) {
          return null;
        }
        token.role = fresh.role;
        token.tenantId = fresh.tenantId;
        token.tenantSlug = fresh.tenant.slug;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId && session.user) {
        session.user.id = token.userId;
        session.user.role = token.role;
        session.user.tenantId = token.tenantId;
        session.user.tenantSlug = token.tenantSlug;
        session.user.securityVersion = token.securityVersion;
      }
      return session;
    },
  },
});
