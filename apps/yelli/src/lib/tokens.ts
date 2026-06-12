/**
 * Yelli Clay design tokens — hand-maintained TypeScript mirror of the LOCKED
 * source `src/styles/tokens.css` (`:root`). DECISIONS_LOG "Design Tokens": the
 * CSS file is the single source of truth; this mirror exists only so TS/JS code
 * can reference token names/values type-safely (charts, canvas, runtime theming).
 *
 * ⚠ EDIT BOTH TOGETHER. `tokens.parity.test.ts` parses tokens.css and asserts an
 *   exact match against this object — any drift (a value changed in one file but
 *   not the other) fails the test. Keys are the verbatim CSS custom-property names
 *   (including the leading `--`); values are the verbatim CSS values.
 */
export const tokens = {
  // Surfaces
  '--color-canvas': '#fffaf0',
  '--color-surface': '#ffffff',
  '--color-surface-elevated': '#fffdfa',

  // Text
  '--color-text-primary': '#0a0a0a',
  '--color-text-secondary': '#4a4a4a',
  '--color-text-muted': '#8a8a8a',

  // Primary + brand accents
  '--color-primary': '#0a0a0a',
  '--color-brand-pink': '#ff4d8b',
  '--color-brand-teal': '#1a3a3a',
  '--color-brand-lavender': '#b8a4e3',
  '--color-brand-peach': '#ffb084',
  '--color-brand-mint': '#a4d4c5',
  '--color-brand-coral': '#ff6b5a',

  // Semantic
  '--color-success': '#22c55e',
  '--color-success-strong': '#1b8a5a',
  '--color-warning': '#ffb084',
  '--color-warning-strong': '#c45a1f',
  '--color-error': '#ff8a80',
  '--color-error-strong': '#b3261e',

  // Motion
  '--duration-fast': '150ms',
  '--duration-base': '240ms',
  '--duration-slow': '400ms',
  '--ease-default': 'cubic-bezier(0.4, 0, 0.2, 1)',
  '--ease-emphasized': 'cubic-bezier(0.2, 0, 0, 1)',
  '--ease-exit': 'cubic-bezier(0.4, 0, 1, 1)',
} as const;

/** Verbatim CSS custom-property name (e.g. `--color-canvas`). */
export type TokenName = keyof typeof tokens;

/** Resolve a token to its `var(--name)` CSS reference for inline styles. */
export function tokenVar(name: TokenName): string {
  return `var(${name})`;
}
