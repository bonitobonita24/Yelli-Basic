import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Vitest config for the Yelli web app. Node environment (the parity test reads
 * tokens.css from disk; router tests mock @yelli/db — no DOM needed). The `@/`
 * alias mirrors tsconfig `paths` so server/router tests can import via `@/server/...`.
 * Component tests (jsdom) land with their wiring session if required.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
