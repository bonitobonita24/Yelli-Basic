import type { Role } from '@yelli/db';
import type { DefaultSession } from 'next-auth';

/**
 * Module augmentation — adds Yelli tenant identity to the Auth.js Session, User,
 * and JWT shapes. `role` is the Prisma `Role` enum (`admin | member`). These
 * fields are populated by the jwt/session callbacks in src/server/auth/config.ts.
 */
declare module 'next-auth' {
  interface User {
    role: Role;
    tenantId: string;
    tenantSlug: string;
    securityVersion: number;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      tenantId: string;
      tenantSlug: string;
      securityVersion: number;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string;
    role: Role;
    tenantId: string;
    tenantSlug: string;
    securityVersion: number;
  }
}
