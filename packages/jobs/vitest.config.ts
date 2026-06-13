import { defineConfig } from 'vitest/config';

/**
 * Vitest config for @yelli/jobs. Node environment; the worker payload guards
 * (_validate) are pure and need no DB/queue. Worker processors that touch
 * DB/S3/SMTP mock those deps per-test.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
