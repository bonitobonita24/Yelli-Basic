import { createHash, randomBytes } from 'node:crypto';

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { Prisma } from '@yelli/db';
import { emailSchema } from '@yelli/shared';

import { enqueueInvitationEmail } from '@/server/jobs/email-queue';

import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

/**
 * Invitations router — admin-facing member-invite surface. Production wiring of the
 * Phase 3.3 `sim.invitations` SWAP BOUNDARY (PROTOTYPE.md Flow F): an admin invites
 * a member by email; the invite carries a single-use token (7-day expiry) delivered
 * by the `email` BullMQ queue (the W3 "invitation email queue trigger").
 *
 * Every mutation runs under the LOCKED protectedProcedure 5-step chain (L1+L6 tenant
 * guard, L5 audit) and is admin-gated. Audit actions use the §11-canonical vocabulary
 * VERBATIM (@yelli/shared): invitation.create / invitation.revoke / invitation.resend.
 *
 * tokenHash (a secret) is never returned to the client — INVITATION_SELECT omits it.
 * The raw token is hashed before storage and travels ONLY in the queued email.
 *
 * DEFERRED (accounts-auth Wire session): `accept` (invitation.accept + user.create).
 * Accepting an invite provisions a User with a bcrypt passwordHash — that is the
 * accounts-auth concern (Auth.js authorize() is still a skeleton), not W3's.
 */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7-day expiry (DECISIONS Flow F).

/** Client-facing invitation row — tokenHash (the secret) is never exposed. */
const INVITATION_SELECT = {
  id: true,
  email: true,
  invitedByUserId: true,
  expiresAt: true,
  acceptedAt: true,
  createdAt: true,
} satisfies Prisma.InvitationSelect;

const idInput = z.object({ id: z.string().min(1) });

function requireAdmin(role: string): void {
  if (role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin role required.' });
  }
}

/** A fresh single-use invite token + its SHA-256 hash. Only the hash is stored
 *  (Invitation.tokenHash @unique); the raw token travels only in the email. */
function mintToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

export const invitationsRouter = router({
  /** All invitations for the tenant, newest first (admin Invitations screen). */
  list: protectedProcedure.query(({ ctx }) => {
    requireAdmin(ctx.user.role);
    return ctx.db.invitation.findMany({
      where: {},
      select: INVITATION_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }),

  /** Invite a member by email. Stores the token hash + audit, then fires the email
   *  job (best-effort) AFTER the row is committed (a queue hiccup must not orphan
   *  the invite — the admin can resend). */
  create: protectedProcedure
    .input(z.object({ email: emailSchema }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const { token, tokenHash } = mintToken();
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
      const invitation = await ctx.db.$transaction(async (tx) => {
        const inv = await tx.invitation.create({
          data: {
            tenantId: ctx.tenantId,
            invitedByUserId: ctx.user.id,
            email: input.email,
            tokenHash,
            expiresAt,
          },
          select: INVITATION_SELECT,
        });
        await tx.auditLog.create({
          data: {
            tenantId: ctx.tenantId,
            actorUserId: ctx.user.id,
            action: 'invitation.create',
            targetType: 'Invitation',
            targetId: inv.id,
            payload: { invitationId: inv.id, email: inv.email },
          },
        });
        return inv;
      });
      await enqueueInvitationEmail({
        tenantId: ctx.tenantId,
        userId: ctx.user.id,
        to: input.email,
        token,
      });
      return invitation;
    }),

  /** Revoke a pending invite — immediately expires it (keeps the row for the admin
   *  history, matching the prototype's expire-and-list behavior) + audit. */
  revoke: protectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    requireAdmin(ctx.user.role);
    return ctx.db.$transaction(async (tx) => {
      const prior = await tx.invitation.findUnique({ where: { id: input.id } });
      if (!prior) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation not found.' });
      if (prior.acceptedAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invitation already accepted.' });
      }
      const invitation = await tx.invitation.update({
        where: { id: input.id },
        data: { expiresAt: new Date() },
        select: INVITATION_SELECT,
      });
      await tx.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          actorUserId: ctx.user.id,
          action: 'invitation.revoke',
          targetType: 'Invitation',
          targetId: invitation.id,
          payload: { invitationId: invitation.id },
        },
      });
      return invitation;
    });
  }),

  /** Re-issue a pending invite: a fresh token + a fresh 7-day window + audit, then
   *  re-fires the email (best-effort, post-commit). */
  resend: protectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    requireAdmin(ctx.user.role);
    const { token, tokenHash } = mintToken();
    const result = await ctx.db.$transaction(async (tx) => {
      const prior = await tx.invitation.findUnique({ where: { id: input.id } });
      if (!prior) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation not found.' });
      if (prior.acceptedAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invitation already accepted.' });
      }
      const invitation = await tx.invitation.update({
        where: { id: input.id },
        data: { tokenHash, expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
        select: INVITATION_SELECT,
      });
      await tx.auditLog.create({
        data: {
          tenantId: ctx.tenantId,
          actorUserId: ctx.user.id,
          action: 'invitation.resend',
          targetType: 'Invitation',
          targetId: invitation.id,
          payload: { invitationId: invitation.id },
        },
      });
      return invitation;
    });
    await enqueueInvitationEmail({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      to: result.email,
      token,
    });
    return result;
  }),
});
