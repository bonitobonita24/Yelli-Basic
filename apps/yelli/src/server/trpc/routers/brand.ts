import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { Prisma } from '@yelli/db';
import { BrandingValidationError, putBrandingLogo, validateBrandingUpload } from '@yelli/storage';

import { enqueueLogoImage } from '@/server/jobs/logo-queue';

import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

/**
 * Brand router — tenant branding (display name + logo). Production wiring of the
 * Phase 3.3 `sim.tenants.updateBranding` SWAP BOUNDARY. Admin-gated.
 *
 * Logo flow (LOCKED, DECISIONS_LOG "Branding upload MIME whitelist — PNG + JPEG only"):
 *   client → base64 bytes + declared MIME → magic-byte verify (PNG/JPEG only,
 *   ≤2 MiB; SVG/HTML rejected as XSS) → upload original to MinIO (dev) / S3 (prod)
 *   under a tenant-prefixed randomized key → set Tenant.logoUrl → best-effort
 *   enqueue `logo-image` for resize/optimization (worker lands in the BullMQ-wiring
 *   session; the original is already live so branding works without it).
 *
 * Audit: `tenant.branding.update` (§11-canonical VERBATIM) via the audit-middleware
 * injected `ctx.recordAudit` recorder (L5). The LAN-admin passphrase set
 * (`tenant.admin.passphrase.set`) is DEFERRED to the LAN-admin Wire session (W6) —
 * it needs the Argon2id hashing path, out of W4 scope.
 */
const TENANT_SELECT = {
  id: true,
  slug: true,
  displayName: true,
  logoUrl: true,
  isSuspended: true,
  createdAt: true,
} satisfies Prisma.TenantSelect;

const displayNameSchema = z.string().trim().min(1).max(60);

// Base64-encoded image bytes — bounded so a ~2 MiB binary (≈2.8 MiB base64) is the
// ceiling before the bytes are even decoded; the real size + magic-byte check runs
// in validateBrandingUpload.
const logoSchema = z.object({
  data: z.string().min(1).max(3_000_000),
  mime: z.string().min(1).max(100),
});

function requireAdmin(role: string): void {
  if (role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin role required.' });
  }
}

export const brandRouter = router({
  /** Update tenant branding. Provide `displayName` to rename; provide `logo`
   *  ({data,mime}) to set a new logo, `null` to clear it, or omit to leave it. */
  update: protectedProcedure
    .input(
      z.object({
        displayName: displayNameSchema.optional(),
        logo: logoSchema.nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      if (input.displayName === undefined && input.logo === undefined) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Nothing to update.' });
      }

      const data: Prisma.TenantUpdateInput = {};
      let uploadedKey: string | null = null;
      let logoChange: 'updated' | 'cleared' | null = null;

      if (input.displayName !== undefined) {
        data.displayName = input.displayName;
      }

      if (input.logo === null) {
        data.logoUrl = null;
        logoChange = 'cleared';
      } else if (input.logo) {
        const bytes = Buffer.from(input.logo.data, 'base64');
        let verified: { mime: 'image/png' | 'image/jpeg'; ext: 'png' | 'jpg' };
        try {
          verified = validateBrandingUpload(bytes, input.logo.mime);
        } catch (err) {
          if (err instanceof BrandingValidationError) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: err.message });
          }
          throw err;
        }
        const { key, url } = await putBrandingLogo({
          tenantId: ctx.tenantId,
          bytes,
          contentType: verified.mime,
          ext: verified.ext,
        });
        data.logoUrl = url;
        uploadedKey = key;
        logoChange = 'updated';
      }

      // Tenant is excluded from the L6 guard — direct by-id update on ctx.db.
      const updated = await ctx.db.tenant.update({
        where: { id: ctx.tenantId },
        data,
        select: TENANT_SELECT,
      });

      // L5 audit (§11 verbatim) via the injected recorder.
      await ctx.recordAudit(
        'tenant.branding.update',
        { type: 'Tenant', id: ctx.tenantId },
        {
          ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
          ...(logoChange ? { logo: logoChange } : {}),
        },
      );

      // Best-effort resize/optimization (no-op without REDIS_URL).
      if (uploadedKey) {
        await enqueueLogoImage({
          tenantId: ctx.tenantId,
          userId: ctx.user.id,
          storageKey: uploadedKey,
        });
      }

      return updated;
    }),
});
