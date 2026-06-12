// apps/yelli inherits the monorepo root ESLint flat config (ESLint 9).
// Next.js 16 removed the `next lint` binary (DECISIONS_LOG: "ESLint 9 flat config +
// Next.js 16 lint removal") — direct `eslint` is the lint path. React/Next plugin
// rules layer in with the component sessions; the foundation lints under root rules.
import rootConfig from '../../eslint.config.mjs';

export default rootConfig;
