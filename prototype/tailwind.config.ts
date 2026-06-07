import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
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
};

export default config;
