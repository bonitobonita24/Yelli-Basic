import type { Config } from 'tailwindcss';

/**
 * Shared Tailwind preset for the Yelli monorepo.
 *
 * Reproduces the Phase 3.3 signed-off design system (docs/DESIGN.md +
 * prototype/tailwind.config.ts — the human-validated baseline). Output
 * Equivalence: this is REPRODUCED, not re-decided. The token VALUES live in the
 * consuming app's globals.css as CSS custom properties (the --color-* tokens,
 * plus the --duration and --ease motion tokens); this preset only maps Tailwind
 * utility names onto those vars so every workspace app shares one theme.
 *
 * Usage in an app's tailwind.config.ts:
 *   import { yelliTailwindPreset } from '@yelli/ui/tailwind-preset';
 *   export default { presets: [yelliTailwindPreset], content: [...] };
 *
 * No `content` here on purpose — the consuming app owns its content globs.
 */
export const yelliTailwindPreset = {
  theme: {
    extend: {
      colors: {
        canvas: 'var(--color-canvas)',
        surface: 'var(--color-surface)',
        'surface-elevated': 'var(--color-surface-elevated)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        primary: 'var(--color-primary)',
        'brand-pink': 'var(--color-brand-pink)',
        'brand-teal': 'var(--color-brand-teal)',
        'brand-lavender': 'var(--color-brand-lavender)',
        'brand-peach': 'var(--color-brand-peach)',
        'brand-mint': 'var(--color-brand-mint)',
        'brand-coral': 'var(--color-brand-coral)',
        success: 'var(--color-success)',
        'success-strong': 'var(--color-success-strong)',
        warning: 'var(--color-warning)',
        'warning-strong': 'var(--color-warning-strong)',
        error: 'var(--color-error)',
        'error-strong': 'var(--color-error-strong)',
      },
      borderRadius: {
        xs: '6px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        pill: '9999px',
      },
      boxShadow: {
        hairline: '0 1px 2px rgba(10, 10, 10, 0.06)',
        card: '0 2px 8px rgba(10, 10, 10, 0.08)',
        raised: '0 8px 24px rgba(10, 10, 10, 0.12)',
        modal: '0 16px 48px rgba(10, 10, 10, 0.18)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '240ms',
        slow: '400ms',
      },
      transitionTimingFunction: {
        default: 'cubic-bezier(0.4, 0, 0.2, 1)',
        emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
        exit: 'cubic-bezier(0.4, 0, 1, 1)',
      },
    },
  },
  plugins: [],
} satisfies Partial<Config>;

export default yelliTailwindPreset;
