# Project State — Yelli
# Auto-generated. Never edit manually.

## Current State — Clean-Slate Scaffold (swarm/rebuild · S4a-1 complete, 2026-06-12)

PHASE:        **Phase 4 — Clean-Slate Scaffold-then-Wire rebuild** (driven by the swarm session plan
              on branch `swarm/rebuild`). S0 (re-baseline) + S1 (Parts 1–2 scaffold) + S2 (Part 3:
              packages/db Prisma schema + L2/L5/L6 + migration 0001) + S3 (Part 4: packages/ui +
              packages/jobs) + **S4a-1 (Part 5, app FOUNDATION: apps/yelli Next.js 16 shell + LOCKED
              design-token plumbing — NO primitives/auth/tRPC yet)** are complete.

              ⚠ S4 IS NOT COMPLETE. S4 (apps/yelli) was AT_RISK and, on filesystem-grounded re-scope,
              exceeds the ≤12-file / ≤500-line single-session budget by ~2× even for the approved S4a
              half. It is split into THREE within-budget sessions: S4a-1 (app foundation — DONE this
              session), S4a-2 (17 shadcn primitives + tokens.ts mirror + Vitest token-parity test),
              S4b (Auth.js v5 + tRPC v11 skeleton + proxy.ts + env.ts). See NEXT.

              ⚠ PLAN CORRECTION (S0): The prior STATE.md falsely claimed "Phase 3.5 COMPLETE · Parts 1–8
              already BUILT in May 2026 V31 adoption — actual remaining work is the prototype→production
              wiring." That premise was INVALID. The V32.6.1 clean-slate wipe (2026-06-07, commit `0a94f48`)
              removed `apps/` and `packages/` from the filesystem. They do NOT exist on `swarm/rebuild`
              or `main` (the old scaffold survives only in git history on `scaffold/part-3`).
              IMPLEMENTATION_MAP.md is authoritative: "Filesystem: clean-slate. No apps/, packages/."
              The Phase 3.5 execution plan (`.cline/tasks/execution-plan.md`) was written against the
              false brownfield assumption and is therefore SUPERSEDED by the swarm scaffold-then-wire plan.

FILESYSTEM REALITY (verified this session):
  PRESENT:  docs/ (PRODUCT.md + 9 governance docs), prototype/ (Phase 3.3 sim layer, 9/9 flows signed off),
            deploy/, mockup-server/, inputs.yml, inputs.schema.json, 4 env files, CREDENTIALS.md,
            .gitignore, .mcp.json, .vscode/mcp.json, .cline/ (memory + tasks), scripts/, CLAUDE.md.
            NEW (S1): package.json + pnpm-workspace.yaml (catalog) + turbo.json + tsconfig.base.json +
            eslint.config.mjs + .prettierrc/.prettierignore/.editorconfig + .nvmrc + pnpm-lock.yaml +
            node_modules/ + packages/shared/ (@yelli/shared — types + Zod + reserved-slugs + audit vocab).
            ⇒ `pnpm install|typecheck|lint` now run green. `pnpm build|test` are no-ops until a package
              defines those tasks (shared is source-exported; tests land later).
            NEW (S2): packages/db/ (@yelli/db) — Prisma schema (8 domain + 3 Auth.js models, 5 enums),
            migration 0001_init (DDL + L2 RLS), L5 writeAuditLog, L6 $allOperations tenant-guard, L2
            withTenant/setTenantContext, base PrismaClient singleton. pnpm-lock.yaml +prisma 5.22.0.
            ⇒ `prisma generate` (pnpm --filter @yelli/db db:generate) MUST precede typecheck on a fresh clone.
            NEW (S3): packages/ui/ (@yelli/ui) — `cn()` (clsx + tailwind-merge) + `yelliTailwindPreset`
            (reproduces the Phase 3.3 signed-off design tokens from prototype/tailwind.config.ts; no shadcn
            primitives yet — those land with the app in S4). packages/jobs/ (@yelli/jobs) — 6 BullMQ queue
            DEFINITIONS (QUEUE_NAMES + typed payloads + JobDataMap + createQueue factory) + ioredis
            connection factory + workers/_validate.ts (assertTenantUser / assertSystemJob / log — LOCKED
            guard convention) + 6 worker STUBS (guard-wired, body = TODO + throw NotImplemented). Root
            package.json gains `pnpm.overrides.ioredis = "5.10.1"` (LOCKED pin; verified single-instance).
            ⇒ `pnpm typecheck|lint` run green (4/4 pkgs). Worker bodies + Queue/Worker/cron bootstrap land
              in the BullMQ-wiring session. ExportJob export_jobs table from S2 was KEPT (durable row needed
              for the 1/tenant/24h rate-limit + AuditLog correlation — S2 REVIEW NOTE resolved).
            NEW (S4a-1): apps/yelli/ (@yelli/web) — Next.js 16 App Router FOUNDATION only. 12 files:
            package.json (next ^16, react 19, tailwind ^3.4.10, dev/start on :46848), next.config.ts
            (6 security headers — Permissions-Policy ALLOWS self camera+mic for WebRTC + standalone +
            transpilePackages ['@yelli/ui']), tsconfig.json (exactOptionalPropertyTypes:false per DL:176),
            eslint.config.mjs (re-exports root; direct `eslint`), postcss.config.mjs, tailwind.config.ts
            (yelliTailwindPreset + shadcn semantic colors), components.json (v3-mode for shadcn CLI),
            src/styles/tokens.css (LOCKED Clay token source, verbatim from prototype), src/app/globals.css
            (shadcn vars mapped FROM Clay tokens), src/lib/utils.ts (re-export cn), src/app/layout.tsx +
            page.tsx (placeholder). ⇒ `next build` ✓ (Next 16.2.9 Turbopack, TS pass, 3 static pages);
            typecheck/lint/prettier ✓. next-env.d.ts gitignored (auto-generated).
  ABSENT:   apps/yelli shadcn primitives + auth + tRPC (S4a-2/S4b — see NEXT); packages/storage , tools/.
            ⇒ `pnpm tools:validate-inputs` not wired yet (tools/ lands in S5).
              packages/storage (branding-upload MIME validate.ts — LOCKED PNG/JPEG whitelist) lands later.

