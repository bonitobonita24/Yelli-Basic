# Project State — Yelli
# Auto-generated. Never edit manually.

## Current State — Clean-Slate Scaffold (swarm/rebuild · S2 complete, 2026-06-12)

PHASE:        **Phase 4 — Clean-Slate Scaffold-then-Wire rebuild** (driven by the swarm session plan
              on branch `swarm/rebuild`). S0 (re-baseline) + S1 (Parts 1–2 scaffold) + S2 (Part 3:
              packages/db Prisma schema + L2/L5/L6 + migration 0001) are complete.

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
  ABSENT:   apps/ , packages/ui , packages/jobs , tools/.
            ⇒ `pnpm tools:validate-inputs` not wired yet (tools/ lands in S5). apps/yelli lands in S4.

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
  1. **S3 — Scaffold Part 4: packages/ui + packages/jobs** — shadcn/ui shared component layer + BullMQ typed
     queues/workers (6 queues per LOCKED Jobs + Queues). Consumes @yelli/db (S2) + @yelli/shared (S1).
     ⚠ If S3 (packages/jobs export worker) determines ExportJob state should be BullMQ/Valkey-only, it may drop
     the S2 export_jobs table (additive + isolated — see CHANGELOG S2 review note).
  2. Then S4 (apps/yelli Next.js + shadcn + Auth.js v5 Credentials/JWT + tRPC skeleton; AT_RISK) → S5 (deploy + CI;
     wire `prisma generate` before typecheck, add pnpm onlyBuiltDependencies for prisma if needed).
  3. Then W1–W8 wire the validated prototype/ flows to the real backend (swap sim layer for tRPC/Prisma),
     finishing with W8 pre-production validation (9 §3 flows end-to-end + Phase 5 re-run + Visual QA).
  Output Equivalence: the scaffold-then-wire rebuild must reproduce the proven decisions in DECISIONS_LOG.md
  and the 9 signed-off §3 flows in PROTOTYPE.md — nothing is re-decided, only re-built.

BLOCKERS:     none for S2. S3 unblocked (depends on S1 + S2, both complete). One non-blocking REVIEW NOTE
              carried to S3/human: ExportJob persistence (Postgres table vs BullMQ/Valkey-only) — see CHANGELOG S2.

GIT_BRANCH:   swarm/rebuild. S2 adds 1 atomic commit (packages/db + 0001 migration + entities.ts sync +
              pnpm-lock.yaml + docs/STATE.md + docs/CHANGELOG_AI.md). The human reviews and pushes — the worker
              never pushes.
              Recent commits:
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

CHECKPOINT TYPE: full (S2 scaffold session — packages/db: 11 files created + 1 modified package + 2 governance
  docs updated; 1 atomic commit)
LINES_TOUCHED (S2): ~830 lines of new scaffold (schema.prisma ~290, migration.sql ~300, down.sql ~55,
  src/* ~150, package/tsconfig/eslint ~45) + entities.ts (2-line sync) + CHANGELOG_AI.md + this STATE.md.
FILES_TOUCHED (S2):
  - packages/db: package.json, tsconfig.json, eslint.config.mjs,
    prisma/schema.prisma, prisma/migrations/0001_init/migration.sql, prisma/migrations/0001_init/down.sql,
    prisma/migrations/migration_lock.toml, src/index.ts, src/audit.ts, src/rls.ts, src/middleware/tenant-guard.ts
  - packages/shared/src/entities.ts (modified — securityVersion + targetId nullable)
  - pnpm-lock.yaml (modified — prisma 5.22.0)
  - docs/STATE.md (this file), docs/CHANGELOG_AI.md (appended)
TIER_CLASSIFICATION: Tier 2 — moderate (~830 lines, above the 500-line Sonnet-dispatch gate but executed as a
  single headless Opus-inline worker per the standing V32.1 fallback; schema+migration are largely declarative/
  reproduced from the LOCKED scaffold; validated clean with no thrash).

EXECUTION NOTE (Rule 15 / V32.1): This swarm worker runs headless (`claude -p`) as a single executor agent
  and performs its own file writes inline — sub-agent dispatch is not used in this harness. This is the
  standing V32.1 Opus-inline fallback pattern (documented; env-structural, not a discretionary R1 bypass).

KNOWN STANDING ISSUES (carried into the scaffold/wire sessions):
  - V32.1 dispatch-layer regression (env-structural). Standing fallback: inline writes by the worker.
  - 4 Phase 3.3 deferrals carry into the wire sessions: (1) Flow E LAN-admin-login re-render no-op (W1);
    (2-4) overlay heading semantics + next/font/google migration + hex→CSS-var wiring (W7).
  - Old `.cline/tasks/execution-plan.md` (136L) reflects the superseded brownfield premise — retained
    for reference only; the swarm S0→S5→W1–W8 plan is authoritative for Phase 4.
