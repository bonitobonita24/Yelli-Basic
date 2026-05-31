# CHANGELOG_AI

## 2026-05-31 — PRODUCT.md Reverse-Extraction (SITUATION D)
- Agent:              HUMAN (via Planning Assistant on Claude.ai)
- Why:                Existing Yelli LAN MVP (vanilla Node + ws + WebRTC) needed Spec-Driven V31 framework adoption without rebuilding code. SITUATION D recipe (Prompt 4.14) used to reverse-extract PRODUCT.md from existing app + new requirements.
- Files added:        docs/PRODUCT.md (621 lines, all 11 required sections + 13 extras)
                      docs/DESIGN.md (576 lines, Clay aesthetic + Mobile-First Principles)
                      docs/MOCKUP.jsx (1337 lines, Tier 1 screens at 375px baseline)
- Files modified:     none
- Files deleted:      none
- Schema/migrations:  none
- Errors encountered: none
- Errors resolved:    none
- Notes:              Steps 1-9 locked in series 2026-05-30 → 2026-05-31. Step 10 (Mobile-First global contract) locked post-audit 2026-05-31. Phase 2.6 (DESIGN.md) and 2.8 (mockup) SATISFIED via SITUATION D exception (existing public/index.html is the reference). AlphaTest/ promoted to project root 2026-05-30.

## 2026-06-01 — Spec-Driven V31 Brownfield Adoption (Prompt 1.5.4)
- Agent:              CLAUDE_CODE (Opus 4.7 Architect; Sonnet 4.6 Executor per V32 R1)
- Why:                Adopt Spec-Driven Platform V31 governance + state scaffold without rebuilding code (1.5.4 Adoption-mode Bootstrap). Pre-existing server.js (385L), public/index.html (47KB), compose.yaml, Dockerfile, deploy/ — attributed to HUMAN, retained as reference for Phase 4 Part 1 rewrite.
- Files added:        docs/DECISIONS_LOG.md, docs/CHANGELOG_AI.md (this file), docs/IMPLEMENTATION_MAP.md, project.memory.md, inputs.yml, inputs.schema.json, .cline/memory/lessons.md, .cline/memory/agent-log.md, .cline/STATE.md
- Files modified:     none (NEVER-TOUCH guard verified by deploy-v31.sh)
- Files deleted:      none
- Schema/migrations:  none (no DB exists yet; Prisma scaffold deferred to Phase 4 Part 3)
- Errors encountered: Stack truth contradiction — memory note Path A (vanilla locked) vs PRODUCT.md target stack (Next.js/tRPC/Prisma).
- Errors resolved:    Via AskUserQuestion: PRODUCT.md wins per Rule 28. inputs.yml declares target stack + migration.brownfield: true. Memory note marked STALE.
- Notes:              Branch: chore/adopt-spec-driven (Prompt 1.5.1 safety backup). Tag: pre-spec-driven-adoption-20260531 on main. deploy-v31.sh ran clean (framework files byte-identical from 76990c3 commit, .gitignore already had V32 entries, NEVER-TOUCH guard passed). 4 Sonnet dispatches per V32 R1/R2 (3 governance + 2 spec + 1 schema + 4 state). Total ~1120 lines.

## 2026-06-01 — Phase 2 Operational Interview (Bootstrap Step 18 V30)
- Agent: CLAUDE_CODE
- Why: Lock operational decisions (ports, CORS, admin email) and generate Phase 3 artifacts (CREDENTIALS.md, env files, sync script) so Phase 4 Part 1 can proceed without ops blockers per V32 R4.
- Files added: CREDENTIALS.md (gitignored, 6.8KB, 114 lines), .env.dev (gitignored), .env.staging (gitignored), .env.prod (gitignored), .env.example (tracked, 3.3KB), scripts/sync-credentials-to-env.sh (executable, 95 lines)
- Files modified: inputs.yml (ports.dev.* filled with random base 46838 + 11 derived; cors block added; app.admin_email added)
- Schema/migrations: none
- Secrets generated: 25 via openssl (3×DB pwd 22-char + 3×DB user suffix hex11 + 3×PgBouncer 22 + 3×Valkey 22 + 3×MinIO access hex11 + 3×MinIO secret 48 + 3×pgAdmin 22 + 3×AUTH_SECRET 48 + webmaster 22) — written to CREDENTIALS.md only, never logged
- Deferred ⏳: GitHub PAT, Docker Hub token, SMTP host/creds, Cloudflare Turnstile prod keys (Komodo UI URL, third-party keys). Phase 5 staging deploy will block on required fields
- Decomposition: 5 Sonnet dispatches (V32 R1, ≤500 lines each) + Opus STATE.md checkpoint (R1 exception)
- Errors encountered/resolved: none

## 2026-06-01 — Phase 4 Part 1 (Root monorepo config)
- Agent:              CLAUDE_CODE (Opus 4.7 Architect + 3 Sonnet dispatches per V32 R1)
- Why:                Phase 4 brownfield rewrite — establish monorepo root for Next.js/tRPC/Prisma target stack. pnpm + Turborepo orchestration.
- Files added:        pnpm-workspace.yaml, turbo.json, tsconfig.base.json, .editorconfig, .prettierrc, .eslintrc.js, .nvmrc
- Files modified:     package.json (overwrote pre-bootstrap vanilla `ws` server minimal — new monorepo root with turbo/eslint/prettier/typescript devDeps), .gitignore (appended .next/, .turbo/, dist/, build/ — idempotent verification of Bootstrap Step 8+16 entries)
- Files deleted:      none
- Schema/migrations:  none (Part 3 owns schema)
- Errors encountered: none
- Errors resolved:    Trade-off — engines.node set to >=22 (matches WSL2 dev v22.20) while .nvmrc=24 (target). CI will run on Node 24 per .nvmrc; dev allows 22 to avoid forcing immediate local upgrade.
- Validation:         pnpm install OK (110 pkgs, lockfile generated); turbo lint/typecheck = 0 packages in scope (apps/* + packages/* empty until Parts 2-5) → expected PASS.
- Brownfield note:    Vanilla edition deploy (yelli-maes.powerbyte.app) remains operational on prior commit a251049 until Phase 4 completes and manual Komodo redeploy is triggered. No auto-deploy.
