import type { Job } from 'bullmq';
import sharp from 'sharp';
import { prisma } from '@yelli/db';
import {
  getBrandingObject,
  putBrandingLogo,
  validateBrandingUpload,
  type BrandingMime,
} from '@yelli/storage';
import { assertTenantUser, log } from './_validate';
import { QUEUE_NAMES, type LogoImageJobData } from '../queues';

/**
 * logo-image worker — tenant branding logo resize + optimize (W5d, LOCKED: Jobs +
 * Queues [Step 5], branding upload whitelist [Phase 4 Part 4 D4]).
 *
 * The brand router (W4) validates + uploads the ORIGINAL logo and sets
 * Tenant.logoUrl immediately so branding works without this worker; it then fires
 * a best-effort `logo-image` job carrying the original's `storageKey`. This
 * processor fetches that original, re-verifies it server-side (magic-byte PNG/JPEG
 * whitelist — SVG/HTML rejected as an XSS vector, security.md File Upload Safety
 * #6), resizes it to the app-shell render target, re-encodes (optimizes), writes the
 * processed asset back to storage, and points Tenant.logoUrl at it.
 *
 * Render target: the app shell renders the logo in a small (~36 px) box; the
 * processed asset is produced at 72 px square (2× density) so it stays crisp on
 * retina displays in that box. The Tenant schema holds a single `logoUrl`, so one
 * retina-ready asset is stored rather than orphaned 1×/2× variants the schema
 * cannot reference. `fit: 'contain'` preserves aspect ratio; `withoutEnlargement`
 * never upscales a smaller original. PNG keeps its alpha (transparent canvas);
 * JPEG is flattened onto white (JPEG has no alpha channel).
 *
 * Audit policy (W5d brief, device-archive / W5c precedent): structured-JSON
 * completion / failure logs ONLY — NO AuditLog row, NO AUDIT_ACTIONS vocab change.
 * The `tenant.branding.update` domain audit row is already written by the brand
 * router at enqueue time; this worker is image-processing infrastructure, not a new
 * auditable event. Logs carry the storage key + byte/dimension counts only — no PII.
 *
 * No new credential is provisioned: storage is reached through the existing
 * @yelli/storage layer, which reads the already-provisioned MinIO/S3 branding-upload
 * env (STORAGE_ENDPOINT / STORAGE_BUCKET / STORAGE_ACCESS_KEY / STORAGE_SECRET_KEY).
 */

/** The app-shell render box is ~36 px; emit at 2× so it stays crisp on retina. */
const RENDER_TARGET_PX = 72;

/** Map a sharp-detected format to the corresponding branding MIME (PNG/JPEG only). */
function mimeFromSharpFormat(format: string | undefined): string {
  if (format === 'png') return 'image/png';
  if (format === 'jpeg') return 'image/jpeg';
  // Any other detected format is not in the whitelist — surface it to the validator,
  // which rejects it (the magic-byte check is the authority regardless of this hint).
  return format ? `image/${format}` : '';
}

export async function processLogoImage(job: Job<LogoImageJobData>): Promise<void> {
  assertTenantUser(job.data);
  const { tenantId, storageKey } = job.data;

  try {
    // 1. Fetch the original upload from storage (key is trusted server state — W4 producer).
    const { bytes, contentType } = await getBrandingObject(storageKey);
    const buffer = Buffer.from(bytes);

    // 2. Re-verify server-side: magic-byte PNG/JPEG whitelist + 2 MiB cap (LOCKED).
    //    Prefer the stored content type; fall back to sharp's sniffed format. The
    //    validator's magic-byte check is authoritative either way — SVG/HTML/other
    //    inputs throw BrandingValidationError → BullMQ retries → DLQ (the gap surfaces).
    const meta = await sharp(buffer).metadata();
    const declaredMime =
      contentType && (contentType === 'image/png' || contentType === 'image/jpeg')
        ? contentType
        : mimeFromSharpFormat(meta.format);
    const { mime, ext } = validateBrandingUpload(bytes, declaredMime);

    // 3. Resize to the retina render target + re-encode (optimize), preserving format.
    const isPng = mime === 'image/png';
    const pipeline = sharp(buffer).resize(RENDER_TARGET_PX, RENDER_TARGET_PX, {
      fit: 'contain',
      withoutEnlargement: true,
      // PNG keeps a transparent canvas; JPEG (no alpha) is flattened onto white.
      background: isPng ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 255, g: 255, b: 255, alpha: 1 },
    });
    const processed = isPng
      ? await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer()
      : await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();

    // 4. Write the processed asset back to storage (tenant-prefixed, randomized key).
    const { key, url } = await putBrandingLogo({
      tenantId,
      bytes: processed,
      contentType: mime as BrandingMime,
      ext,
    });

    // 5. Point Tenant.logoUrl at the processed asset. updateMany (scoped by id) does
    //    not throw if the tenant was deleted mid-flight — treat 0 rows as a no-op.
    const result = await prisma.tenant.updateMany({
      where: { id: tenantId },
      data: { logoUrl: url },
    });
    if (result.count === 0) {
      log('warn', 'logo-image: tenant not found, skipping logoUrl update', {
        queue: QUEUE_NAMES.logoImage,
        jobId: job.id,
        tenantId,
      });
      return;
    }

    // Completion log: counts/dimensions only — no PII (the storage key is internal).
    log('info', 'logo-image processed', {
      queue: QUEUE_NAMES.logoImage,
      jobId: job.id,
      tenantId,
      mime,
      sourceBytes: buffer.byteLength,
      processedBytes: processed.byteLength,
      target: RENDER_TARGET_PX,
      sourceKey: storageKey,
      processedKey: key,
    });
  } catch (err) {
    // Failure log: error message only. BadBranding (SVG/oversize/corrupt) and storage/
    // resize failures all land here → rethrow → BullMQ retry (attempts: 3, exponential
    // backoff) → failed set (DLQ). The original logo stays live on Tenant.logoUrl.
    log('error', 'logo-image processing failed', {
      queue: QUEUE_NAMES.logoImage,
      jobId: job.id,
      tenantId,
      sourceKey: storageKey,
      error: (err as Error).message,
    });
    throw err;
  }
}
