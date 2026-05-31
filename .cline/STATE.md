# Project State — Yelli
# Auto-generated. Never edit manually.
# Updated: 2026-06-01 by CLAUDE_CODE (Opus 4.7 Architect, V32 R1 STATE.md exception)

PHASE:        Phase 0 Bootstrap retrofit complete (Steps 4 + 17 + 19 — Phase 2 Op also complete from prior turn)
LAST_DONE:    Bootstrap surgical retrofit: wrote 8 phase4 task files in .cline/tasks/ (481L total — Part 6 = N/A stub for "no separate mobile app"); wrote .github/skills/spec-driven-core/SKILL.md (76L) with V32.1.5 compact rules card + .gitkeep; appended Loading Library Lock dual-path 🟤 decision typed entry to lessons.md (DECISIONS_LOG L97-98 already had it). 3 Sonnet dispatches under V32 R1, each ≤500L. .gitignore already covered .github/skills/**/node_modules/. Phase 2 Op work from prior turn (commit 7525dc5) already on remote.
NEXT:         Phase 4 Part 1 — root config rewrite. Open .cline/tasks/phase4-part1.md in a NEW Claude Code session per Rule 24 (fresh-context per Part). Trigger: "Start Part 1". Generates pnpm-workspace.yaml, turbo.json, tsconfig.base.json, root package.json (name=yelli, pnpm@10), .editorconfig, .prettierrc, .eslintrc.js, .nvmrc=24, final .gitignore pass. Branch: scaffold/part-1. Squash-merge to main on success. STOP after Part 1 — open Part 2 in another new session.
BLOCKERS:     none for Phase 4 Part 1. Phase 5 staging will block on unfilled CREDENTIALS.md ⏳ fields (GitHub PAT, Docker Hub token, SMTP host/creds, Turnstile prod keys).
GIT_BRANCH:   chore/adopt-spec-driven (Bootstrap retrofit uncommitted; Phase 2 Op work already pushed at 7525dc5)
GIT_TAG:      pre-spec-driven-adoption-20260531 (on main)
PORTS:        ASSIGNED — base=46838, db=46838, pgbouncer=46839, redis=46840, minio=46841, minio_console=46842, mailhog=46843, mailhog_ui=46844, pgadmin=46845, app=46848, worker=46849, prisma_studio=46858. Staging/prod use standard ports.
MIGRATION:    brownfield=true (current: vanilla Node+ws → target: Next.js/tRPC/Prisma). Phase 4 Part 1 starts the rewrite — pre-existing public/index.html, scripts/gen-cert.sh, scripts/tunnel.sh, deploy/windows/* retained per migration.retained_assets.
LIVE_DEPLOY:  yelli-maes.powerbyte.app (existing vanilla edition stays operational during Phase 4 rewrite)
MODELS:
  planning:   claude-code (Opus 4.7 — Architect ONLY per V32 R1)
  execution:  claude-sonnet-4-6 (via Claude Code — all file writes)
  governance: gemini-2.5-flash-lite
LINES_TOUCHED: ~570 this turn (8 task files 481 + SKILL.md 76 + lessons append ~10 + agent-log append ~3 + STATE.md 30 rewrite)
CHECKPOINT_TYPE: full
FILES_TOUCHED:
  - .cline/tasks/phase4-part1.md (created)
  - .cline/tasks/phase4-part2.md (created)
  - .cline/tasks/phase4-part3.md (created)
  - .cline/tasks/phase4-part4.md (created)
  - .cline/tasks/phase4-part5.md (created)
  - .cline/tasks/phase4-part6.md (created — N/A stub)
  - .cline/tasks/phase4-part7.md (created)
  - .cline/tasks/phase4-part8.md (created)
  - .github/skills/.gitkeep (created)
  - .github/skills/spec-driven-core/SKILL.md (created)
  - .cline/memory/lessons.md (appended 🟤 decision entry)
  - .cline/memory/agent-log.md (appended timestamp line)
  - .cline/STATE.md (this checkpoint)
TIER_CLASSIFICATION: 2 — moderate (3 Sonnet dispatches + 1 Opus STATE.md write, ~570L total, each dispatch ≤500L per V32 R2)
DISPATCH_LEDGER (Bootstrap retrofit turn):
  D1 (Sonnet 173K tokens, 6 tools, 77s): phase4-part1..4.md (151L)
  D2 (Sonnet 177K tokens, 6 tools, 152s): phase4-part5..8.md (330L)
  D3 (Sonnet 172K tokens, 3 tools, 65s): spec-driven-core SKILL.md (76L) + .gitkeep + gitignore check
  D4 (Sonnet 170K tokens, 7 tools, 62s): lessons.md 🟤 decision append + agent-log line
  STATE (Opus this turn): STATE.md rewrite (V32 R1 exception)
NEXT_DISPATCH: Sonnet — commit + push Bootstrap retrofit on chore/adopt-spec-driven
