# Project State — Yelli
# Auto-generated. Never edit manually.
# Updated: 2026-06-02 21:36 GMT+8 by CLAUDE_CODE (Opus 4.7 Architect, V32 R1 — STATE.md exception)

PHASE:        Phase 6 FULLY COMPLETE — end-to-end Rule 16 PASS (app loads, login form interactive, sign-in → Directory page, /api/health 200). Three Rule 16 / Phase 6.5 fixes applied across 5 dispatches:
                D1 — URL-encode `/` → `%2F` in .env.dev DATABASE_URL password (Zod `.url()` strict)
                D2 — bump next-auth 5.0.0-beta.22 → 5.0.0-beta.31 (Next.js 16 async cookies() incompat)
                D3 — Phase 6 checkpoint commit eb5a442 (governance writes + gitignore .playwright-mcp/)
                D4 — add AUTH_TRUST_HOST=true to .env.dev + change `redirect("/app")` to `redirect("/")` in (auth)/login/page.tsx and LoginForm.tsx (Auth.js UntrustedHost + (app) route group serves `/` not `/app`)
                D5 — add DATABASE_URL_INTERNAL + REDIS_URL_INTERNAL to .env.dev + docker-compose.app.yml `environment:` override so container reaches yelli_dev_postgres:5432 / yelli_dev_valkey:6379 (Phase 6.5 DB_CONNECTION_REFUSED — host `localhost` mapping doesn't apply inside container)
LAST_DONE:    Post-seed login flow verification PASS via Playwright. Seed ran on host with WEBMASTER_PASSWORD + .env.dev sourced for DATABASE_URL: `✅ Seeded platform tenant "_pwbt" + webmaster (bonitobonita24@gmail.com).` Then login form submit at http://localhost:46848/login → redirected to http://localhost:46848/ (Directory page, title "Directory — Yelli"). Page renders: "Signed in as bonitobonita24@gmail.com" + Badge variant=secondary text "admin" + heading "Directory" + Card "No devices yet" with `trpc.device.register` TODO + "Register this device" button. Only console errors: 2× /icons/icon-192.png 404 (cosmetic — declared in apps/yelli/src/app/layout.tsx Metadata but file missing in apps/yelli/public/icons/ — Phase 7 cleanup). End-to-end auth chain validated: Credentials provider → Prisma user.findFirst by email → bcrypt.compare → JWT issued → session callback re-validates fresh User+Tenant → RSC `getServerSession()` on (app)/page.tsx returns hydrated user. Turnstile bypassed via dev test sitekey (1x00000000000000000000AA always passes). Sign-in worked first time on the Phase 6.5 fixed stack.
NEXT:         Phase 6 COMPLETE → ready for Phase 7 (first Feature Update). The Directory page (/) has a clear TODO marker: wire the "Register this device" button to `trpc.device.register`. That's a natural Phase 7 Feature 1. User triggers Phase 7 by: (a) updating docs/PRODUCT.md if the device.register flow needs spec refinement (else skip), (b) saying "Feature Update" in a NEW Claude Code session per Rule 24 fresh-context discipline. Other Phase 7 candidates: fix /app→/ redirect bug source (already fixed in this session but lessons.md documents the pattern), generate /icons/icon-192.png (or stub), clean up duplicate `export GET` in /api/health route, investigate pgbouncer.ini:3 syntax error (deferred — non-blocking but real bug, app currently bypasses pgbouncer via direct DATABASE_URL).
BLOCKERS:     Phase 6 dev: NONE. All Rule 16 minimum checks PASS. Stack runs healthy.
              Phase 6 staging/prod deploy: same as Phase 5 — REQUIRED ⏳ in CREDENTIALS.md text-file (GitHub PAT, Docker Hub token, SMTP staging/prod, Turnstile prod LIVE keys, Komodo UI URL — all unfilled). Staging compose templates (deploy/compose/stage/, deploy/compose/prod/) also need the same `DATABASE_URL_INTERNAL` + `REDIS_URL_INTERNAL` + `environment:` override pattern that Phase 6.5 added to dev — currently they'd hit the same DB_CONNECTION_REFUSED. NEW STAGING/PROD PREREQ to add to Phase 7 backlog.
GIT_BRANCH:   main (Phase 5 checkpoint 5b4b9cb → Phase 6 checkpoint eb5a442 → Phase 6.5 fixes pending commit). Uncommitted (after Phase 6.5 fixes, gitignored excluded):
              - apps/yelli/src/app/(auth)/login/page.tsx (1 line: redirect target)
              - apps/yelli/src/components/auth/LoginForm.tsx (1 line: router.push target)
              - deploy/compose/dev/docker-compose.app.yml (3 lines: environment block)
              - .cline/STATE.md (this checkpoint — Opus V32 R1 exception)
              - .env.dev (3 new lines: AUTH_TRUST_HOST + DATABASE_URL_INTERNAL + REDIS_URL_INTERNAL — gitignored, excluded from commit)
GIT_TAG:      pre-spec-driven-adoption-20260531 (still pre-Phase-4 main — neither Phase 5 nor 6 checkpoints push to origin)
PORTS:        UNCHANGED — base=46838, db=46838, pgbouncer=46839 (RESTART LOOP — bypass via DATABASE_URL_INTERNAL direct to yelli_dev_postgres:5432), redis=46840, minio=46841, minio_console=46842, mailhog=46843, mailhog_ui=46844, pgadmin=46845, app=46848.
MIGRATION:    Phase 4 COMPLETE (Parts 1+2+3+4+5+7+8, Part 6 skipped). Phase 5 PASS. Phase 6 PASS — INCLUDING seed + login flow end-to-end. Database state: tenants(1: _pwbt) + users(1: webmaster bonitobonita24@gmail.com role=admin). Live deploy at yelli-maes.powerbyte.app stays on prior vanilla commit a251049 — awaiting staging compose patch (same DATABASE_URL_INTERNAL pattern) + Komodo redeploy.
LIVE_DEPLOY:  yelli-maes.powerbyte.app (vanilla edition at a251049; rewrite NOT yet deployed — Phase 6.5 patches need to be replicated to deploy/compose/stage/ + deploy/compose/prod/ before staging deploy)
MODELS:
  planning:   claude-code (Opus 4.7 — Architect ONLY per V32 R1; the 2 STATE.md edits this session are the documented exceptions)
  execution:  claude-sonnet-4-6 (5 dispatches D1-D5; each ≤1K-token prompt + ≤5 tool uses per V32.1 operational note; lockfile -65 lines was the biggest single change)
  governance: gemini-2.5-flash-lite (configured but unused — Sonnet handled all governance writes inline)
LINES_TOUCHED: Phase 6.5 session (after eb5a442 baseline): ~10 lines across 3 source files (.tsx 1L + .tsx 1L + .yml 3L) + ~3 lines in .env.dev (gitignored).
CHECKPOINT_TYPE: full (Phase 6.5 fixes need their own commit + lessons.md updates)
FILES_TOUCHED (since eb5a442):
  - apps/yelli/src/app/(auth)/login/page.tsx (Sonnet D4 — redirect target)
  - apps/yelli/src/components/auth/LoginForm.tsx (Sonnet D4 — router.push target)
  - .env.dev (Sonnet D4 AUTH_TRUST_HOST + Sonnet D5 DATABASE_URL_INTERNAL/REDIS_URL_INTERNAL — gitignored)
  - deploy/compose/dev/docker-compose.app.yml (Sonnet D5 environment: override)
  - .cline/STATE.md (this update — Opus V32 R1 exception)
  - docs/CHANGELOG_AI.md (Phase 6.5 entry — pending Sonnet D6)
  - .cline/memory/lessons.md (4 new typed entries — pending Sonnet D6)
  - .cline/memory/agent-log.md (Phase 6.5 session entry — pending Sonnet D6)
TIER_CLASSIFICATION: 1 — lightweight (Phase 6.5 = surgical config fixes; total surface ~13L across 4 files; well under V32 R2 500-line gate)
DISPATCH_LEDGER:
  D1 (env URL-encode):        ~250L scope, single Edit. DONE.
  D2 (next-auth bump):        ~30L scope. DONE typecheck=0, source untouched, lockfile -65L.
  D3 (Phase 6 governance):    ~120L scope, 5 file writes + 1 commit. DONE commit eb5a442, 8 files +89/-109.
  D4 (auth host + redirects): ~5L scope across 3 files. DONE typecheck=0.
  D5 (DB hostnames):          ~6L scope across 2 files. DONE compose render verified.
  D6 (Phase 6.5 governance):  pending — CHANGELOG entry + 4 lessons.md entries (🔴 Auth.js UntrustedHost requires AUTH_TRUST_HOST=true, 🔴 (app) route group serves `/` not `/app`, 🔴 container DB_CONNECTION_REFUSED — env_file vs environment: override pattern, 🟤 staging+prod compose need same DATABASE_URL_INTERNAL pattern) + agent-log entry + git commit.
NEXT_DISPATCH: D6 governance + commit (~200L scope). After D6: Phase 6 fully checkpointed, user can start Phase 7 in fresh session with "Feature Update".
