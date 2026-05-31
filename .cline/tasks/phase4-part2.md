# Phase 4 Part 2 — packages/shared + packages/api-client (Yelli)
# Fresh session. Read STATE.md first. Confirm Part 1 complete.

TASK: Generate shared TypeScript types + API client + UI loading-state primitives (Part 2 of 8).

PRE-FLIGHT:
- Read .cline/STATE.md. LAST_DONE must show Part 1 complete.
- Read inputs.yml (apps + tech_stack)
- Read docs/PRODUCT.md "Data Entities" + "API Surface" sections only
- Read .cline/memory/lessons.md (🔴 + 🟤 entries — Loading Library Lock decision is mandatory read)
- Create scaffold/part-2 branch

GENERATE:
- packages/shared/src/types/ (TypeScript interfaces for every entity from PRODUCT.md Data Entities section)
- packages/shared/src/schemas/ (Zod schemas matching the types — single source of validation truth)
- packages/api-client/ (typed tRPC client — used by web app only)

UI LOADING LIBRARIES (V31.3 ui-rules.md Rule 11 dual-path — LOCKED in DECISIONS_LOG):
- Install shadcn skeleton primitive: `npx shadcn@latest add skeleton` (added to base shadcn init in Part 5)
- Install phantom-ui: `npm i @aejkatappaja/phantom-ui` then PIN to exact resolved version in package.json
- postinstall auto-wires ssr.css into apps/yelli/app/layout.tsx — verify the import line exists
- Create src/types/phantom-ui.d.ts JSX intrinsic element declaration

EXECUTE:
- pnpm typecheck for this Part. Fix all errors.

GOVERNANCE SELF-CHECK + COMMIT:
- STATE.md rewritten. CHANGELOG entry. Commit "scaffold(shared+api-client): Part 2 of 8". Squash-merge. Delete branch.

OUTPUT:
"✅ Part 2 complete. Open phase4-part3.md in a NEW Claude Code session."

STOP HERE.
