# Lessons Memory — Yelli Spec-Driven Platform V31
# Entry format: ## YYYY-MM-DD — [ICON] [Title]
# Types: 🔴 gotcha | 🟡 fix | 🟤 decision | ⚖️ trade-off | 🟢 change
# READ ORDER: 🔴 first → 🟤 second → rest by relevance
# ---

## 2026-06-01 — ⚖️ trade-off tRPC v11 generic transformer constraint vs concrete router type
- Type:      ⚖️ trade-off
- Phase:     Phase 4 Part 2 D3-fix
- Files:     packages/api-client/src/index.ts
- Concepts:  trpc-v11, generic-constraints, TransformerOptions, AnyRouter, @ts-expect-error
- Narrative: tRPC v11's httpBatchLink<TRouter> requires TransformerOptions resolved from
  TRouter["_def"]["_config"]["$types"]. Under an unbound generic (TRouter extends AnyRouter),
  TypeScript cannot resolve this — typecheck errors. Three attempts considered:
  A) Explicit TRouter generic to httpBatchLink — still errors.
  B) Conditional spread of optional headers — still errors.
  C) Single @ts-expect-error with rationale — chosen.
  Why @ts-expect-error and NOT `as any`: @ts-expect-error errors out the moment the
  underlying issue is resolved (i.e. when a concrete AppRouter is passed in Part 5).
  `as any` silently hides the issue forever. Rule 12 (no any) + Rule 25 Stage 2 satisfied.
  Cost: one suppressed line in api-client factory. Benefit: clean generic surface for
  consumers; concrete typing automatic at apps/yelli call site.
  Revisit: Part 5 should add a typed `createTrpcClient(): CreateTRPCClient<AppRouter>`
  wrapper in apps/yelli that calls createYelliTrpcClient<AppRouter>(...) — at that point
  verify the @ts-expect-error is still triggering. If concrete usage type-checks cleanly,
  the suppression is doing its job.

## 2026-06-01 — 🟤 Yelli brownfield: PRODUCT.md target stack wins over Path A memory
- Type:      🟤 decision
- Phase:     Prompt 1.5.4 brownfield Adoption-mode Bootstrap
- Files:     docs/PRODUCT.md, inputs.yml, docs/DECISIONS_LOG.md, ~/.claude/projects/.../memory/MEMORY.md
- Concepts:  brownfield, stack-truth, Rule 28 priority, migration
- Narrative: Memory note `project_yelli_brownfield_migration.md` (2026-05-30) declared
  Yelli-Basic permanently locked on vanilla Node + ws stack (Path A). PRODUCT.md
  finalized 2026-05-31 (Step 9 lock) declares target stack as Next.js + tRPC + Prisma
  + Auth.js v5 + PostgreSQL + Valkey + MinIO with `migration.brownfield: true` and
  explicit instruction "Phase 4 Part 1 must rewrite the signaling layer rather than
  retrofit the framework around the existing code." Per Rule 28 (Global Priority
  Order), PRODUCT.md (priority 4) outranks memory/user-context (priority 8). User
  confirmed via AskUserQuestion 2026-06-01: PRODUCT.md wins. Existing vanilla
  server.js + public/index.html retained as visual + behavioural reference for
  Phase 4 Part 1 rewrite, not as the destination stack.

## 2026-06-01 — 🟤 Zero Opus Execution operating mode (V32 R1)
- Type:      🟤 decision
- Phase:     1.5.4 governance scaffold
- Files:     .claude/rules/memory-governance.md
- Concepts:  V32, Architect-Execute, Opus, Sonnet, dispatch model
- Narrative: All file writes during 1.5.4 dispatched to Sonnet via Agent(model: "sonnet")
  per V32 R1. Opus drafted exact content; Sonnet wrote mechanically (3 dispatches:
  governance docs / spec files / runtime state). Only Opus write was .cline/STATE.md
  (the R1 exception). This pattern continues for all subsequent phases.

