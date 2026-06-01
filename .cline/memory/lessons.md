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

## 2026-06-01 — 🔴 gotcha L6 tenant-guard data-branch spread order silently bypassed isolation

- Type:      🔴 gotcha
- Phase:     Phase 4 Part 3 (security fix on commit 96920d0)
- Files:     packages/db/src/middleware/tenant-guard.ts
- Concepts:  L6, tenant-isolation, spread-order, multi-tenant-bypass, security-review
- Narrative: Initial L6 tenant-guard had `a.data = { tenantId, ...a.data }` in the create/createMany branch — injected tenantId came FIRST, then caller's spread OVERRODE it. A caller passing `data: { tenantId: "victim", ... }` would silently write into the wrong tenant, defeating L6's entire purpose. The where-clause branch was already correct (`{ ...a.where, tenantId }` — injected last wins). Caught by automated security review on the squash-merge commit. Fix: reverse spread order on both data branches (object + array of rows) so `tenantId` always comes LAST, AND throw on any caller-supplied tenantId mismatch (both data and where) — silent override would mask attempted L6 violations and hide caller bugs. RULE: when injecting an authoritative value via object spread, the authoritative value MUST come last. Mismatches should throw, not silently override.

## 2026-06-01 — 🟤 decision ioredis 5.10.1 exact pin via pnpm.overrides
- Type:      🟤 decision
- Phase:     Phase 4 Part 4 D2
- Files:     package.json (root), packages/jobs/package.json
- Concepts:  pnpm-overrides, dedupe, bullmq, ioredis, exactOptionalPropertyTypes, monorepo
- Narrative: bullmq@5.77.7 bundles ioredis@5.10.1 as a hard dep. Declaring "ioredis: ^5.4.2" in @yelli/jobs pulled a parallel ioredis instance, and TS strict + exactOptionalPropertyTypes caught that the two ioredis instances exported structurally-different Redis types — typecheck failed. Fix: pin @yelli/jobs ioredis dep to exact "5.10.1" AND add pnpm.overrides.ioredis = "5.10.1" at root so every transitive consumer resolves to the same instance. RULE: when a primary dep bundles a sub-dep with a hard version, mirror that exact version in any sibling that also imports the sub-dep, and pin via pnpm.overrides to force monorepo-wide singleton resolution.

## 2026-06-01 — 🟤 decision SVG branding upload deferred to Phase 5/7
- Type:      🟤 decision
- Phase:     Phase 4 Part 4 D4
- Files:     packages/storage/src/validate.ts, docs/DECISIONS_LOG.md
- Concepts:  file-upload, mime-whitelist, svg, xss, security.md-rule-6, dompurify
- Narrative: PRODUCT.md / task file mentioned PNG/JPG/SVG for branding uploads. security.md File Upload Safety rule 6 says "SVG and HTML uploads are BLOCKED by default — they can contain embedded JavaScript (XSS vector)." Per H1 priority order, .claude/rules/ (P3) outranks PRODUCT.md (P4) on safety. Chose to ship PNG/JPG only in the scaffold and explicitly defer SVG to Phase 5/7 with DOMPurify wiring. Magic-byte check on every upload regardless of declared MIME. Re-enable path documented in DECISIONS_LOG so a Phase 7 Feature Update can pick it up without re-deriving the threat model.

## 2026-06-01 — ⚖️ trade-off Tailwind 3.4 in packages/ui (Tailwind 4 deferred)
- Type:      ⚖️ trade-off
- Phase:     Phase 4 Part 4 D1
- Files:     packages/ui/package.json, packages/ui/tailwind.config.ts
- Concepts:  tailwind, tailwind-3-vs-4, css-first, shadcn-compatibility, monorepo-preset
- Narrative: packages/ui ships a shareable Tailwind preset (config.ts export). Tailwind 4 (CSS-first via @theme directive) and Tailwind 3 (JS preset) coexist in shadcn docs but the JS preset path is more stable for monorepo consumption across apps that haven't migrated yet. Chose Tailwind 3.4.17 for Part 4. Cost: future migration to Tailwind 4 will require swapping the preset pattern. Benefit: zero risk on first scaffold; Phase 7 Feature Update can bump cleanly when shadcn + downstream apps are all 4-ready.

