/**
 * Style Dictionary v5 configuration — Yelli design token pipeline (V32.8 Rule 31).
 *
 * Flow:
 *   tokens/index.json (DTCG source)
 *     → design:validate  (scripts/design-validate.mjs — DTCG conformance check)
 *     → design:build     (this config — Style Dictionary compilation)
 *     → tokens/build/generated-tokens.css  (--sd-color-* CSS custom properties)
 *     → tokens/build/tokens.d.ts            (TypeScript type-safe token names)
 *
 * The three-layer bridge (V32.8 phases.md):
 *   --sd-color-*  (compiled output, read-only contract)
 *   → --color-*   (src/styles/tokens.css — consumption alias, keeps existing classes working)
 *   → Tailwind utilities (packages/ui/src/tailwind-preset.ts)
 *
 * NOTE: Requires style-dictionary@^5 to be installed.
 *   pnpm add -D style-dictionary --filter @yelli/web
 *
 * Assumptions (documented per task spec):
 *   - Using Style Dictionary v5 JavaScript API (StyleDictionary class, not v4 cli).
 *   - DTCG format: tokens use $value/$type/$description per W3C spec.
 *   - Prefix "sd" → CSS vars become --sd-color-canvas, --sd-color-surface, etc.
 *   - TypeScript output uses a simple string-union export (no token-types plugin required).
 *   - The generated CSS is an ADD, not a replace: src/styles/tokens.css continues to be
 *     the consumption layer (it will alias --color-* from --sd-color-* in a future step).
 */

/** @type {import('style-dictionary').Config} */
export default {
  source: ['tokens/**/*.json'],
  platforms: {
    // ── CSS custom properties ──────────────────────────────────────────────────
    css: {
      transformGroup: 'css',
      prefix: 'sd',
      buildPath: 'tokens/build/',
      files: [
        {
          destination: 'generated-tokens.css',
          format: 'css/variables',
          options: {
            outputReferences: false,
            selector: ':root',
          },
        },
      ],
    },
    // ── TypeScript token-name types ────────────────────────────────────────────
    ts: {
      transformGroup: 'js',
      prefix: 'sd',
      buildPath: 'tokens/build/',
      files: [
        {
          destination: 'tokens.d.ts',
          format: 'javascript/es6',
        },
      ],
    },
  },
};
