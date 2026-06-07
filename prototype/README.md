# Yelli Prototype — Phase 3.3

Client-validated interactive prototype for Yelli (V32.6 Phase 3.3). Built on
Next.js 14 App Router + Tailwind. Tokens mirror `docs/DESIGN.md` exactly.

## Run

```bash
cd prototype
npm install
npm run dev
# → http://localhost:4838
```

## Purpose

Walk every Core User Flow declared in `docs/PRODUCT.md` against a simulated
backend before Phase 4 scaffolding begins. Output: client sign-off logged to
`docs/DECISIONS_LOG.md`; behavioral blueprint in `docs/PROTOTYPE.md`.

## Simulated backend

Browser-local (`localStorage` + in-memory) module under `src/sim/` (added in
Wave 2B). Mirrors the Phase 3 schema shape exactly.

## Swap boundary

A single `sim/` interface module is replaced by real tRPC/Prisma clients at
Phase 4 Parts 5-6 (Web UI wiring). UI components are inherited unchanged.

## Status

Wave 2A — scaffold + design-token expansion only. Flow screens land in 2B+.
