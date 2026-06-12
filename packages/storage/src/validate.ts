// Branding upload validation — LOCKED (DECISIONS_LOG "Branding upload MIME
// whitelist — PNG + JPEG only", Phase 4 Part 4 D4).
//
// PNG + JPEG ONLY. SVG / GIF / WEBP / HEIC / HTML rejected (security.md File
// Upload Safety #6 — SVG/HTML can embed JavaScript → XSS). Magic-byte
// verification is MANDATORY regardless of the declared MIME, and the declared
// MIME must agree with the sniffed format. Max 2 MiB.

export const ALLOWED_BRANDING_MIMES = ['image/png', 'image/jpeg'] as const;
export type BrandingMime = (typeof ALLOWED_BRANDING_MIMES)[number];

/** 2 MiB (LOCKED MAX_BRANDING_BYTES). */
export const MAX_BRANDING_BYTES = 2 * 1024 * 1024;

/** Thrown on any whitelist / size / magic-byte failure. The caller maps this to a
 *  tRPC BAD_REQUEST — packages/storage stays framework-agnostic. */
export class BrandingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrandingValidationError';
  }
}

// PNG signature: 89 50 4E 47 0D 0A 1A 0A. JPEG (JFIF/EXIF): FF D8 FF.
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((b, i) => bytes[i] === b);
}

/**
 * Validate raw image bytes for branding use. Returns the verified MIME + file
 * extension on success; throws BrandingValidationError otherwise.
 *
 * @param bytes        Decoded image bytes (NOT base64).
 * @param declaredMime The client-declared content type — must match the sniffed format.
 */
export function validateBrandingUpload(
  bytes: Uint8Array,
  declaredMime: string,
): { mime: BrandingMime; ext: 'png' | 'jpg' } {
  if (bytes.length === 0) {
    throw new BrandingValidationError('Empty file.');
  }
  if (bytes.length > MAX_BRANDING_BYTES) {
    throw new BrandingValidationError('Image exceeds the 2 MiB limit.');
  }

  const mime = declaredMime.toLowerCase().trim();
  if (!(ALLOWED_BRANDING_MIMES as readonly string[]).includes(mime)) {
    throw new BrandingValidationError('Only PNG and JPEG images are allowed.');
  }

  // Magic-byte verification — the file's real format wins over the declared MIME.
  if (startsWith(bytes, PNG_MAGIC)) {
    if (mime !== 'image/png') {
      throw new BrandingValidationError('Declared type does not match the file contents.');
    }
    return { mime: 'image/png', ext: 'png' };
  }
  if (startsWith(bytes, JPEG_MAGIC)) {
    if (mime !== 'image/jpeg') {
      throw new BrandingValidationError('Declared type does not match the file contents.');
    }
    return { mime: 'image/jpeg', ext: 'jpg' };
  }

  throw new BrandingValidationError('File is not a valid PNG or JPEG image.');
}
