import { defineConfig } from 'vitest/config';

/**
 * Minimal Vitest config for the Yelli web app. Currently scopes to the design
 * token-parity drift guard (src/lib/tokens.parity.test.ts). Node environment —
 * the parity test reads tokens.css from disk; no DOM needed. Component tests
 * (jsdom) land with the prototype→production wiring sessions if required.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
