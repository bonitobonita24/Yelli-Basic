import type { Config } from 'tailwindcss';
import { yelliTailwindPreset } from '@yelli/ui/tailwind-preset';

/**
 * Yelli web app Tailwind config.
 *
 * - `presets: [yelliTailwindPreset]` brings the Phase 3.3 signed-off Clay design
 *   tokens (canvas / surface / brand-* / text-* / semantic + radii + shadow +
 *   motion) — the human-validated baseline, reproduced not re-decided.
 * - `theme.extend.colors` adds the shadcn/ui semantic color names (background,
 *   foreground, primary, border, ring, …) which resolve to CSS vars defined in
 *   globals.css — those vars are mapped FROM the Clay tokens (DECISIONS_LOG
 *   "Design Tokens": one token source, globals maps shadcn vars FROM it).
 */
const config: Config = {
  darkMode: ['class'],
  presets: [yelliTailwindPreset],
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
      },
    },
  },
  plugins: [],
};

export default config;
