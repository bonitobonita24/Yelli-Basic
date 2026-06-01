import DOMPurify from "isomorphic-dompurify";

/**
 * Strips dangerous HTML from user-submitted content before storage.
 * Prevents stored XSS. Allowed tags + attrs are intentionally narrow —
 * call sanitizePlainText() for fields where ANY HTML is wrong.
 *
 * Usage:
 *   const cleanBio = sanitize(input.bio);
 *   const cleanName = sanitizePlainText(input.name);
 */
export function sanitize(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "p", "br", "ul", "ol", "li", "a"],
    ALLOWED_ATTR: ["href", "target", "rel"],
    FORCE_BODY: true,
  });
}

export function sanitizePlainText(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}
