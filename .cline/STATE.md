# Project State — Yelli
# Auto-generated. Never edit manually.
# Updated: 2026-06-02 by CLAUDE_CODE (Opus 4.7 Architect, V32 R1 — STATE.md exception)

PHASE:        Phase 6 complete — Docker stack up, migrations applied, /api/health 200, Visual QA PASS (Rule 16 minimum). One auto-fix applied per Rule 16: next-auth 5.0.0-beta.22 → 5.0.0-beta.31 (Next.js 16 `cookies()` async migration). Seed deferred to user (WEBMASTER_PASSWORD from CREDENTIALS.md).
LAST_DONE:    Phase 6 dev verification — all gates cleared on main @ 5b4b9cb (uncommitted: apps/yelli/package.json + pnpm-lock.yaml from next-auth bump). Sequence: (1) Pre-flight clean on 5b4b9cb, ports 46838-46848 free. (2) `bash deploy/compose/start.sh dev up -d` first run: 7 containers up, postgres+valkey healthy. (3) Diagnosed 3 issues — DATABASE_URL had raw `/` in password (Zod `.url()` strict rejection — V31 lessons gotcha was applied only to apps/yelli/.env.local during Phase 4 Part 8, not root .env.dev), postgres data volume from 2026-05-14 (pre-brownfield) had superuser mismatch, pgbouncer restart loop (pgbouncer.ini:3 syntax error from edoburu image — AUTH_SECRET has `+/` chars that break .ini parser). (4) Dispatched Sonnet D1 to URL-encode `/` → `%2F` in .env.dev DATABASE_URL password (PGBOUNCER_DATABASE_URL password is alphanumeric, untouched). Sonnet verified via `new URL()` parse. (5) User-approved `docker volume rm yelli_dev_postgres_data` (pgbouncer_data didn't exist). (6) Restarted stack — fresh postgres init, all containers up (pgbouncer still loops separately). (7) `pnpm --filter @yelli/db exec prisma migrate deploy` — 2 migrations applied clean (0001_init, 0002_user_security_version). (8) Curl http://localhost:46848/api/health → HTTP 200 {"ok":true}. (9) Playwright Visual QA — /register HTTP 200 renders "Create an account — Yelli" form fine; / and /login both HTTP 500 with "TypeError: a.get is not a function" digest 1685532302/808358566. Diagnosis: next-auth 5.0.0-beta.22 uses sync `cookies().get()` which Next.js 16 made async (Phase 5 build+typecheck passed because the failure surfaces only at runtime in auth() call from RSC pages). (10) Per Rule 16 one-auto-fix allowance: dispatched Sonnet D2 to bump next-auth → 5.0.0-beta.31 in apps/yelli/package.json + `pnpm install` regenerate lockfile. Sonnet typecheck 0 errors, no source code changes needed, lockfile -65 lines net. (11) `bash deploy/compose/start.sh dev up -d --build` rebuilt yelli:dev-latest with new next-auth. (12) Re-probe: /, /login, /register, /api/health ALL HTTP 200. /login title="Sign in — Yelli" with interactive form (Email/Password inputs + Sign in button via Playwright snapshot). One cosmetic 404 remains: /icons/icon-192.png declared in apps/yelli/src/app/layout.tsx Metadata but file absent in apps/yelli/public/icons/ — Phase 7 cleanup.
NEXT:         Phase 6 complete except for SEED HANDOFF + LOGIN FLOW VERIFICATION (the one Rule 16 minimum check that requires the webmaster account). User runs ONE command locally:
                cd /home/me/UbuntuDevFiles/1_COMPANY_DEV/Yelli-Basic
                WEBMASTER_PASSWORD='<value from CREDENTIALS.md First Admin Account>' pnpm --filter @yelli/db db:seed
              Expected output: "✅ Seeded platform tenant "_pwbt" + webmaster (bonitobonita24@gmail.com)."
              Then visit http://localhost:46848/login and sign in (Turnstile is bypassed in dev — test sitekey 1x00...AA always passes). Should redirect to / and show "Directory" page with "Signed in as bonitobonita24@gmail.com" badge.
              AFTER seed verified: Phase 6 = fully complete. Next phase: Phase 7 Feature Update for first real feature (e.g. wire `trpc.device.register` button on `/` per the TODO in (app)/page.tsx). Phase 6.5 triage backlog:
                - 🔴 pgbouncer.ini:3 syntax error (edoburu image + AUTH_SECRET `+/` chars) — app currently bypasses pgbouncer via direct DATABASE_URL on port 46838, so non-blocking but a real bug to fix in Phase 7
                - 🟤 /icons/icon-192.png missing — generate or stub in apps/yelli/public/icons/
                - 🟤 Health endpoint file has TWO `export GET` functions (the simpler one wins, returning {ok:true} not the full DB-check version) — clean up Phase 7
                - 🟤 next-auth/Next.js 16 compatibility — beta.22→beta.31 fix locked in 🔴 lessons.md gotcha
BLOCKERS:     Phase 6 dev: none (deps + DB + app all healthy, all routes 200, login UI interactive). Login-flow Rule 16 check pending the seed handoff above.
              Phase 6 staging/prod deploy: same blockers as Phase 5 (GitHub PAT, Docker Hub token, SMTP staging/prod, Turnstile prod LIVE keys, Komodo UI URL — all REQUIRED ⏳ in CREDENTIALS.md and unfilled).
              SocratiCode index: run codebase_status before Phase 7 codebase_search calls — may still be queueing per Phase 4 Part 8 async start.
GIT_BRANCH:   main (5b4b9cb committed; uncommitted: apps/yelli/package.json next-auth bump + pnpm-lock.yaml regen + .env.dev URL-encoding fix + new STATE.md). Sonnet dispatch D3 below will commit these as one chore.
GIT_TAG:      pre-spec-driven-adoption-20260531 (still on pre-Phase-4 main — Phase 4 fully merged but not pushed; both Phase 5 + 6 checkpoints land on main without tag changes)
PORTS:        UNCHANGED — base=46838, db=46838, pgbouncer=46839 (RESTART LOOP — bypass via DATABASE_URL direct), redis=46840, minio=46841, minio_console=46842, mailhog=46843, mailhog_ui=46844, pgadmin=46845, app=46848, worker=46849, prisma_studio=46858.
MIGRATION:    Phase 4 COMPLETE (Parts 1+2+3+4+5+7+8, Part 6 skipped). Phase 5 PASS. Phase 6 PASS-WITH-PENDING-SEED. Live deploy at yelli-maes.powerbyte.app stays on prior vanilla commit a251049 — awaiting staging validation before manual Komodo redeploy.
LIVE_DEPLOY:  yelli-maes.powerbyte.app (vanilla edition operational at commit a251049; rewrite NOT yet deployed — awaiting staging validation after Phase 6 dev login verification)
MODELS:
  planning:   claude-code (Opus 4.7 — Architect ONLY per V32 R1, never Edit/Write project files except STATE.md)
  execution:  claude-sonnet-4-6 (Sonnet 4.6 via Agent dispatch — all file writes; this session: D1 .env.dev URL-encode + D2 next-auth bump + (pending) D3 governance writes + commit)
  governance: gemini-2.5-flash-lite (configured but unused — Sonnet handles governance writes inline)
LINES_TOUCHED: ~10 source (.env.dev 1 line + apps/yelli/package.json 1 line + pnpm-lock.yaml ~83 lines net -65) + STATE.md (this file) + Phase 6 governance docs via Sonnet D3.
CHECKPOINT_TYPE: full (modified .env.dev + package.json + pnpm-lock.yaml + STATE.md + pending governance writes)
FILES_TOUCHED:
  - .env.dev (URL-encode `/` → `%2F` in DATABASE_URL password — Sonnet D1)
  - apps/yelli/package.json (next-auth 5.0.0-beta.22 → 5.0.0-beta.31 — Sonnet D2)
  - pnpm-lock.yaml (next-auth peer resolution — Sonnet D2)
  - .cline/STATE.md (this checkpoint — Opus V32 R1 exception)
  - docs/CHANGELOG_AI.md (Phase 6 entry — pending Sonnet D3)
  - docs/IMPLEMENTATION_MAP.md (Phase 6 status update — pending Sonnet D3)
  - .cline/memory/lessons.md (3 new typed entries — pending Sonnet D3)
  - .cline/memory/agent-log.md (Phase 6 session entry — pending Sonnet D3)
  - .gitignore (add .playwright-mcp/ — pending Sonnet D3)
TIER_CLASSIFICATION: 1 — lightweight (Phase 6 = startup + verification + one-line patches; total surface ~10 source lines across 3 files plus 5 governance file appends, well under 500-line dispatch gate per V32 R2)
DISPATCH_LEDGER (Phase 6):
  D1 (env URL-encode): ~250L total scope, single Edit on .env.dev line 15 + verification via `new URL()`. DONE, no concerns.
  D2 (next-auth bump): ~30L total scope (1-line package.json edit + lockfile auto-regen + typecheck verify). DONE, typecheck 0 errors, lockfile -65 net lines, no source changes.
  D3 (governance + commit): pending — write 5 governance files + .gitignore + git commit on main. ≤200L total prompt + ≤5 tool uses per V32.1 operational note.
NEXT_DISPATCH: Phase 6 completion = user runs db:seed locally + verifies login flow → reports back. Phase 7 starts in a fresh Claude Code session with "Feature Update" trigger after the first PRODUCT.md change.
