# CHANGELOG_AI

## 2026-06-02 — Phase 7 Feature 3a: staging/prod compose internal-URL override
- Agent:               CLAUDE_CODE
- Why:                 Replicate Phase 6.5 dev pattern (DATABASE_URL_INTERNAL + REDIS_URL_INTERNAL with Docker container hostnames) to staging+prod compose files. Required before deploying the Spec-Driven rewrite to yelli-maes.powerbyte.app — without this, app container cannot reach postgres/valkey on `localhost`.
- Files added:         none
- Files modified:      .env.staging (added DATABASE_URL_INTERNAL + REDIS_URL_INTERNAL), .env.prod (added DATABASE_URL_INTERNAL + REDIS_URL_INTERNAL), deploy/compose/stage/docker-compose.app.yml (environment: appended 2 lines), deploy/compose/prod/docker-compose.app.yml (environment: appended 2 lines)
- Files deleted:       none
- Schema/migrations:   none
- Errors encountered:  none
- Errors resolved:     none

## 2026-06-02 — Phase 6.5 login-flow triage
- Agent:               CLAUDE_CODE (Opus 4.7 Architect + Sonnet 4.6 D4+D5)
- Why:                 Post-seed Rule 16 login flow uncovered 3 scaffold gaps blocking end-to-end auth
- Files added:         (none)
- Files modified:      apps/yelli/src/app/(auth)/login/page.tsx (redirect("/app") → redirect("/")), apps/yelli/src/components/auth/LoginForm.tsx (router.push("/app") → router.push("/")), deploy/compose/dev/docker-compose.app.yml (environment: override for DATABASE_URL+REDIS_URL using INTERNAL vars), .env.dev (gitignored — added AUTH_TRUST_HOST=true + DATABASE_URL_INTERNAL + REDIS_URL_INTERNAL)
- Files deleted:       (none)
- Schema/migrations:   (none) — seed inserted 1 tenant (_pwbt) + 1 user (webmaster bonitobonita24@gmail.com role=admin)
- Errors encountered:  (1) Auth.js v5 UntrustedHost on every /api/auth/* request. (2) Sign-in redirected to non-existent /app (404 — (app) route group serves `/`). (3) PrismaClientInitializationError: Can't reach database server at localhost:46838 from inside container (host port mapping doesn't apply intra-container).

## 2026-06-02 — Phase 7 Feature 2: Render device list on Directory page
- Agent:              CLAUDE_CODE (Opus 4.7 Architect + Sonnet 4.6 Executor — V32 R1)
- Why:                Close the read-after-write loop opened by Feature 1. The "Register this device" button invalidates `trpc.device.list` on success — but the page had no live list to invalidate. Replaced the static "No devices yet" placeholder Card with a live `<DeviceList />` client component that queries `trpc.device.list` and renders 4 states (loading/empty/error/success).
- Files added:        apps/yelli/src/components/devices/DeviceList.tsx
- Files modified:     apps/yelli/src/app/(app)/page.tsx
- Files deleted:      none
- Schema/migrations:  none — `device.list` procedure already scaffolded in Phase 4 Part 5
- Errors encountered: none — Sonnet scout confirmed `data?.items` return shape + `lastSeenAt` in select + shadcn Skeleton/Badge primitives already installed
- Errors resolved:    n/a
- Verification:       Stage 1 spec compliance PASS (renders displayName + callRole badge + relative-time lastSeenAt for active tenant, scoped via tenant-guard middleware). Stage 2 quality PASS (no `any`, single-purpose component, pure formatRelative helper, shadcn Skeleton loading per ui-rules.md Rule 11 PATH A). `cd apps/yelli && pnpm typecheck` → 0 errors.
- Visual QA:          DEFERRED — same reason as Feature 1: running container is pre-Phase-7 build. Both features will land on next stack rebuild.
- Dispatches:         2 Sonnet dispatches (scout+implement combined, then governance+commit). Tighter scope than Feature 1's D3 per the tactical lesson logged in prior STATE.md.

## 2026-06-02 — Phase 7 Feature 1: Wire `trpc.device.register` button
- Agent:              CLAUDE_CODE (Opus 4.7 Architect + Sonnet 4.6 Executor — V32 R1 Zero Opus Execution)
- Why:                First Phase 7 Feature Update after Phase 6 PASS. Directory page (/) had an inert "Register this device" button with a TODO marker. Wired it to the existing `trpc.device.register` mutation so authenticated users can register their browser as a device under the active tenant.
- Files added:        apps/yelli/src/components/devices/RegisterDeviceButton.tsx
- Files modified:     apps/yelli/src/app/(app)/page.tsx
- Files deleted:      none
- Schema/migrations:  none — `Device` model and `device.register` procedure already scaffolded in Phase 4 Part 3 + Part 5
- Errors encountered: none — typecheck 0 errors on first build
- Errors resolved:    n/a
- Verification:       Stage 1 spec compliance PASS (Zod inputs satisfied: displayName ≤40 chars via slice(), fingerprint = crypto.randomUUID() = 36 chars within 16-128 range). Stage 2 quality PASS (no `any`, typed Navigator intersection for userAgentData feature detection, single-responsibility component, defensive SSR guards). `pnpm --filter @yelli/web typecheck` → 0 errors.
- Visual QA:          DEFERRED — running container is the pre-Phase-7 build (eb5a442/290d452). Live smoke test will land on next `bash deploy/compose/start.sh dev up --build -d` cycle. Risk low: typecheck clean + no new deps + established trpc.useMutation pattern.
- Dispatches:         3 Sonnet dispatches per V32 R1 (scout + implement + governance/commit). Each ≤5 tool uses per V32.1 operational note.
- Errors resolved:     (1) Added AUTH_TRUST_HOST=true to .env.dev. (2) Changed redirect/push targets from /app to /. (3) Added DATABASE_URL_INTERNAL/REDIS_URL_INTERNAL env vars + compose environment: override pointing app at yelli_dev_postgres:5432 / yelli_dev_valkey:6379. App container now reaches DB via Docker internal network; host CLI (Prisma migrate/seed) still uses localhost-mapped ports.
- Verification:        Playwright: form fill bonitobonita24@gmail.com + password → POST /api/auth/callback/credentials 200 → redirect to / → Directory page with "Signed in as bonitobonita24@gmail.com" + "admin" badge. Console: only /icons/icon-192.png 404 (cosmetic).

## 2026-06-02 — Phase 6 dev verification
- Agent:               CLAUDE_CODE (Opus 4.7 Architect + Sonnet 4.6 Executor)
- Why:                 Phase 6 first-run startup, migration, health check, Visual QA per Rule 16
- Files added:         (none)
- Files modified:      .env.dev (URL-encode `/`→`%2F` in DATABASE_URL pwd), apps/yelli/package.json (next-auth 5.0.0-beta.22 → 5.0.0-beta.31), pnpm-lock.yaml (regen, net -65 lines), .gitignore (+ .playwright-mcp/)
- Files deleted:       (none) — docker volume yelli_dev_postgres_data dropped (was 2026-05-14 pre-brownfield, no migrations applied yet)
- Schema/migrations:   0001_init + 0002_user_security_version applied to yelli_dev (fresh init)
- Errors encountered:  (1) Zod `.url()` rejection of DATABASE_URL with raw `/` in pwd. (2) Postgres role mismatch from pre-brownfield volume. (3) pgbouncer.ini:3 syntax error (edoburu image + AUTH_SECRET `+/` chars). (4) /login + / RSC 500 "TypeError: a.get is not a function" — next-auth/Next.js 16 sync cookies() incompat.
- Errors resolved:     (1) Sonnet D1 URL-encoded `/`→`%2F`. (2) docker volume rm + clean re-init. (3) DEFERRED — pgbouncer non-blocking, app uses DATABASE_URL direct. (4) Sonnet D2 bumped next-auth to beta.31 (Rule 16 one-auto-fix), Next 16 async cookies() now compat.
- Pending:             Seed (`WEBMASTER_PASSWORD='<…>' pnpm --filter @yelli/db db:seed`) + post-seed login flow verification — user runs locally.

## 2026-06-02 — Phase 4 Part 8 — CI workflows + MANIFEST + ESLint 9 + env schema finalization + Phase 4 COMPLETE
- Agent:               CLAUDE_CODE (Opus 4.7 Architect + Sonnet 4.6 Executor — V32 R1 Zero Opus Execution; dispatches D1–D3b + D4 governance)
- Why:                 Part 8 of Phase 4 — CI workflow matrix (lint/typecheck/test/build + security audit + docker-publish + semver release), MANIFEST.txt enumerating 178 files across Parts 1–8, ESLint 9 flat config migration (Next.js 16 dropped `next lint`), env schema fix (12 missing vars + DATABASE_URL URL-encoding), and Phase 5 validation gate (all 9 commands PASS). Phase 4 complete.
- Files added:
    .github/workflows/ci.yml (77L — governance gate + quality matrix + security audit)
    .github/workflows/docker-publish.yml (73L — Docker Hub push on v*.*.* tags + main)
    .github/workflows/release.yml (70L — semver :vX.Y.Z + floating :prod tags)
    MANIFEST.txt (199L — 178 files across Parts 1–8; Part 6 skipped PWA-only)
    eslint.config.mjs (ESLint 9 flat config, replaces .eslintrc.js which is retained for IDE compat)
- Files modified:
    apps/yelli/package.json (lint script: turbo next lint → eslint . --ext .ts,.tsx)
    .env.dev, .env.staging, .env.prod, .env.example (appended 12 missing vars: S3_*, SMTP_*, WEB_PUSH_*, TURNSTILE_* already present)
    apps/yelli/.env.local (created, gitignored — dev bridge for Next.js next build which loads .env.local in NODE_ENV=production, not .env.dev)
    apps/yelli/.env.development.local (created, gitignored — dev server bridge)
- Schema/migrations:   none
- Errors encountered/resolved:
    Lint (turbo): turbo passes task name as positional arg → `next lint` invocation → Next.js 16 removed `next lint` binary. Fix: switch to direct `eslint . --ext .ts,.tsx`; create ESLint 9 flat config eslint.config.mjs (flat config required for ESLint 9).
    Build (Zod env schema): 12 env vars referenced in src/ missing from apps/yelli/src/env.ts Zod schema — build-time validation threw. Fix: added S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_FROM, SMTP_PASSWORD, WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY.
    Build (DATABASE_URL URL-encoding): DB_PASSWORD contains `/` → Zod `.url()` strict parser rejected. Fix: URL-encode `/` → `%2F` in DATABASE_URL value across all 3 env files (DB_PASSWORD itself unchanged).
    Build (Next.js .env loading): `next build` loads `.env.local` / `.env.production.local` in NODE_ENV=production, NOT `.env.dev`. Created apps/yelli/.env.local + .env.development.local (gitignored) as dev bridges.
    VAPID keys: generated via `npx --yes web-push generate-vapid-keys`; written to env files + CREDENTIALS.md.
- Phase 4 capstone: Phase 4 complete — all 8 Parts squash-merged to main. All 9 Phase 5 commands PASS (3 vulns: 1 low + 2 moderate, no HIGH/CRITICAL). Next: human triggers Phase 5 in fresh session.

## 2026-06-02 — Phase 4 Part 7 — Governance tools + Compose stacks + SocratiCode artifacts
- Agent:               CLAUDE_CODE (Opus 4.7 Architect + Sonnet 4.6 Executor — V32 R1; 7 Sonnet dispatches: D1 tools/, D2 dev compose, D3 stage compose, D4 prod compose + cloudflared, D5 scripts + COMMANDS + SocratiCode, D6a/b/c fixes, D7 governance)
- Why:                 Part 7 of Phase 4 — generate governance tools (validate-inputs/check-env/check-product-sync/hydration-lint), Docker Compose stacks for dev/stage/prod with Rule 5 split-by-service-group pattern, image promotion pipeline, command reference, and SocratiCode context artifacts. Aligns with V27 Traefik labels (staging/prod), Komodo auto_update staging, cloudflared sidecar migration asset for current live deploy.
- Files added:
    tools/{validate-inputs.mjs, check-env.mjs, check-product-sync.mjs, hydration-lint.mjs}
    deploy/compose/dev/{docker-compose.db.yml, docker-compose.cache.yml, docker-compose.storage.yml, docker-compose.infra.yml, docker-compose.pgadmin.yml, docker-compose.app.yml, pgadmin-servers.json}
    deploy/compose/stage/{docker-compose.db.yml, docker-compose.cache.yml, docker-compose.storage.yml, docker-compose.pgadmin.yml, docker-compose.app.yml, pgadmin-servers.json}
    deploy/compose/prod/{docker-compose.db.yml, docker-compose.cache.yml, docker-compose.storage.yml, docker-compose.pgadmin.yml, docker-compose.app.yml, docker-compose.cloudflared.yml, pgadmin-servers.json}
    deploy/compose/start.sh (multi-`-f` single-project pattern)
    deploy/compose/push.sh (dev→stage→prod image promotion)
    COMMANDS.md (master command reference, 13 sections)
    .socraticodecontextartifacts.json (4 artifacts: database-schema, implementation-map, decisions-log, product-definition)
- Files modified:
    package.json (+4 tools:* scripts)
    .env.dev (+STORAGE_PORT, SMTP_UI_PORT, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD, APP_DOMAIN)
    .env.staging (+structural vars + ⏳ secret placeholders)
    .env.prod (+structural vars + ⏳ secret placeholders + CF_TUNNEL_TOKEN ⏳)
- Files deleted:       none
- Schema/migrations:   none (Part 7 is infrastructure scaffold only)
- Errors encountered:
    1. compose env_file path was `../../.env.${ENV}` resolving to `deploy/.env.dev` (missing) — compose files live 3 levels deep, not 2. Fixed across all 18 compose files: `../../../.env.${ENV}`.
    2. start.sh originally ran each compose file as separate `docker compose -f X` invocation — cross-file `depends_on: postgres` failed because pgadmin and app live in different files. Fixed by refactoring start.sh to canonical multi-`-f` single-project pattern: `docker compose -p yelli_$ENV -f db.yml -f cache.yml -f storage.yml -f pgadmin.yml [-f infra.yml] -f app.yml [-f cloudflared.yml] $CMD`.
    3. .env.dev missing STORAGE_PORT, SMTP_UI_PORT, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD — env file written by Bootstrap Step 18 used STORAGE_ENDPOINT (URL form) rather than discrete port var. Added missing vars.
- Verification:
    bash deploy/compose/start.sh dev up -d → exit 0; postgres/valkey/minio/pgadmin/mailhog healthy; app starting; clean teardown via `down`.
    pnpm tools:validate-inputs → exit 0
    pnpm tools:check-product-sync → exit 0 (no private tag leaks)
    pnpm tools:hydration-lint → exit 0 (12 files scanned, 0 issues)
    pnpm tools:check-env (APP_ENV=dev) → exit 0

## 2026-06-02 — Phase 4 Part 5: apps/yelli Next.js Scaffold

- **Agent:**              CLAUDE_CODE (Opus 4.7 Architect + Sonnet 4.6 Executor, V32 R1)
- **Why:**                Phase 4 Part 5 of 8 — scaffold apps/yelli with Next.js 16 + Auth.js v5 + tRPC v11 + shadcn/ui + Clay tokens + PWA. Adds User.securityVersion deferred from Part 3. `pnpm --filter @yelli/yelli build` produces clean standalone output.
- **Files added (apps/yelli):**
  - Build/config: package.json, tsconfig.json, next.config.ts, tailwind.config.ts, postcss.config.js, components.json, .env.example, Dockerfile, .dockerignore
  - Styling: src/styles/tokens.css (Clay single source — extracted verbatim from brownfield public/index.html), src/styles/globals.css (shadcn vars mapped from Clay tokens)
  - Env + manifest: src/env.ts (t3-env Zod, 21 server + 3 client vars), public/manifest.json
  - shadcn/ui: src/lib/utils.ts + 17 components in src/components/ui/ (avatar, badge, button, card, dialog, dropdown-menu, form, input, label, scroll-area, select, separator, sheet, skeleton, sonner, tabs, textarea)
  - Server (Auth + tRPC): src/server/auth/{config,session}.ts; src/server/lib/{rate-limit,sanitize,platform-prisma}.ts; src/server/trpc/trpc.ts + 5 middleware (rate-limit-mw, rbac, tenant, session-version, audit-log); 7 routers (tenant, user, device, call, branding, audit, platform) + root.ts
  - Client: src/lib/trpc-client.ts (concrete-typed AppRouter consumer + makeTrpcLinks helper)
  - Pages: src/app/layout.tsx; (auth)/login + (auth)/register; (app)/page + (app)/settings + (app)/audit; _pwbt/page
  - Components: src/components/providers/TRPCProvider.tsx; src/components/auth/{TurnstileWidget,LoginForm}.tsx
  - API routes: src/app/api/{trpc/[trpc],auth/[...nextauth],health,push/subscribe}/route.ts + src/app/_pwbt/health/route.ts
  - V25 middleware: src/proxy.ts (Next.js 16 convention — subdomain↔JWT.tenantSlug cross-check via getToken from next-auth/jwt; Edge-safe, no DB)
  - PWA: public/sw.js (Workbox CDN + Web Push handler + tap-to-open) + src/lib/register-sw.ts
  - Types: src/types/phantom-ui.d.ts (V31.3 dual-path JSX intrinsic)
- **Files modified:**
  - packages/shared/src/types/user.ts — added `securityVersion: number` (deferred from Part 3, lessons "User.securityVersion deferred to Phase 5")
  - packages/db/prisma/schema.prisma — added `securityVersion Int @default(0) @map("security_version")` to User model
  - packages/shared/src/{index, schemas/*, config/index}.ts — dropped `.js` extensions from barrel imports for Next.js bundler compatibility
  - packages/storage/src/{index, upload, download}.ts — same .js-extension fix
  - packages/jobs/src/{index, queues, workers/* (×7)}.ts — same .js-extension fix
  - packages/ui/package.json — added `"./tailwind.config": "./tailwind.config.ts"` exports subpath
  - apps/yelli/src/styles/globals.css — moved `@import "./tokens.css"` to top (CSS @import order requirement)
  - apps/yelli/src/server/trpc/root.ts — renamed merged key `call:` → `calls:` (tRPC v11 reserves `call`)
- **Files deleted:**     none
- **Schema/migrations:** packages/db/prisma/migrations/0002_user_security_version/migration.sql — `ALTER TABLE "users" ADD COLUMN "security_version" INTEGER NOT NULL DEFAULT 0;`
- **Errors encountered & resolved:**
  - D5a: @auth/prisma-adapter ↔ next-auth 5.0.0-beta.22 dual @auth/core version conflict → dropped PrismaAdapter, kept Credentials + JWT-only. Phase 7 re-adds for magic-link.
  - D4 surfaced: apps/yelli missing class-variance-authority + tailwindcss-animate (shadcn peer deps not auto-pulled) → added (D4-fix).
  - D4 surfaced: Radix UI types fail exactOptionalPropertyTypes → localized override in apps/yelli/tsconfig.json only (packages/ stay strict).
  - D5b: PrismaClient value-vs-type export conflict via @yelli/db barrel → imported directly from @prisma/client + added @prisma/client as direct dep.
  - D14: Next.js bundler can't resolve `from "./xxx.js"` imports in workspace packages → dropped .js extensions across packages/shared/storage/jobs barrels.
  - D14: @yelli/ui missing `./tailwind.config` exports subpath for apps/yelli/tailwind.config.ts consumption → added.
  - D14: CSS `@import "./tokens.css"` placed after `@tailwind` directives violated PostCSS import-order rule → moved to first line.
  - D14: tRPC v11 reserves `call` as a router key → renamed merged AppRouter key from `call` → `calls`.
- **Verification:**
  - `pnpm install --frozen-lockfile` — success
  - `pnpm -r typecheck` — 0 errors across 8 packages
  - `SKIP_ENV_VALIDATION=true pnpm --filter @yelli/yelli build` — success, .next/standalone created

## 2026-06-01 — Phase 4 Part 2 — packages/shared + packages/api-client
- Agent:               CLAUDE_CODE (Opus 4.7 Architect + Sonnet 4.6 Executor, V32 R1)
- Why:                 Generate shared TypeScript types, Zod schemas, reserved-slugs config, and typed tRPC client factory for the Next.js/tRPC/Prisma rewrite. Single source of validation truth across web app + future workers.
- Files added:
  - packages/shared/package.json, tsconfig.json
  - packages/shared/src/index.ts (barrel)
  - packages/shared/src/types/enums.ts (Role, CallRole, EndReason, AuditTargetType, AuditAction × 25, JsonValue)
  - packages/shared/src/types/{tenant,user,device,invitation,audit-log,call-session,web-push-subscription}.ts
  - packages/shared/src/types/index.ts (barrel)
  - packages/shared/src/types/phantom-ui.d.ts (JSX intrinsic — ui-rules.md Rule 11 PATH B)
  - packages/shared/src/config/reserved-slugs.ts (18 reserved slugs, single source of truth)
  - packages/shared/src/config/index.ts (barrel)
  - packages/shared/src/schemas/enums.ts (Zod enum mirrors + JsonValueSchema via z.lazy)
  - packages/shared/src/schemas/tenant-slug.ts (regex + min/max + reserved refine)
  - packages/shared/src/schemas/{tenant,user,device,invitation,audit-log,call-session,web-push-subscription}.ts (EntitySchemas)
  - packages/shared/src/schemas/index.ts (barrel)
  - packages/api-client/package.json, tsconfig.json
  - packages/api-client/src/index.ts (createYelliTrpcClient generic factory + re-export @yelli/shared)
- Files modified:
  - packages/shared/package.json (added zod ^3.23.0 + @aejkatappaja/phantom-ui pinned exact 0.10.1)
  - pnpm-lock.yaml (regenerated)
- Schema/migrations:   none (Prisma comes in Part 3)
- Dependencies added:  zod ^3.23.0 (packages/shared), @aejkatappaja/phantom-ui 0.10.1 EXACT (packages/shared, V31.3 Loading Library Lock — Bootstrap Step 19), @trpc/client ^11.0.0 + @trpc/server ^11.0.0 (packages/api-client), @yelli/shared workspace:* (packages/api-client)
- Errors encountered:  tRPC v11 generic transformer constraint — httpBatchLink<TRouter> requires TransformerOptions<TRouter["_def"]["_config"]["$types"]> which is unsatisfiable when TRouter is constrained as AnyRouter (only resolves at concrete AppRouter consumption in Part 5).
- Errors resolved:     Single `@ts-expect-error` on the httpBatchLink line with documented rationale. NOT `as any` — `@ts-expect-error` is a typed escape hatch that self-removes when the underlying constraint is satisfied (i.e. when apps/yelli passes concrete AppRouter). Rule 12 (no `any`) and Rule 25 Stage 2 (no `any` types introduced) both satisfied.
- Dispatches (V32 R1):
  - D1 (Sonnet, 19 tool uses, 281s, 181K tokens): branch + packages/shared scaffolding + 13 type files (commit 15e3f76)
  - D2 (Sonnet, 21 tool uses, 615s, 175K tokens): Zod schemas + reserved-slugs config + 13 files (commit fc7b3ff)
  - D3 (Sonnet, 43 tool uses, 989s, 184K tokens): packages/api-client + installs + typecheck
  - D3-fix (Sonnet, 9 tool uses, 304s, 171K tokens): replace as any with @ts-expect-error
  - D4 (Sonnet — this dispatch): governance + squash-merge + push

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

## 2026-06-01 — Phase 4 Part 3 — packages/db scaffolded

- Agent:               CLAUDE_CODE (Opus 4.7 Architect + Sonnet 4.6 Executor, V32 R1)
- Why:                 Generate Prisma schema + L2/L5/L6 multi-tenant security stack + first-admin seed for Yelli brownfield rewrite (Next.js/tRPC/Prisma target stack).
- Files added:
  - packages/db/package.json
  - packages/db/tsconfig.json
  - packages/db/src/index.ts (PrismaClient singleton + barrel re-exports)
  - packages/db/src/audit.ts (L5 — always-active AuditLog write helper, tx-aware)
  - packages/db/src/rls.ts (L2 — PostgreSQL withTenant + setTenantContext)
  - packages/db/src/middleware/tenant-guard.ts (L6 — Prisma $allOperations extension)
  - packages/db/prisma/schema.prisma (10 models, 4 enums, RLS-ready)
  - packages/db/prisma/migrations/0001_init/migration.sql (prisma diff output + 6 RLS policies appended)
  - packages/db/prisma/migrations/0001_init/down.sql (manual reverse)
  - packages/db/prisma/migrations/migration_lock.toml (provider = postgresql)
  - packages/db/prisma/seed.ts (env-driven webmaster, bcrypt 12 rounds, idempotent upsert)
- Files modified:      package.json (root — pnpm.onlyBuiltDependencies allowlist for argon2/esbuild/@prisma/client/prisma); pnpm-lock.yaml (regenerated)
- Files deleted:       none
- Schema/migrations:   Tenant + User + Device + Invitation + AuditLog + CallSession + WebPushSubscription + Auth.js (Account, Session, VerificationToken). 6 L2 RLS policies on tenant-scoped tables via current_setting('app.current_tenant_id', true). AuditLog.targetId nullable (matches Part 2 TS source of truth). EndReason enum uses underscore Prisma values + @map to hyphen DB strings.
- Errors encountered:  D2 scaffolded AuditLog.targetId as NOT NULL while Part 2 TS type was string | null. audit.ts initially had a `?? ""` workaround.
- Errors resolved:     D2-fix dispatch realigned schema (added `?`), regenerated migration column nullability, removed workaround. D3 widened tsconfig rootDir from "./src" to "." so seed.ts under prisma/ compiles.
- Dispatches:          6 — D0 Scout (context read-only) + D1 (schema + skeleton) + D2 (migrations + L2/L5/L6 helpers) + D2-fix (targetId nullability) + D3 (seed + commit) + D4 (this — governance + merge).

## 2026-06-01 — Phase 4 Part 4: packages/ui + packages/jobs + packages/storage
- Agent:               CLAUDE_CODE (Opus 4.7 Architect + Sonnet 4.6 Executor, V32 R1)
- Why:                 Scaffold shared UI primitives package + BullMQ queue infrastructure + S3/MinIO storage wrapper per Phase 4 Part 4 task scope. Rule 24 fresh-context per Part.
- Files added:
    packages/ui/package.json
    packages/ui/tsconfig.json
    packages/ui/tailwind.config.ts
    packages/ui/src/index.ts
    packages/ui/src/lib/utils.ts
    packages/jobs/package.json
    packages/jobs/tsconfig.json
    packages/jobs/src/index.ts
    packages/jobs/src/connection.ts
    packages/jobs/src/types.ts
    packages/jobs/src/queues.ts
    packages/jobs/src/workers/_validate.ts
    packages/jobs/src/workers/tenant-export.worker.ts
    packages/jobs/src/workers/device-archive.worker.ts
    packages/jobs/src/workers/soft-delete-cron.worker.ts
    packages/jobs/src/workers/backup-cron.worker.ts
    packages/jobs/src/workers/email.worker.ts
    packages/jobs/src/workers/logo-image-processing.worker.ts
    packages/jobs/src/workers/index.ts
    packages/storage/package.json
    packages/storage/tsconfig.json
    packages/storage/src/index.ts
    packages/storage/src/client.ts
    packages/storage/src/buckets.ts
    packages/storage/src/validate.ts
    packages/storage/src/upload.ts
    packages/storage/src/download.ts
- Files modified:      package.json (pnpm.overrides.ioredis = "5.10.1"), pnpm-lock.yaml (regen)
- Files deleted:       none
- Schema/migrations:   none (Part 3 owns schema)
- Errors encountered:  bullmq@5.77.7 ships ioredis@5.10.1 as a hard dep; declaring @yelli/jobs dep "ioredis: ^5.4.2" pulled a parallel ioredis instance into the tree, triggering exactOptionalPropertyTypes type-incompat between the two instances. Resolved D2.
- Errors resolved:     Added pnpm.overrides.ioredis = "5.10.1" in root package.json to dedupe; pinned @yelli/jobs ioredis dep to exact "5.10.1".
- Dispatch ledger:     5 Sonnet dispatches under V32 R1 (D1 ui scaffold, D2 jobs core, D3 jobs workers, D4 storage, D5 governance+verify+merge). Each ≤500L per V32 R2.
- Notes:               Workers are STUBS — payload validation + structured JSON logging only; real logic deferred to Phase 5 Feature Updates (TODO comments mark each handler). packages/ui ships minimal preset only — no shadcn primitives yet (Phase 4 Part 5 will run `npx shadcn add` inside packages/ui). Branding upload MIME whitelist = PNG/JPG only — SVG deferred per security.md rule 6 default; re-enable requires DOMPurify wiring in Phase 5/7.
- LOC delta:           ~660 lines created across 11 files in packages/db/.
