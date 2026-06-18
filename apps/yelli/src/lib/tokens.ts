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
  // V32.8 additions — missing surface tier restored from DESIGN.md
  '--color-surface-soft': '#faf5e8',
  '--color-surface-card': '#f5f0e0',
  '--color-surface-strong': '#ebe6d6',
  '--color-surface-dark': '#0a1a1a',
  '--color-surface-dark-elevated': '#1a2a2a',

  // Text
  '--color-text-primary': '#0a0a0a',
  '--color-text-secondary': '#4a4a4a',
  '--color-text-muted': '#8a8a8a',

  // Primary + brand accents
  '--color-primary': '#0a0a0a',
  // V32.8 additions — primary state tokens
  '--color-primary-active': '#1f1f1f',
  '--color-primary-disabled': '#e5e5e5',
  '--color-brand-pink': '#ff4d8b',
  '--color-brand-teal': '#1a3a3a',
  '--color-brand-lavender': '#b8a4ed',   // FIXED: was #b8a4e3 (off-by-1-byte)
  '--color-brand-peach': '#ffb084',
  '--color-brand-ochre': '#e8b94a',      // RESTORED: was absent
  '--color-brand-mint': '#a4d4c5',
  '--color-brand-coral': '#ff6b5a',
  '--color-hairline': '#e5e5e5',         // V32.8 addition — named border token

  // Semantic
  '--color-success': '#22c55e',
  '--color-success-strong': '#15803d',   // FIXED: was #1b8a5a
  '--color-warning': '#f59e0b',          // FIXED: was #ffb084 (semantic collision with brand-peach)
  '--color-warning-strong': '#c45a1f',
  '--color-error': '#ef4444',            // FIXED: was #ff8a80 (salmon → spec'd red)
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