LAST_DONE (S4a-1 — Scaffold Part 5, app FOUNDATION: apps/yelli Next.js 16 shell + design tokens):
  - **apps/yelli (@yelli/web)** — Next.js 16 App Router foundation, 12 files, NO primitives/auth/tRPC.
    Stack locks honored: Next 16.2.9 + React 19; Tailwind v3 (^3.4.10, NOT v4); ESLint 9 flat (direct
    `eslint`, Next 16 removed `next lint`); tsconfig exactOptionalPropertyTypes:false (DL:176, Radix v1);
    transpilePackages ['@yelli/ui']; output 'standalone' (Docker). next.config Permissions-Policy ALLOWS
    self camera+microphone (WebRTC calling app — blocking breaks getUserMedia).
  - **LOCKED design-token plumbing reproduced (Output Equivalence)** — src/styles/tokens.css = the single
    Clay token source (DL "Design Tokens"), carried forward VERBATIM from the Phase 3.3 signed-off
    prototype. globals.css maps shadcn --background/--foreground/--primary/--border/--ring/etc FROM those
    Clay vars. tailwind.config consumes @yelli/ui `yelliTailwindPreset` (S3) + adds shadcn semantic colors.
  - **Validation green** — `next build` ✓ (Turbopack, TS pass, 3 static pages); typecheck ✓ (0 errors);
    lint ✓ (0 problems); prettier --check ✓ on authored app files. next-env.d.ts gitignored.
  - **CHANGELOG_AI.md appended** — full S4a-1 entry (Rule 15; remainder + shadcn-v3 decision documented).
  - **Why partial:** S4 is AT_RISK and >2× the per-session budget; per pre-flight rule 3 / memory-governance
    §1 this session ships only the within-budget foundation. Remainder escalated (status=blocked) →
    dispatch S4a-2 (primitives) then S4b (auth+tRPC) as separate workers. See NEXT + BLOCKERS.

