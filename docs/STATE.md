# Project State — Yelli
# Auto-generated. Never edit manually.

## Current State — Clean-Slate Re-baseline (swarm/rebuild · S0 complete, 2026-06-12)

PHASE:        **Phase 4 — Clean-Slate Scaffold-then-Wire rebuild** (driven by the swarm session plan
              on branch `swarm/rebuild`). S0 (this re-baseline) is complete.

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
  ABSENT:   apps/ , packages/ , package.json , pnpm-workspace.yaml , node_modules/ , tools/.
            ⇒ `pnpm lint|build|test` and `pnpm tools:validate-inputs` cannot run yet — no workspace exists.
            This is correct for a pre-scaffold re-baseline; those land in scaffold sessions S1–S5.

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
  1. **S1 — Scaffold Parts 1–2** (root monorepo config: pnpm-workspace.yaml, turbo.json, tsconfig.base.json,
     eslint/prettier, .nvmrc=22; packages/shared: TS types + Zod validators + 18-reserved-slugs + phantom-ui@0.10.1 pin).
  2. Then S2 (packages/db Prisma schema — the contract; AT_RISK) → S3 (ui+jobs) → S4 (apps/yelli Next.js +
     shadcn + Auth.js + tRPC skeleton; AT_RISK) → S5 (deploy + CI).
  3. Then W1–W8 wire the validated prototype/ flows to the real backend (swap sim layer for tRPC/Prisma),
     finishing with W8 pre-production validation (9 §3 flows end-to-end + Phase 5 re-run + Visual QA).
  Output Equivalence: the scaffold-then-wire rebuild must reproduce the proven decisions in DECISIONS_LOG.md
  and the 9 signed-off §3 flows in PROTOTYPE.md — nothing is re-decided, only re-built.

BLOCKERS:     none for S0. S1 unblocked. (S1 depends only on S0, now complete.)

GIT_BRANCH:   swarm/rebuild. This session adds 1 atomic commit (inputs.yml + docs/STATE.md + docs/CHANGELOG_AI.md).
              The human reviews and pushes — the worker never pushes.
              Recent commits (pre-S0):
  - `552d8ad` chore(phase-3.5): execution plan generated — 9 sessions, brownfield-aware  ← premise now corrected
  - `2a5b1dc` chore(phase-3.3): client sign-off + STATE.md gate-closure
  - `51ebf48` chore(ci): move react-doctor workflow to repo root + pin action SHAs

PORTS:        Phase 4 app dev port = 46848 (inputs.yml ports.dev.app). prototype/ dev server on 4838
              (Phase 3.3 validated baseline, retained for Phase 4 spot-checks).

MODELS:
  planning:   claude-code (Opus — architect)
  execution:  claude-sonnet-4-6 via Claude Code
  governance: gemini-2.5-flash-lite

CHECKPOINT TYPE: full (1 file regenerated + 1 governance file appended + this STATE.md rewrite; 1 atomic commit)
LINES_TOUCHED: ~165 lines inputs.yml (regenerated) + CHANGELOG_AI.md (appended) + this STATE.md rewrite
FILES_TOUCHED:
  - inputs.yml (regenerated — faithful to PRODUCT.md; schema-valid)
  - docs/STATE.md (this file)
  - docs/CHANGELOG_AI.md (appended)
TIER_CLASSIFICATION: Tier 1 — lightweight (3 files; mechanical re-baseline; no scaffold)

EXECUTION NOTE (Rule 15 / V32.1): This swarm worker runs headless (`claude -p`) as a single executor agent
  and performs its own file writes inline — sub-agent dispatch is not used in this harness. This is the
  standing V32.1 Opus-inline fallback pattern (documented; env-structural, not a discretionary R1 bypass).

KNOWN STANDING ISSUES (carried into the scaffold/wire sessions):
  - V32.1 dispatch-layer regression (env-structural). Standing fallback: inline writes by the worker.
  - 4 Phase 3.3 deferrals carry into the wire sessions: (1) Flow E LAN-admin-login re-render no-op (W1);
    (2-4) overlay heading semantics + next/font/google migration + hex→CSS-var wiring (W7).
  - Old `.cline/tasks/execution-plan.md` (136L) reflects the superseded brownfield premise — retained
    for reference only; the swarm S0→S5→W1–W8 plan is authoritative for Phase 4.