## 2026-06-01 — 🟢 change packages/jobs worker boot pattern (factory + runtime)
- Type:      🟢 change
- Phase:     Phase 4 Part 4 D3
- Files:     packages/jobs/src/workers/*.worker.ts, packages/jobs/src/workers/index.ts
- Concepts:  bullmq-worker, graceful-shutdown, sigterm, factory-pattern, deploy
- Narrative: Every worker file exports a `create{Name}Worker()` factory that returns the Worker instance. `startAllWorkers()` invokes every factory, attaches `failed`/`completed` listeners (structured JSON log), and returns `{ workers, shutdown }`. `main()` wires SIGTERM + SIGINT to call `shutdown()` then `process.exit(0)`. Entry point auto-detect via `import.meta.url`. Deploy: Phase 4 Part 7 compose runs `node dist/workers/index.js`. Why factory+runtime rather than top-level side-effects: avoids workers starting at import time (would break test harness in Phase 5 + complicates partial worker startup if a future deploy splits queues across multiple containers).

## 2026-06-02 — 🔴 gotcha Workspace-package `.js` extension imports break Next.js bundler

- Type:      🔴 gotcha
- Phase:     Phase 4 Part 5 D14
- Files:     packages/shared/src/index.ts + sub-barrels, packages/storage/src/index.ts, packages/jobs/src/index.ts + workers
- Concepts:  workspace-package, .js-extension, moduleResolution-bundler, Next.js-webpack, Turbopack, transpilePackages
- Narrative: Parts 2/3/4 used `from "./xyz.js"` extension-style imports in workspace barrels — TypeScript accepts them with moduleResolution=bundler (rewrites .js→.ts at compile time). Next.js 16 webpack/Turbopack does NOT accept the same form even with `transpilePackages` configured — build fails with "Module not found: Can't resolve './xyz.js'" on every workspace import. RULE: in pnpm workspace packages with `main: ./src/index.ts` (consumed as source), use extension-less imports `from "./xyz"`. Universal across TypeScript bundler resolution, webpack, Turbopack, esbuild, and Vite. The locked decision in DECISIONS_LOG ("Workspace barrel imports — no .js extension") formalizes this.

## 2026-06-02 — 🔴 gotcha tRPC v11 reserves `call` as a router key

- Type:      🔴 gotcha
- Phase:     Phase 4 Part 5 D14
- Files:     apps/yelli/src/server/trpc/root.ts
- Concepts:  trpc-v11, router-keys, reserved-words, runtime-error
- Narrative: `router({ call: callRouter, ... })` throws at app load with "Reserved words used in `router({})` call: call" — tRPC v11 reserves several keys that collide with its internal Router method names (call, query, mutation, subscription, createCaller, ...). Typecheck doesn't catch it (it's a runtime throw in the router() factory). RULE: prefer plural / qualified router keys (`calls`, `callSessions`) when the singular form might collide. Other singular keys (tenant/user/device/branding/audit/platform) pass.

## 2026-06-02 — 🟤 decision Auth.js v5 without PrismaAdapter (Credentials + JWT only)

- Type:      🟤 decision
- Phase:     Phase 4 Part 5 D5a
- Files:     apps/yelli/src/server/auth/config.ts
- Concepts:  authjs-v5, prisma-adapter, jwt-strategy, peer-dependency-conflict
- Narrative: @auth/prisma-adapter ^2.7.0 + next-auth 5.0.0-beta.22 each pull a different @auth/core range → two copies in node_modules → type errors at the PrismaAdapter() call site. Dropped the adapter; JWT-only Credentials provider works without it. The session() callback already DB-validates User.securityVersion + isSuspended on every lookup → V28 session-invalidation guarantee preserved. Re-add the adapter in Phase 7 when adding magic-link / email-link providers (they need DB-backed verification tokens).

## 2026-06-02 — 🟤 decision exactOptionalPropertyTypes localized override for apps/yelli

- Type:      🟤 decision
- Phase:     Phase 4 Part 5 D4-fix
- Files:     apps/yelli/tsconfig.json
- Concepts:  typescript-strict, exact-optional-property-types, radix-ui, shadcn
- Narrative: Radix UI v1 component types fail under the root `exactOptionalPropertyTypes: true` (component props with optional fields use `undefined` rather than omission). Localized override in apps/yelli/tsconfig.json — packages/* keep the strict setting. Trade-off: app code loses one strict guarantee (optional props accept undefined); shared types layer keeps it. Revisit when Radix UI ships a strict-compatible release.

## 2026-06-02 — ⚖️ trade-off tRPC v11 RC @ts-expect-error still active even with concrete AppRouter

- Type:      ⚖️ trade-off
- Phase:     Phase 4 Part 5 D9
- Files:     packages/api-client/src/index.ts, apps/yelli/src/lib/trpc-client.ts
- Concepts:  trpc-v11-rc, ts-expect-error, transformer-options, deferred-cleanup
- Narrative: The "tRPC v11 generic transformer constraint" trade-off entry (2026-06-01) predicted the @ts-expect-error in @yelli/api-client would self-report as no-longer-needed (TS6133 "unused expect-error") when consumed with concrete AppRouter. Reality: tRPC v11 0.0.0-rc.660 has a related constraint at the makeTrpcClient call site that still requires a similar suppression. The original @ts-expect-error stays active AND apps/yelli also carries one. Both come out when tRPC v11 ships stable. Tracking: re-check on every tRPC bump.

## 2026-06-02 — 🟢 change User.securityVersion landed (Phase 4 Part 5)

- Type:      🟢 change
- Phase:     Phase 4 Part 5 D4
- Files:     packages/shared/src/types/user.ts, packages/db/prisma/schema.prisma, packages/db/prisma/migrations/0002_user_security_version/migration.sql
- Concepts:  security-version, session-invalidation, prisma-migration, deferred-from-part-3
- Narrative: The 🟢 deferral from Part 3 ("User.securityVersion deferred to Phase 5") is now closed. Field added to packages/shared (TS source-of-truth first), then mirrored in Prisma schema, then a SQL migration (0002_user_security_version) was hand-written because no live DB was running during scaffold (`prisma migrate dev` would attempt to apply). `prisma generate` confirmed clean. Auth.js session() callback reads it and blanks session.user on mismatch. Phase 7 adds the 30s Valkey cache to avoid the DB hit on every request.

## 2026-06-02 — 🟤 decision Next.js 16 proxy.ts convention (V25 anti-tenant-switching)

- Type:      🟤 decision
- Phase:     Phase 4 Part 5 D10
- Files:     apps/yelli/src/proxy.ts
- Concepts:  nextjs-16, middleware, proxy.ts, v25-anti-tenant-switching
- Narrative: Next.js 16 renamed the `middleware.ts` convention to `proxy.ts` (proxy() + proxyConfig exports). Same matcher syntax. V25 logic — extract subdomain from Host, decode JWT via getToken (Edge-safe, no DB), compare against jwt.tenantSlug, redirect mismatched-tenant browsers — lives in apps/yelli/src/proxy.ts. RUNTIME VERIFICATION REQUIRED at Phase 6: confirm Komodo + Cloudflare Tunnel deployment actually triggers proxy.ts on incoming requests. If Next.js 16 deploys treat proxy.ts differently from middleware.ts the V25 enforcement becomes dead code.
