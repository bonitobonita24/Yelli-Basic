// @yelli/ui — public barrel.
// Shared UI utilities for the Yelli apps. shadcn primitives are NOT here — they
// land with the Next.js app (S4) via `npx shadcn@latest init`. This package
// ships only the cross-app primitives the app + bespoke components depend on:
// the `cn()` class merger and the Tailwind preset (the shared theme contract).

export { cn } from './lib/cn';
export { yelliTailwindPreset } from './tailwind-preset';
