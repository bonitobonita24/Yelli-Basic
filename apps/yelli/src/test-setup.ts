import '@testing-library/jest-dom/vitest';

/**
 * Global test setup. Registers @testing-library/jest-dom matchers (toBeInTheDocument,
 * toBeDisabled, …) with vitest's expect for ALL tests. Harmless in the node-env
 * unit/router tests; required by the jsdom component tests (which opt in per-file via
 * `// @vitest-environment jsdom`). RTL auto-cleanup is registered per component-test file.
 */
