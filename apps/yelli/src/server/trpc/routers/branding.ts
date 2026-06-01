import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { AuditTargetType } from "@prisma/client";
import { prisma } from "@yelli/db";
import { uploadBrandingImage } from "@yelli/storage";
import { router, protectedProcedure } from "../trpc";
import { requireRole } from "../middleware/rbac";
import { requireTenant } from "../middleware/tenant";
import { rateLimit } from "../middleware/rate-limit-mw";
import { withAudit } from "../middleware/audit-log";

// TODO Phase 7: add colorPrimary, colorAccent override fields to Tenant model and expose here.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB per PRODUCT.md LOCKED branding upload limit
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg"] as const;

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const brandingRouter = router({
  /**
   * Returns the tenant's current branding values.
   */
  me: protectedProcedure
    .use(requireTenant())
    .query(async ({ ctx }) => {
      const tenantId = ctx.session!.user!.tenantId!;

      const tenant = await prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: {
          slug: true,
          displayName: true,
          logoUrl: true,
        },
      });

      return {
        slug: tenant.slug,
        displayName: tenant.displayName,
        logoUrl: tenant.logoUrl ?? null,
      };
    }),

  /**
   * Admin uploads a new logo image (PNG or JPEG, max 2 MB).
   *
   * Receives base64-encoded image bytes. Validates MIME via magic bytes server-side
   * (security.md File Upload Safety rules 1-3 enforced inside @yelli/storage).
   * Storage path: ${tenantId}/branding/${randomFilename}.{ext}
   *
   * TODO Phase 7: no presigned URL pattern exists yet — direct upload via base64.
   * When a CDN/presigned flow is added, replace with sign+commit two-step.
   */
  uploadLogo: protectedProcedure
    .use(requireTenant())
    .use(requireRole("admin"))
    .use(rateLimit("upload"))
    .use(withAudit("tenant.branding.update", AuditTargetType.Tenant))
    .input(
      z.object({
        /**
         * Base64-encoded image bytes. Client must encode the raw file before sending.
         * Max decoded size: 2 MB.
         */
        base64Image: z.string().min(1),
        contentType: z.enum(ALLOWED_MIME_TYPES),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session!.user!.tenantId!;

      // Decode base64 → Uint8Array (server-side, never trust client byte count)
      let bytes: Uint8Array;
      try {
        bytes = Buffer.from(input.base64Image, "base64");
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid base64 encoding.",
        });
      }

      if (bytes.length > MAX_LOGO_BYTES) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Logo must be ≤ ${MAX_LOGO_BYTES / 1024 / 1024} MB.`,
        });
      }

      // uploadBrandingImage validates MIME via magic bytes, applies random filename,
      // and prefixes key with tenantId (security.md rules 4+5).
      const result = await uploadBrandingImage({
        bucketKey: "uploads",
        tenantId,
        entityType: "branding",
        declaredMime: input.contentType,
        bytes,
      });

      // Derive the public URL from STORAGE_ENDPOINT + bucket + key
      const storageEndpoint = process.env["STORAGE_ENDPOINT"] ?? "";
      const logoUrl = `${storageEndpoint}/${result.bucket}/${result.key}`;

      await prisma.tenant.update({
        where: { id: tenantId },
        data: { logoUrl },
      });

      return { logoUrl, key: result.key };
    }),
});
