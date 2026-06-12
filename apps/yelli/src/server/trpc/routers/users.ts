import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { Prisma } from '@yelli/db';
import { userDisplayNameSchema } from '@yelli/shared';

import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

/**
 * Users router — account self-ownership + tenant member directory (read). Admin
 * member mutations (suspend, role promote/demote) belong to the tenancy-members
 * Wire session (W2), not here.
 *
 * USER_SELECT strips every sensitive field from client-facing rows: passwordHash +
 * securityVersion (secrets, security.md #4) and tenantId (security.md #13).
 */
const USER_SELECT = {
  id: true,
  email: true,
  emailVerifiedAt: true,
  displayName: true,
  role: true,
  isSuspended: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const usersRouter = router({
  /** The signed-in user's own profile. */
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.user.id },
      select: USER_SELECT,
    });
    if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found.' });
    return user;
  }),

  /** Member directory for the current tenant (ScreenAdminMembers). */
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.user.findMany({ where: {}, select: USER_SELECT, orderBy: { createdAt: 'asc' } }),
  ),

  /** Rename self. Ownership-bound to ctx.user.id — a user can never rename another.
   *  No §11 audit action exists for user display-name changes (locked vocabulary),
   *  so none is emitted. */
  setDisplayName: protectedProcedure
    .input(z.object({ displayName: userDisplayNameSchema }))
    .mutation(({ ctx, input }) =>
      ctx.db.user.update({
        where: { id: ctx.user.id },
        data: { displayName: input.displayName },
        select: USER_SELECT,
      }),
    ),
});
