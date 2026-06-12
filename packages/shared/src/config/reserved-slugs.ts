// Reserved tenant subdomain slugs — single source of truth.
//
// SOURCE OF TRUTH: docs/PRODUCT.md "Tenant slug rules" + DECISIONS_LOG.md
// "[Step 7]" (18 reserved names). Referenced by the `tenant.signup` validator
// (see ../validators.ts) AND the Traefik subdomain router (S5). `_pwbt` is the
// Powerbyte Super-Admin system tenant — reserved so no signup can ever claim it.
//
// Signup rejects any reserved slug with a generic "slug unavailable" message
// (V25 anti-enumeration) — never reveal that the slug is reserved vs taken.

export const RESERVED_SLUGS = [
  'www',
  'api',
  'app',
  'admin',
  'staging',
  'dev',
  '_pwbt',
  'pwbt',
  'status',
  'blog',
  'docs',
  'mail',
  'smtp',
  'mx',
  'support',
  'help',
  'auth',
  'cdn',
] as const;

export type ReservedSlug = (typeof RESERVED_SLUGS)[number];

/** True if `slug` collides with the reserved list (case-insensitive). */
export function isReservedSlug(slug: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(slug.toLowerCase());
}
