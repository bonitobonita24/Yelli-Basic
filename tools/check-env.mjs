#!/usr/bin/env node
/**
 * tools/check-env.mjs
 * Verify required env vars exist in .env.${APP_ENV}.
 * Usage: APP_ENV=dev node tools/check-env.mjs
 * Exit 0 = all present, 1 = missing keys.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

// ── Required keys per environment ──
const REQUIRED = {
  dev: [
    "DATABASE_URL",
    "REDIS_URL",
    "AUTH_SECRET",
    "NEXTAUTH_URL",
    "STORAGE_ENDPOINT",
    "STORAGE_ACCESS_KEY",
    "STORAGE_SECRET_KEY",
    "STORAGE_BUCKET",
    "APP_PORT",
    "COMPOSE_PROJECT_NAME",
  ],
  staging: [
    "DATABASE_URL",
    "REDIS_URL",
    "AUTH_SECRET",
    "NEXTAUTH_URL",
    "STORAGE_ENDPOINT",
    "STORAGE_ACCESS_KEY",
    "STORAGE_SECRET_KEY",
    "STORAGE_BUCKET",
    "APP_PORT",
    "COMPOSE_PROJECT_NAME",
    "APP_DOMAIN",
    "TRAEFIK_NETWORK",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "TURNSTILE_SECRET_KEY",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM",
  ],
  prod: [
    "DATABASE_URL",
    "REDIS_URL",
    "AUTH_SECRET",
    "NEXTAUTH_URL",
    "STORAGE_ENDPOINT",
    "STORAGE_ACCESS_KEY",
    "STORAGE_SECRET_KEY",
    "STORAGE_BUCKET",
    "APP_PORT",
    "COMPOSE_PROJECT_NAME",
    "APP_DOMAIN",
    "TRAEFIK_NETWORK",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "TURNSTILE_SECRET_KEY",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM",
  ],
};

// ── Simple .env parser (KEY=VALUE, strips quotes, ignores comments) ──
function parseEnvFile(text) {
  const env = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

// ── Main ──
const appEnv = process.env.APP_ENV ?? "dev";
const requiredKeys = REQUIRED[appEnv];

if (!requiredKeys) {
  console.error(`❌ Unknown APP_ENV "${appEnv}". Supported: dev, staging, prod`);
  process.exit(1);
}

// In CI the generated .env.<env> is gitignored (holds real secrets) and never
// exists, so validate that the committed .env.example template DECLARES every
// required key instead. Placeholder values (e.g. "⏳ …") are expected and
// allowed here — CI only enforces that the contract is documented, not filled.
const inCI = process.env.CI === "true" || process.env.CI === "1";
if (inCI) {
  const exampleFile = resolve(ROOT, ".env.example");
  if (!existsSync(exampleFile)) {
    console.error(`❌ .env.example not found — required to validate the env contract in CI.`);
    process.exit(1);
  }
  const declared = parseEnvFile(readFileSync(exampleFile, "utf8"));
  let missingDecl = 0;
  for (const key of requiredKeys) {
    if (key in declared) {
      console.log(`  ✅ ${key} (declared)`);
    } else {
      console.error(`  ❌ ${key} — not declared in .env.example`);
      missingDecl++;
    }
  }
  if (missingDecl > 0) {
    console.error(`\n❌ ${missingDecl} required key(s) not declared in .env.example`);
    process.exit(1);
  }
  console.log(`\n✅ .env.example declares all ${requiredKeys.length} required keys for APP_ENV=${appEnv}`);
  process.exit(0);
}

const envFile = resolve(ROOT, `.env.${appEnv}`);
let loadedEnv = {};

if (existsSync(envFile)) {
  try {
    loadedEnv = parseEnvFile(readFileSync(envFile, "utf8"));
    console.log(`📄 Loaded ${envFile}`);
  } catch (e) {
    console.error(`❌ Failed to read ${envFile}:`, e.message);
    process.exit(1);
  }
} else {
  console.warn(`⚠️  ${envFile} not found — checking process.env only`);
}

// Merge: file overrides nothing in process.env for this check
// We check the file values primarily (or process.env fallback)
const merged = { ...loadedEnv };
for (const [k, v] of Object.entries(process.env)) {
  if (!(k in merged)) merged[k] = v;
}

let missing = 0;
for (const key of requiredKeys) {
  const val = merged[key];
  if (!val || val.startsWith("⏳")) {
    console.error(`  ❌ ${key} — MISSING or unfilled placeholder`);
    missing++;
  } else {
    console.log(`  ✅ ${key}`);
  }
}

if (missing > 0) {
  console.error(`\n❌ ${missing} required key(s) missing in .env.${appEnv}`);
  process.exit(1);
} else {
  console.log(`\n✅ All required env vars present for APP_ENV=${appEnv}`);
  process.exit(0);
}
