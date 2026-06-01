/**
 * Reserved tenant slugs — single source of truth.
 * Referenced by: tenant.signup Zod validator (schemas/tenant-slug.ts) AND Traefik subdomain router.
 * See PRODUCT.md "Tenancy Model" and inputs.yml tenant_slugs.reserved.
 */
export const RESERVED_SLUGS = [
  "www",
  "api",
  "app",
  "admin",
  "staging",
  "dev",
  "_pwbt",
  "pwbt",
  "status",
  "blog",
  "docs",
  "mail",
  "smtp",
  "mx",
  "support",
  "help",
  "auth",
  "cdn",
] as const;

export type ReservedSlug = (typeof RESERVED_SLUGS)[number];
