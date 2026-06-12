// Root ESLint flat config (ESLint 9) — base rules for the monorepo.
// App-specific configs (e.g. eslint-config-next in apps/yelli) extend from here
// in their own eslint.config.mjs. Rule 12: TypeScript strict, no `any`.
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      'prototype/**',
      'mockup-server/**',
      'deploy/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
