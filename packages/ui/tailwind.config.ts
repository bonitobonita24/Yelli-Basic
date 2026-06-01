import type { Config } from "tailwindcss";

// Shareable Tailwind preset for Yelli monorepo apps.
// Apps extend this via `presets: [require("@yelli/ui/tailwind-preset")]`.
// Clay design tokens live in the consuming app's src/styles/tokens.css
// (single source of truth per DECISIONS_LOG.md "LOCKED: Design Tokens").
// This preset maps Tailwind utilities to the CSS variables that tokens.css declares.
const preset = {
  darkMode: ["class"],
  content: [],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        clay: {
          pink: "hsl(var(--clay-pink))",
          teal: "hsl(var(--clay-teal))",
          lavender: "hsl(var(--clay-lavender))",
          peach: "hsl(var(--clay-peach))",
          ochre: "hsl(var(--clay-ochre))",
          mint: "hsl(var(--clay-mint))",
        },
      },
      borderRadius: {
        lg: "var(--radius-card)",
        md: "var(--radius-button)",
        sm: "calc(var(--radius-button) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        tight: "-0.02em",
      },
    },
  },
} satisfies Config;

export default preset;
