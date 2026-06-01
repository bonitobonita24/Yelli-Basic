/**
 * JSX intrinsic element declaration for <phantom-ui> Web Component.
 * V31.3 Loading State dual-path — PATH B: bespoke/non-shadcn components.
 *
 * @aejkatappaja/phantom-ui already declares `JSX.IntrinsicElements["phantom-ui"]`
 * in its own dist/types.d.ts (global namespace). This file re-exports
 * `PhantomUiAttributes` for use in component prop types and extends the
 * `react/jsx-runtime` module namespace for the React 18 automatic JSX transform.
 */

export type { PhantomUiAttributes } from "@aejkatappaja/phantom-ui";

import type { PhantomUiAttributes } from "@aejkatappaja/phantom-ui";

declare module "react/jsx-runtime" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  export namespace JSX {
    interface IntrinsicElements {
      "phantom-ui": PhantomUiAttributes;
    }
  }
}

// Cover the legacy JSX transform and jest/vitest environments using
// react/jsx-dev-runtime.
declare module "react/jsx-dev-runtime" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  export namespace JSX {
    interface IntrinsicElements {
      "phantom-ui": PhantomUiAttributes;
    }
  }
}