## 2026-06-01 — 🟤 decision Loading state library dual-path (V31.3)
- Type:       🟤 decision
- Phase:     Bootstrap Step 19 retrofit
- Files:     docs/DECISIONS_LOG.md (L97-98), .claude/rules/ui-rules.md (Rule 11)
- Concepts:  loading-state, skeleton, phantom-ui, shadcn, ui-rules.Rule-11, dual-path
- Narrative: V31.3 locks loading states to dual-path. PATH A — shadcn `<Skeleton>` for shadcn-composed UI (Card, Table, Form, Dialog, Tabs, Sheet, Avatar). PATH B — `@aejkatappaja/phantom-ui` (MIT Lit Web Component, ~8KB gzip) for bespoke/custom UI. NEVER hand-roll a `*Skeleton.tsx` twin file — if tempted, use phantom-ui per PATH B. Phase 4 Part 2 installs both libraries and picks correct path per component using Phase 2.8 mockup classification tags. Initial install accepts ^0.10.1; pin to exact resolved version in package.json after install. phantom-ui requires "use client" boundary (browser DOM measurement). JSX intrinsic element declaration mandatory: src/types/phantom-ui.d.ts.

## 2026-06-01 — 🟤 decision Platform tenant slug = `_pwbt`

- Type:      🟤 decision
- Phase:     Phase 4 Part 3
- Files:     packages/db/prisma/seed.ts, packages/shared/src/config/reserved-slugs.ts
- Concepts:  super-admin, platform-tenant, webmaster, reserved-slugs, multi-tenant
- Narrative: Webmaster needs a tenant home (User.tenantId is NOT NULL). Chose `_pwbt` from the 18 reserved slugs — clearly Powerbyte-internal, underscore-prefixed system tenant, can never be claimed by signup. Phase 5 tRPC super-admin middleware identifies platform admin via `tenant.slug === "_pwbt"`. No `User.isPlatformAdmin` boolean was added — kept Part 2 TS types untouched as locked source of truth.

## 2026-06-01 — 🔴 gotcha Prisma schema must match Part 2 TS types — caught AuditLog.targetId nullability mismatch

- Type:      🔴 gotcha
- Phase:     Phase 4 Part 3 (D2-fix dispatch)
- Files:     packages/db/prisma/schema.prisma, packages/db/src/audit.ts, packages/db/prisma/migrations/0001_init/migration.sql
- Concepts:  source-of-truth, schema-types-sync, audit-log, nullability, hidden-data-bug
- Narrative: D2 initially scaffolded `AuditLog.targetId` as NOT NULL String in Prisma; Part 2 TS type had `targetId: string | null`. Without fix, audit.ts silently converted null → empty string via `?? ""` — a quiet data integrity bug that would corrupt rows for actions with no specific target (auth.login.success, pwa.install). D2-fix realigned the schema (added `?`), regenerated the migration column, removed the workaround. RULE established: Part 2 TS types are the locked source of truth for Prisma schema field shapes. Any Part 3+ mismatch found mid-execution: fix the schema, not the TS type.

## 2026-06-01 — 🟢 change `User.securityVersion` deferred to Phase 5

- Type:      🟢 change
- Phase:     Phase 4 Part 3 (deferred to Phase 5)
- Files:     packages/db/prisma/schema.prisma, packages/shared/src/types/user.ts (both to be updated in Phase 5)
- Concepts:  auth-session-invalidation, security-version, deferred-scope, source-of-truth
- Narrative: security.md "Auth Defaults item 6" mandates a `securityVersion: Int @default(0)` field on User for force-invalidating sessions on role/tenant/status change. Part 2 TS types don't have it; adding it in Part 3 would either violate locked source-of-truth chain or require a synchronized Part 2 retrofit mid-Part-3. Deferred to Phase 5 (Auth.js wiring) where the field will be added with full Feature Update governance: shared TS type update → Prisma schema update → new migration → Auth.js session callback wiring. Documented here so Phase 5 reviewer catches the gap.

## 2026-06-01 — ⚖️ trade-off tsconfig `rootDir` widened to `"."` for seed.ts compilation

- Type:      ⚖️ trade-off
- Phase:     Phase 4 Part 3 (D3 dispatch)
- Files:     packages/db/tsconfig.json
- Concepts:  tsconfig, rootDir, monorepo, seed-script, framework-convention
- Narrative: `prisma/seed.ts` lives outside src/. Default `rootDir="./src"` rejected it with TS6059 (file not under rootDir). Widened rootDir to `"."` so seed.ts compiles. outDir is ./dist so compiled output goes to dist/src/* + dist/prisma/* — acceptable since no app depends on @yelli/db's compiled output (workspace consumers use the .ts source directly via `workspace:*` exports `main: ./src/index.ts`). Alternative was moving seed.ts into src/, but framework convention places seed alongside schema.prisma in prisma/. Chose convention over rootDir purity.
