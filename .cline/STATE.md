# Project State — Yelli
# Auto-generated. Never edit manually.
# Updated: 2026-06-01 by CLAUDE_CODE (Opus 4.7 Architect, V32 R1 STATE.md exception)

PHASE:        Phase 2 Operational Interview complete (Bootstrap Step 18 V30 — non-blocking credentials path)
LAST_DONE:    Filled inputs.yml ports.dev (base=46838 + 11 derived), added cors block (dev/staging/prod), added app.admin_email. Generated 25 service secrets via openssl. Wrote CREDENTIALS.md (114L, gitignored, ⏳ placeholders for GitHub PAT/Docker Hub token/SMTP/Turnstile prod). Wrote .env.dev/.env.staging/.env.prod (gitignored) + .env.example (tracked). Wrote scripts/sync-credentials-to-env.sh (95L, chmod +x, syntax OK). Appended CHANGELOG_AI +1 entry, DECISIONS_LOG +3 LOCKED entries (admin email, port strategy, CORS source), agent-log +1 line. 5 Sonnet dispatches under V32 R1, each ≤500 lines, each ≤6 tool uses per V32.1 baseline overhead guidance.
NEXT:         Phase 4 Part 1 — root config rewrite. Fresh Claude Code session per Rule 24. Read .cline/tasks/phase4-part1.md (if present; else build from phases.md Part 1 spec). Generate: pnpm-workspace.yaml, turbo.json, tsconfig.base.json, root package.json (pnpm@10, name=yelli), .editorconfig, .prettierrc, .eslintrc.js, .nvmrc=24, .gitignore final pass. Create scaffold/part-1 branch, build, lint, typecheck, squash-merge, STOP.
BLOCKERS:     none for Phase 4 Part 1. Phase 5 staging will block on unfilled CREDENTIALS.md ⏳ fields (GitHub PAT, Docker Hub token, SMTP host/creds, Turnstile prod keys).
GIT_BRANCH:   chore/adopt-spec-driven (Phase 2 work uncommitted)
GIT_TAG:      pre-spec-driven-adoption-20260531 (on main)
PORTS:        ASSIGNED — base=46838, db=46838, pgbouncer=46839, redis=46840, minio=46841, minio_console=46842, mailhog=46843, mailhog_ui=46844, pgadmin=46845, app=46848, worker=46849, prisma_studio=46858. Staging/prod use standard ports.
MIGRATION:    brownfield=true (current: vanilla Node+ws → target: Next.js/tRPC/Prisma). Phase 4 Part 1 starts the rewrite — pre-existing public/index.html, scripts/gen-cert.sh, scripts/tunnel.sh, deploy/windows/* retained per migration.retained_assets.
LIVE_DEPLOY:  yelli-maes.powerbyte.app (existing vanilla edition stays operational during Phase 4 rewrite)
MODELS:
  planning:   claude-code (Opus 4.7 — Architect ONLY per V32 R1)
  execution:  claude-sonnet-4-6 (via Claude Code — all file writes)
  governance: gemini-2.5-flash-lite
LINES_TOUCHED: ~840 this session (inputs.yml ~50 net + CREDENTIALS.md 114 + 4 env files ~330 + sync script 95 + governance appends ~70 + STATE.md 40 rewrite)
CHECKPOINT_TYPE: full
FILES_TOUCHED:
  - inputs.yml (modified — ports filled, cors added, admin_email added)
  - CREDENTIALS.md (created — gitignored)
  - .env.dev (created — gitignored)
  - .env.staging (created — gitignored)
  - .env.prod (created — gitignored)
  - .env.example (created — tracked)
  - scripts/sync-credentials-to-env.sh (created, chmod +x)
  - docs/CHANGELOG_AI.md (appended Phase 2 entry)
  - docs/DECISIONS_LOG.md (appended 3 LOCKED entries)
  - .cline/memory/agent-log.md (appended timestamp line)
  - .cline/STATE.md (this checkpoint)
TIER_CLASSIFICATION: 2 — moderate (5 Sonnet dispatches + 1 Opus STATE.md write, ~840L total, each dispatch ≤500L per V32 R2)
DISPATCH_LEDGER:
  D1 (Sonnet 168K tokens, 5 tools, 36s): inputs.yml — ports filled + cors + admin_email
  D2 (Sonnet 175K tokens, 4 tools, 82s): openssl secrets + CREDENTIALS.md
  D3 (Sonnet 174K tokens, 5 tools, 75s): 4 env files from /tmp temp + tmp deletion
  D4 (Sonnet 168K tokens, 3 tools, 38s): scripts/sync-credentials-to-env.sh
  D5 (Sonnet 172K tokens, 6 tools, 60s): governance appends (CHANGELOG + DECISIONS + agent-log)
  STATE (Opus this turn): STATE.md rewrite (V32 R1 exception)
NEXT_DISPATCH: Sonnet — commit + push on chore/adopt-spec-driven
