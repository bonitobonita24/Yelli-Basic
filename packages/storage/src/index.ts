// @yelli/storage — S3/MinIO object storage for tenant branding uploads.
//
// Two concerns, both LOCKED at Phase 4 Part 4 D4 (DECISIONS_LOG "Branding upload
// MIME whitelist — PNG + JPEG only"):
//   • validate.ts — server-side magic-byte verification + PNG/JPEG whitelist +
//     2 MiB cap. Mandatory regardless of declared MIME (SVG/HTML rejected — XSS).
//   • client.ts   — tenant-prefixed, randomized object PUT to MinIO (dev) / S3 (prod).
//
// The provider is selected purely by env (STORAGE_ENDPOINT etc.); the same S3 API
// covers MinIO via `forcePathStyle`. The logo-image worker (BullMQ-wiring session)
// re-uses this layer for resize/re-encode; W4 uploads the original so branding
// works end-to-end without the worker.

export {
  validateBrandingUpload,
  BrandingValidationError,
  ALLOWED_BRANDING_MIMES,
  MAX_BRANDING_BYTES,
  type BrandingMime,
} from './validate';
export { putBrandingLogo, getBrandingObject } from './client';