LAST_DONE (S3 — Scaffold Part 4: packages/ui + packages/jobs):
  - **packages/ui (@yelli/ui)** — shared UI utility layer (NO shadcn primitives — those land with the app S4):
      • src/lib/cn.ts — canonical shadcn `cn()` (clsx + tailwind-merge).
      • src/tailwind-preset.ts — `yelliTailwindPreset` (`satisfies Partial<Config>`) reproducing the Phase 3.3
        signed-off design tokens VERBATIM from prototype/tailwind.config.ts (colors→CSS vars, borderRadius,
        boxShadow, transition duration/timing). No `content` (app owns globs). Output Equivalence: reproduced,
        keeps design-review GREEN. Deps: clsx + tailwind-merge + tailwindcss ^3.4.10 (dev; v3 line, not v4).
  - **packages/jobs (@yelli/jobs)** — BullMQ job DEFINITIONS layer (definitions + stubs; no running Workers):
      • src/queues.ts — 6 queue DEFINITIONS (QUEUE_NAMES verbatim from inputs.yml: device-archive, tenant-export,
        soft-delete-cron, backup, email, logo-image) + typed payloads (BaseJobData + 6 specializations) + static
        JobDataMap + `createQueue<N>(name, connection, opts)` factory (connection INJECTED — no eager Redis).
      • src/connection.ts — `createRedisConnection()` (ioredis; defaults BullMQ `maxRetriesPerRequest: null`).
      • src/workers/_validate.ts — LOCKED guard convention: `assertTenantUser` (top of every processor),
        `assertSystemJob` (LOCKED backup exception: '_pwbt'/'system'), shared structured-JSON `log()`.
      • 6 worker STUBS — guard-wired + log + `throw NotImplemented` + TODO(wiring session) per LOCKED behavior.
      • Deps: bullmq ^5.77.7 + ioredis 5.10.1 (EXACT — LOCKED pin). Root package.json + `pnpm.overrides.ioredis`.
  - **ExportJob REVIEW NOTE (from S2) resolved** — KEPT the export_jobs table (durable row required for the
    1/tenant/24h rate-limit + tenant.export.* AuditLog correlation; BullMQ state is ephemeral). Not dropped.
  - **Validation green** — typecheck ✓ (4/4, 0 errors); lint ✓ (4/4, 0 problems); build/test no-op exit 0;
    prettier --check ✓ on all S3 files; ioredis verified single-instance 5.10.1. 1 self-caught JSDoc `*/` bug fixed.
  - **CHANGELOG_AI.md appended** — full S3 entry (Rule 15 attribution; ExportJob resolution + deviations documented).

