#!/usr/bin/env node
/**
 * design-validate.mjs — V32.8 Rule 31 pre-build DTCG conformance validator.
 *
 * Runs BEFORE `design:build` (Style Dictionary compilation). Fails fast on:
 *   1. Non-DTCG tokens (missing $value key)
 *   2. Color tokens with invalid hex format
 *   3. Empty $value fields
 *   4. Token groups that define both $type and nested tokens (DTCG conflict)
 *
 * Exit 0 = valid; exit 1 = invalid (with error details printed to stderr).
 *
 * Usage: node scripts/design-validate.mjs [--token-dir tokens]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const tokenDirArg = args.find((a) => a.startsWith('--token-dir='))?.split('=')[1];
const tokenDir = path.resolve(rootDir, tokenDirArg ?? 'tokens');

// ── Helpers ─────────────────────────────────────────────────────────────────
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** Recursively walk a token group, collecting leaf validation errors. */
function validateGroup(group, parentPath, errors, inheritedType) {
  for (const [key, value] of Object.entries(group)) {
    if (key.startsWith('$')) continue; // DTCG meta-keys — skip

    const tokenPath = parentPath ? `${parentPath}.${key}` : key;

    if (typeof value !== 'object' || value === null) {
      errors.push(`[${tokenPath}] Expected object, got ${typeof value}`);
      continue;
    }

    const hasValue = '$value' in value;
    const hasNestedTokens = Object.keys(value).some((k) => !k.startsWith('$'));
    const effectiveType = value.$type ?? inheritedType;

    if (hasValue && hasNestedTokens) {
      errors.push(`[${tokenPath}] DTCG conflict: has both $value and nested token keys`);
    }

    if (hasValue) {
      // Leaf token — validate
      if (value.$value === '' || value.$value === null || value.$value === undefined) {
        errors.push(`[${tokenPath}] Empty $value`);
      }
      if (effectiveType === 'color' && typeof value.$value === 'string') {
        if (!HEX_RE.test(value.$value)) {
          errors.push(
            `[${tokenPath}] Color value "${value.$value}" is not a valid hex — ` +
              'expected #RGB, #RGBA, #RRGGBB, or #RRGGBBAA',
          );
        }
      }
    } else if (!hasNestedTokens) {
      errors.push(`[${tokenPath}] Token has no $value and no nested tokens`);
    } else {
      // Group — recurse
      validateGroup(value, tokenPath, errors, effectiveType);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
const errors = [];
let fileCount = 0;

if (!fs.existsSync(tokenDir)) {
  console.error(`[design-validate] Token directory not found: ${tokenDir}`);
  process.exit(1);
}

const tokenFiles = fs
  .readdirSync(tokenDir, { recursive: true })
  .filter((f) => typeof f === 'string' && f.endsWith('.json'))
  .map((f) => path.join(tokenDir, f));

for (const filePath of tokenFiles) {
  fileCount++;
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    errors.push(`[${filePath}] JSON parse error: ${e.message}`);
    continue;
  }

  validateGroup(parsed, '', errors, undefined);
}

if (fileCount === 0) {
  console.error(`[design-validate] No .json files found in ${tokenDir}`);
  process.exit(1);
}

if (errors.length > 0) {
  console.error(`\n[design-validate] FAILED — ${errors.length} error(s) in ${fileCount} file(s):\n`);
  for (const e of errors) {
    console.error(`  ✗ ${e}`);
  }
  console.error('');
  process.exit(1);
}

console.log(`[design-validate] OK — ${fileCount} file(s) validated, 0 errors`);
process.exit(0);
