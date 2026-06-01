import { z } from "zod";
import { RESERVED_SLUGS } from "../config/reserved-slugs.js";

export const TENANT_SLUG_REGEX = /^[a-z][a-z0-9-]*[a-z0-9]$/;

export const TenantSlugSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(
    TENANT_SLUG_REGEX,
    "slug must start with a letter, end alphanumeric, contain only lowercase letters/digits/hyphens",
  )
  .refine((s) => !(RESERVED_SLUGS as readonly string[]).includes(s), {
    message: "slug is reserved",
  });
