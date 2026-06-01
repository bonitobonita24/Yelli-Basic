/**
 * File upload validation — MIME whitelist + magic byte check.
 *
 * security.md File Upload Safety:
 *   - Rule 1: whitelist MIME types explicitly
 *   - Rule 2: validate MIME server-side via magic bytes (never trust extension)
 *   - Rule 3: enforce size limit (default 2 MiB for branding logos)
 *   - Rule 6: SVG + HTML BLOCKED by default (XSS vector)
 *
 * Currently allowed: PNG, JPEG. SVG re-enable requires DOMPurify wiring
 * (Phase 5+ Feature Update — logged in DECISIONS_LOG / lessons.md).
 */

export interface AllowedMime {
  mime: string;
  magic: ReadonlyArray<number>;
  ext: string;
}

export const ALLOWED_MIMES: ReadonlyArray<AllowedMime> = [
  { mime: "image/png", magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], ext: "png" },
  { mime: "image/jpeg", magic: [0xff, 0xd8, 0xff], ext: "jpg" },
];

export const MAX_BRANDING_BYTES = 2 * 1024 * 1024; // 2 MiB

export interface ValidatedFile {
  mime: string;
  ext: string;
  bytes: Uint8Array;
}

export class FileValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "FileValidationError";
  }
}

export function validateBrandingUpload(input: {
  bytes: Uint8Array;
  declaredMime: string;
}): ValidatedFile {
  if (input.bytes.length === 0) {
    throw new FileValidationError("empty", "File is empty");
  }
  if (input.bytes.length > MAX_BRANDING_BYTES) {
    throw new FileValidationError(
      "too_large",
      `File exceeds ${MAX_BRANDING_BYTES} bytes`
    );
  }

  const matched = ALLOWED_MIMES.find((m) => m.mime === input.declaredMime);
  if (!matched) {
    throw new FileValidationError(
      "mime_not_allowed",
      `MIME ${input.declaredMime} is not in the branding whitelist`
    );
  }

  // Magic byte check — defeats extension/MIME spoofing
  for (let i = 0; i < matched.magic.length; i++) {
    if (input.bytes[i] !== matched.magic[i]) {
      throw new FileValidationError(
        "magic_mismatch",
        `File bytes do not match declared MIME ${matched.mime}`
      );
    }
  }

  return { mime: matched.mime, ext: matched.ext, bytes: input.bytes };
}