LAST_DONE (S2 — Scaffold Part 3: packages/db — Prisma schema + L2/L5/L6 + migration 0001):
  - **packages/db (@yelli/db)** — reproduced the LOCKED Phase-4-Part-3 contract from the wiped scaffold
    (git `96920d0`), adapted to S1's `@yelli/shared` barrel:
      • prisma/schema.prisma — 8 domain models (Tenant, User, Device, Invitation, AuditLog, CallSession,
        WebPushSubscription, ExportJob) + 3 Auth.js (Account, Session, VerificationToken) + 5 enums
        (Role, CallRole, AuditTargetType, EndReason, ExportJobStatus). 1:1 with @yelli/shared entities.ts.
      • prisma/migrations/0001_init — migration.sql (full DDL + L2 RLS ENABLE + tenant_isolation policies)
        + down.sql + migration_lock.toml.
      • src/audit.ts (L5 writeAuditLog), src/rls.ts (L2 withTenant/setTenantContext), src/middleware/
        tenant-guard.ts (L6 $allOperations extension; excludes Tenant/AuditLog/Account/Session/
        VerificationToken), src/index.ts (base unguarded PrismaClient singleton).
  - **Scope additions / rule-backed deviations** (Output Equivalence preserved, all documented in CHANGELOG):
      • +User.securityVersion Int @default(0) (LOCKED decision + security.md §AUTH #6 — folded into 0001).
      • CallSession.endedAt + endReason → nullable to match S1 entities.ts (LOCKED "Part-2 TS is source of
        truth; fix the schema").
      • +ExportJob model/enum/table (the wiped scaffold never materialized it; added to satisfy the explicit
        "8 domain models" scope + entities.ts. REVIEW NOTE: if export state is BullMQ/Valkey-only, S3 may drop
        the table — additive + isolated.).
      • entities.ts synced (2 edits: +User.securityVersion, AuditLog.targetId → string|null).
  - **Validation green** — typecheck ✓ (2/2 pkgs, 0 errors); lint ✓ (2/2, 0 problems); build/test no-op exit 0;
    prisma validate ✓; prisma generate ✓ (client v5.22.0); prettier --check ✓ on all S2 code files.
    (Repo-wide format:check fails on 44 PRE-EXISTING files — docs/, inputs.yml, README.md — untouched by S2.)
  - **CHANGELOG_AI.md appended** — full S2 entry (Rule 15 attribution; deviations + deferrals documented).
  - **Deferred (not in S2 literal scope):** prisma/seed.ts (needs CREDENTIALS + live DB + argon2 native build).

LAST_DONE (S1 — Scaffold Parts 1–2: root config + packages/shared):
  - **Root monorepo config** — package.json (pnpm@10.33.2, turbo-delegating scripts), pnpm-workspace.yaml
    (apps/* + packages/* + pnpm `catalog:` — phantom-ui 0.10.1 EXACT [Loading Library Lock], zod, typescript),
    turbo.json (turbo 2.x `tasks`), tsconfig.base.json (strict + noUncheckedIndexedAccess +
    exactOptionalPropertyTypes — Rule 12), eslint.config.mjs (ESLint 9 flat; no-explicit-any: error),
    .prettierrc/.prettierignore/.editorconfig, .nvmrc=22.
  - **packages/shared (@yelli/shared)** — source-exported type + validation contract for all downstream sessions:
      • enums.ts (Edition, CallRole, UserRole, CallEndReason, ExportJobStatus, AuditTargetType — tuple+union).
      • audit.ts — AUDIT_ACTIONS (§11-canonical, 29 actions) verbatim from docs/PROTOTYPE.md §3 (the signed-off
        lock; NOT PRODUCT.md's illustrative line-204 enum). HARD CONSTRAINT inherited by S2 + W4 + W1/W2/W3.
      • entities.ts — 8 domain interfaces (Date timestamps = Prisma runtime shape).
      • config/reserved-slugs.ts — RESERVED_SLUGS (18, verbatim) + isReservedSlug().
      • validators.ts — Zod (tenantSlug 3–30/regex/no-`--`/reserved → generic "slug unavailable" per V25;
        display-name caps 40/24/24; email; fingerprint; UUID idempotency key; enum schemas).
  - **Validation green** — pnpm install ✓; typecheck ✓ (0 errors); lint ✓ (0 problems); build/test no-op exit 0;
    prettier --check ✓. 465 lines total (within the 500-line dispatch budget). 1 self-caught import typo fixed inline.
  - **CHANGELOG_AI.md appended** — full S1 entry (Rule 15 attribution; audit-vocabulary divergence resolved).

LAST_DONE (S0 — Re-baseline + inputs.yml regen):
  - **docs/STATE.md rewritten** (this file) — reconciled to the real clean-slate state; corrected the
    false Phase 3.5 brownfield-complete claim per authoritative IMPLEMENTATION_MAP.md.
  - **inputs.yml regenerated** from docs/PRODUCT.md — drift corrected and validated against inputs.schema.json:
      • entities: replaced fabricated `BrandAsset / CallSnapshot / SessionInvalidation` (not in PRODUCT.md)
        with the 8 PRODUCT.md domain models — Tenant, User, Device, Invitation, AuditLog, CallSession,
        WebPushSubscription, ExportJob (Auth.js owns Session/VerificationToken/Account separately).
      • modules: 6 → 8 faithful (calling, directory, device-identity, accounts-auth, tenancy-members,
        branding, admin-console, pwa).
      • jobs.queues: 2 → 6 (device-archive, tenant-export, soft-delete-cron, backup, email, logo-image) —
        grounded in DECISIONS_LOG.md "LOCKED: Jobs + Queues" (Step 5) + "LOCKED: Database Backup" (Step 7).
      • tenancy.notes: clarified hybrid LAN+Cloud one-codebase model.
      • security.audit_events: aligned to the PRODUCT.md AuditLog action prefixes
        (member.* / device.* / tenant.* / auth.* / superadmin.* / lan.* / pwa.*).
      • inputs.yml VALID against inputs.schema.json (jsonschema check passed in sandbox).
  - **Phase 0 skeleton verified intact** — governance docs, .gitignore (comprehensive), and MCP wiring
    (.mcp.json + .vscode/mcp.json: socraticode + context7 + shadcn) all present and correct. No repair needed.
  - **CHANGELOG_AI.md appended** — clean-slate re-baseline + plan-correction entry (Rule 15 attribution).

NEXT:
  1. **S4a-2 — Scaffold Part 5 (shadcn primitives + token-parity)** — generate the 17 LOCKED primitives
     (button, card, input, label, dialog, badge, avatar, separator, scroll-area, tabs, select, switch,
     sonner, skeleton, tooltip, dropdown-menu, form — q-S4-02) into apps/yelli/src/components/ui/, +
     src/lib/tokens.ts (hand-maintained Clay mirror) + a Vitest token-parity test (DL "Design Tokens").
     The foundation (components.json v3-mode, tailwind.config, globals shadcn vars, @/lib/utils cn) is
     already wired by S4a-1. ⚠ DECISION FIRST: shadcn CLI is v4.11.0 (Tailwind-v4-first) but the stack is
     LOCKED Tailwind v3 — components.json is pre-staged in v3 mode (`tailwind.config` path) to steer the
     CLI; confirm `shadcn add` honors v3 OR pin a v3-compatible CLI OR hand-author the primitives. Keep
     the session ≤12 files / ≤500L authored (primitives are CLI-generated, not hand-authored line budget).
  2. **S4b — Scaffold Part 5 (auth + tRPC skeleton)** — depends on S4a-1. Auth.js v5 Credentials provider +
     `session: { strategy: 'jwt' }` (NO PrismaAdapter — DL:172) wiring User.securityVersion + isSuspended
     in the session() callback; tRPC v11 init + context + root router + 7 router skeletons (devices, users,
     calls [key MUST be `calls`], tenants, invitations, audit, brand) + 5 middleware (auth, tenant-scope
     L1+L6, audit L5, rate-limit, error); src/proxy.ts (Next.js 16 proxy()/proxyConfig, V25 anti-tenant-
     switching — DL:179); src/env.ts (Zod env validation, with SKIP_ENV_VALIDATION build guard); LAN
     anonymous-admin hook; api route handlers (trpc + auth). AT_RISK — split further if >500L.
  3. Then S5 (deploy + CI; wire `prisma generate` before typecheck, add pnpm onlyBuiltDependencies for prisma).
  3. Then W1–W8 wire the validated prototype/ flows to the real backend (swap sim layer for tRPC/Prisma),
     finishing with W8 pre-production validation (9 §3 flows end-to-end + Phase 5 re-run + Visual QA).
  Output Equivalence: the scaffold-then-wire rebuild must reproduce the proven decisions in DECISIONS_LOG.md
  and the 9 signed-off §3 flows in PROTOTYPE.md — nothing is re-decided, only re-built.

BLOCKERS:     S4 is PARTIAL (S4a-1 done, committed). The REMAINDER is BLOCKED on budget + one decision:
              (1) S4a-2 needs a decision before it runs — shadcn CLI v4.11.0 is Tailwind-v4-first vs the
                  LOCKED Tailwind v3; confirm `shadcn add` honors the v3-mode components.json OR pin a v3
                  CLI OR hand-author the 17 primitives.
              (2) S4a-2 + S4b must be dispatched as SEPARATE worker sessions (each ≤12 files / ≤500L);
                  combined S4 cannot fit one session. S4a-1 must NOT be redone — it is committed.
              No code-level blockers; foundation builds clean. S4a-2 + S4b both depend only on S4a-1 + S1–S3.

GIT_BRANCH:   swarm/rebuild. S3 adds 1 atomic commit (packages/ui + packages/jobs + root package.json ioredis
              override + pnpm-lock.yaml + docs/STATE.md + docs/CHANGELOG_AI.md). The human reviews and pushes —
              the worker never pushes.
              Recent commits:
  - `5e0b58c` feat(phase-4-S2): Scaffold Part 3 — packages/db (Prisma schema + migration)
  - `9328eb5` feat(phase-4-S1): Scaffold Parts 1-2 — root config + packages/shared
  - `dddb647` feat(phase-4-S0): Re-baseline + inputs.yml regen (Bootstrap)
  - `552d8ad` chore(phase-3.5): execution plan generated — 9 sessions, brownfield-aware  ← premise corrected by S0
  - `2a5b1dc` chore(phase-3.3): client sign-off + STATE.md gate-closure

PORTS:        Phase 4 app dev port = 46848 (inputs.yml ports.dev.app). prototype/ dev server on 4838
              (Phase 3.3 validated baseline, retained for Phase 4 spot-checks).

MODELS:
  planning:   claude-code (Opus — architect)
  execution:  claude-sonnet-4-6 via Claude Code
  governance: gemini-2.5-flash-lite

CHECKPOINT TYPE (S4a-1): full — apps/yelli: 12 foundation files created + .gitignore (+next-env.d.ts) +
  pnpm-lock.yaml + 3 governance docs (STATE.md, CHANGELOG_AI.md, DECISIONS_LOG.md answer-log) ; 1 atomic commit.
LINES_TOUCHED (S4a-1): ~430 lines authored (7 config files ~210 + tokens.css ~45 + globals.css ~65 +
  layout/page/utils ~30 + comments). Within the ≤500-line / ≤12-file budget. shadcn primitives + auth +
  tRPC deliberately NOT in this session (would push to ~30+ files / >1000L — over budget).
FILES_TOUCHED (S4a-1):
  - apps/yelli: package.json, next.config.ts, tsconfig.json, eslint.config.mjs, postcss.config.mjs,
    tailwind.config.ts, components.json, src/styles/tokens.css, src/app/globals.css, src/app/layout.tsx,
    src/app/page.tsx, src/lib/utils.ts
  - .gitignore (+next-env.d.ts), pnpm-lock.yaml (+next/react/react-dom/tailwind/postcss/autoprefixer)
  - docs/STATE.md (this file), docs/CHANGELOG_AI.md (appended), docs/DECISIONS_LOG.md (Brain q-S4 answer log)
TIER_CLASSIFICATION (S4a-1): Tier 1 — lightweight (~430 authored lines; mostly config + verbatim token
  carry-forward; executed headless Opus-inline per the standing V32.1 fallback; `next build` + typecheck +
  lint + prettier all green, no thrash). Parent S4 = Tier 3 (heavy) → split into S4a-1 (done) / S4a-2 / S4b.

CHECKPOINT TYPE: full (S3 scaffold session — packages/ui: 6 files + packages/jobs: 13 files created + root
  package.json modified + 2 governance docs updated; 1 atomic commit)
LINES_TOUCHED (S3): ~430 lines of new scaffold (ui src ~95 + 3 config ~30; jobs src ~270 + 3 config ~35) +
  root package.json (+5: ioredis override) + pnpm-lock.yaml + CHANGELOG_AI.md + this STATE.md.
FILES_TOUCHED (S3):
  - packages/ui: package.json, tsconfig.json, eslint.config.mjs, src/index.ts, src/lib/cn.ts, src/tailwind-preset.ts
  - packages/jobs: package.json, tsconfig.json, eslint.config.mjs, src/index.ts, src/connection.ts, src/queues.ts,
    src/workers/_validate.ts, src/workers/device-archive.ts, src/workers/tenant-export.ts,
    src/workers/soft-delete-cron.ts, src/workers/backup.ts, src/workers/email.ts, src/workers/logo-image.ts
  - package.json (root — modified: +pnpm.overrides.ioredis 5.10.1)
  - pnpm-lock.yaml (modified — +bullmq/ioredis/clsx/tailwind-merge/tailwindcss)
  - docs/STATE.md (this file), docs/CHANGELOG_AI.md (appended)
TIER_CLASSIFICATION: Tier 1 — lightweight (~430 lines, under the 500-line Sonnet-dispatch gate; mostly
  declarative definitions + small stubs; executed headless Opus-inline per the standing V32.1 fallback;
  validated clean with one self-caught JSDoc `*/` parse bug, no thrash).

EXECUTION NOTE (Rule 15 / V32.1): This swarm worker runs headless (`claude -p`) as a single executor agent
  and performs its own file writes inline — sub-agent dispatch is not used in this harness. This is the
  standing V32.1 Opus-inline fallback pattern (documented; env-structural, not a discretionary R1 bypass).

KNOWN STANDING ISSUES (carried into the scaffold/wire sessions):
  - V32.1 dispatch-layer regression (env-structural). Standing fallback: inline writes by the worker.
  - 4 Phase 3.3 deferrals carry into the wire sessions: (1) Flow E LAN-admin-login re-render no-op (W1);
    (2-4) overlay heading semantics + next/font/google migration + hex→CSS-var wiring (W7).
  - Old `.cline/tasks/execution-plan.md` (136L) reflects the superseded brownfield premise — retained
    for reference only; the swarm S0→S5→W1–W8 plan is authoritative for Phase 4.
