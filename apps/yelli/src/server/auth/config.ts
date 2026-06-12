import { prisma } from '@yelli/db';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

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
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        tenantSlug: { label: 'Tenant', type: 'text' },
      },
      // TODO (accounts-auth Wire session): resolve tenant by slug, look up the user
      // by (tenantId, email), bcrypt.compare(password, user.passwordHash) at 12
      // rounds (LOCKED: Webmaster password hash algorithm), then return the
      // augmented user. Returns null until wired — login is intentionally inert in
      // the scaffold.
      authorize: async () => null,
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
