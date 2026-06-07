# Implementation Map — Yelli

## Current State — Post Clean-Slate (V32.6.1 canary rebuild, 2026-06-07)

Filesystem: clean-slate. No apps/, packages/, deploy/, inputs.yml.
Phase: pre-Phase 0. Next: Bootstrap → Phase 2 → Phase 3.

### Phase 3 — Spec files (V32.6.1 canary rebuild)
- ✅ Phase 3 — Spec files generated: complete 2026-06-07
  - inputs.yml (151L), inputs.schema.json (274L), scripts/sync-credentials-to-env.sh (99L)
  - 4 env files validated existing (survived clean-slate wipe with AI-generated credentials intact)
  - 5 decisions locked in DECISIONS_LOG.md (port base 46838, turnstile=false, a11y=none, payment=none, vibe_test=true)
  - Dispatch ratio: 4 sonnet_writes / 0 opus_writes = ∞ (PASS)

### Phase 3.3 — Interactive Prototype & Simulation (V32.6, multi-wave)
- 🚧 Phase 3.3 — IN PROGRESS (Wave 2/N complete, foundation laid 2026-06-08)
  - Wave 2A — Scaffold: Next.js 14 App Router under prototype/ (10 files, 315L). Dev port 4838. Tailwind theme wired to CSS-var tokens from DESIGN.md (colors, radius, shadow).
  - Wave 2B — Simulated data layer: prototype/src/lib/sim/ (6 files, 821L) — single swap boundary. 6 entity repos (devices/callSessions/users/tenants/invitations/auditLog) mirror inputs.schema.json shapes. localStorage persistence with cross-tab + same-tab pub/sub. Clock helper for 90d archive time-travel. ⚠ Dispatch overshot V32 R2 500L gate (repo.ts alone 448L) — accepted once for foundational wave; logged in lessons.md.
  - Wave 2 — Design EXPAND: docs/DESIGN.md +37L (motion + shadows + z-index) per V32.5 INHERIT-not-REPLACE contract. No existing tokens modified.
  - 1 decision locked in DECISIONS_LOG.md: simulation technique (in-memory + localStorage + 6-namespace barrel; Phase 4 swaps exactly those 6 namespaces for real tRPC calls).
  - Dispatch ratio this wave: 3 sonnet_writes / 0 opus_writes = ∞ (PASS).
  - Foundation laid: scaffold boots, sim layer importable. UI does not yet consume sim/ — Wave 3 wires first screen.
- ⏳ Wave 3 — UI primitives + Calling flow (PRODUCT.md §3 Flow A): NEXT
- ⏳ Waves 4–11 — Remaining 8 §3 Core User Flows: PENDING (one per wave, strict R2)
- ⏳ Wave N — /design-review + /design-refine (flagged only): PENDING
- ⏳ Wave N+1 — docs/PROTOTYPE.md + client sign-off in DECISIONS_LOG.md: PENDING (gate-closure)
- ⏳ Phase 3.5 — Execution Plan: BLOCKED by Phase 3.3 gate-closure

## Archived — Pre-Clean-Slate (V31 baseline, archived 2026-06-07)

Reference-only. No code from the sections below survives on the filesystem after commit `0a94f48` (clean-slate wipe). Retained so the V32.6.1 rebuild can re-reference proven decisions without re-deriving them.

Last updated: 2026-06-02 by CLAUDE_CODE (Phase 4 Part 8 complete — CI workflows + MANIFEST + ESLint 9 + env schema; Phase 4 COMPLETE 8/8)
Current phase: Phase 4 complete — awaiting human trigger for Phase 5
Branch: scaffold/part-8 (pending squash-merge)

## Current State (May 2026 — pre-Spec-Driven, retained as Phase 4 reference)

### Backend
- `server.js` (385 lines) — vanilla Node.js signaling server
  - Modules: HTTP/HTTPS server, WebSocketServer (`ws` library)
  - Static file serving (`public/`)
  - Admin UI gate: Basic Auth at `/_pwbt/` (`ADMIN_USER`/`ADMIN_PASSWORD` env)
  - In-memory device registry: `Map<id, ws>`
  - Self-signed TLS certs: `certs/cert.pem` + `certs/key.pem` (gen-cert.sh)
  - Branding persistence: `data/branding.json` + `data/logo.*`
  - Update mechanism: `deploy/windows/apply-update.ps1` (Windows-only)

### Frontend
- `public/index.html` (47KB single file)
  - Vanilla HTML + inline CSS + inline JS
  - Clay design tokens applied inline as CSS variables (visual reference for Phase 4 shadcn var mapping)
  - WebRTC peer connection logic
  - WebSocket signaling client
  - Device directory UI
  - Call modal + mute/cam controls
- `public/_pwbt/` — admin UI templates
- `public/sounds/` — ringtones

### Containerization
- `Dockerfile` (single-stage, node:24-alpine, ~190 bytes) — copies package.json + server.js + public/, `npm ci --omit=dev`, CMD: node server.js
- `compose.yaml` (756 bytes) — Service 1: yelli (container_name yelli-maes). Service 2: cloudflared sidecar (Cloudflare Tunnel). Internal bridge network. Healthcheck on `/`.

### Deployment
- Live at `yelli-maes.powerbyte.app` via Komodo + Cloudflare Tunnel
- Manual redeploy: `git pull + docker compose build --no-cache + up --force-recreate`
- LAN install: `Install-Yelli.cmd` + `Install-Yelli.ps1` (Windows robocopy)
- update-source clone pattern for in-place upgrades

### Scripts
- `scripts/gen-cert.sh` — self-signed TLS cert generation
- `scripts/tunnel.sh` — cloudflared quick-tunnel
- `fly.toml` — Fly.io config (unused; deploy moved to cloudflared per memory)

### Dependencies
- Production: `ws@^8.16.0` (only dependency)
- Node: 24.x (alpine)

## Target State (per docs/PRODUCT.md — Phase 4 Parts 1–8 deliverables)

### Phase 4 Part 1 — Root config (DELTA from current)
- Add: pnpm-workspace.yaml, turbo.json, tsconfig.base.json
- Add: .editorconfig, .prettierrc, .eslintrc.js, .nvmrc
- Replace: package.json (currently 221 bytes minimal) → root package.json with turbo + workspaces

### Phase 4 Part 2 — packages/shared + packages/api-client
- Add: packages/shared/src/types/ (TypeScript types for all 8 entities)
- Add: packages/shared/src/schemas/ (Zod schemas)
- Add: packages/api-client/

### Phase 4 Part 3 — packages/db ✅ COMPLETE (2026-06-01)
- ✅ packages/db/prisma/schema.prisma — 10 models (7 Yelli entities: Tenant, User, Device, Invitation, AuditLog, CallSession, WebPushSubscription + 3 Auth.js: Account, Session, VerificationToken) + 4 enums (Role, CallRole, AuditTargetType, EndReason) + @@unique/@@index per Part 2 TS source of truth
- ✅ packages/db/prisma/migrations/0001_init/migration.sql — prisma migrate diff output + 6 L2 RLS policies appended (tenant_isolation USING current_setting('app.current_tenant_id', true) on User/Device/Invitation/CallSession; permissive on AuditLog + WebPushSubscription where tenantId is nullable)
- ✅ packages/db/prisma/migrations/0001_init/down.sql — manual reverse migration
- ✅ packages/db/prisma/migrations/migration_lock.toml — provider = postgresql
- ✅ packages/db/prisma/seed.ts — env-driven webmaster (process.env.WEBMASTER_PASSWORD ≥12 chars + bcrypt 12 rounds), idempotent upsert of `_pwbt` reserved platform tenant + webmaster user (bonitobonita24@gmail.com, role: admin)
- ✅ packages/db/src/audit.ts — L5 always-active writeAuditLog (tx-aware, idempotent payload handling)
- ✅ packages/db/src/rls.ts — L2 withTenant + setTenantContext via PG SET LOCAL
- ✅ packages/db/src/middleware/tenant-guard.ts — L6 Prisma.defineExtension + $allOperations (NOT method list — security.md mandate); 5 EXCLUDED_MODELS (Tenant/AuditLog/Account/Session/VerificationToken)
- ✅ packages/db/src/index.ts — PrismaClient singleton + barrel re-exports
- ✅ packages/db/package.json + tsconfig.json (rootDir widened to "." for seed.ts under prisma/)
- NOTE: migration not yet applied to live DB — Phase 6 task (pnpm db:migrate after Docker services start)
- NOTE: User.securityVersion deferred to Phase 5 (Auth.js wiring) — not in Part 2 TS types yet

### Phase 4 Part 4 — packages/ui + packages/jobs + packages/storage ✅ COMPLETE (2026-06-01)

**packages/ui — shareable Tailwind preset + Clay token bridge + cn() helper**
- ✅ package.json (class-variance-authority, clsx, lucide-react, tailwind-merge deps; react/react-dom peerDeps; tailwindcss devDep)
- ✅ tsconfig.json (extends base, JSX react-jsx)
- ✅ tailwind.config.ts (shareable preset — Clay token color bridge via `hsl(var(--clay-*))`, radii from --radius-button/--radius-card, font-sans from --font-sans). Apps consume via `presets: [require("@yelli/ui/tailwind-preset")]`
- ✅ src/lib/utils.ts (standard shadcn `cn()` helper using clsx + tailwind-merge)
- ✅ src/index.ts (barrel)
- NOTE: NO shadcn primitives in this package yet — Phase 4 Part 5 will run `npx shadcn@latest init` + add base components (button, card, dialog, input, label, select, textarea, toast, sonner, skeleton, form, sidebar, sheet) targeting packages/ui per shadcn monorepo pattern. tokens.css single source lives in apps/yelli/src/styles/tokens.css per DECISIONS_LOG "LOCKED: Design Tokens".

**packages/jobs — BullMQ queue infrastructure (workers are STUBS)**
- ✅ package.json (bullmq ^5.34, ioredis 5.10.1 exact pin to match bullmq's bundled version)
- ✅ tsconfig.json
- ✅ src/connection.ts (getConnection singleton + createWorkerConnection per-worker + closeAllConnections graceful shutdown; maxRetriesPerRequest: null for blocking commands)
- ✅ src/types.ts (typed payloads for all 6 queues — TenantExport, DeviceArchiveCron, SoftDeleteHardDeleteCron, BackupCron, Email, LogoImageProcessing; every payload includes tenantId + userId per security.md Queue Safety rule 1)
- ✅ src/queues.ts (Queue<T> registry with shared defaultJobOptions: 5 attempts + exponential backoff 5s + removeOnFail: false for DLQ inspection; closeAllQueues helper)
- ✅ src/workers/_validate.ts (assertTenantUser shared guard + structured JSON log helper)
- ✅ src/workers/{tenant-export, device-archive, soft-delete-cron, backup-cron, email, logo-image-processing}.worker.ts (6 worker stubs — payload validation + log + TODO Phase 5 marker)
- ✅ src/workers/index.ts (startAllWorkers + main entrypoint with SIGTERM/SIGINT graceful shutdown for `node dist/workers/index.js` deploy)
- ✅ src/index.ts (barrel — re-exports connection, queues, types, startAllWorkers)
- 6 queues match inputs.yml + DECISIONS_LOG "LOCKED: Jobs + Queues" + "LOCKED: Database Backup": tenant-export, device-archive-cron, soft-delete-hard-delete-cron, backup-cron, email, logo-image-processing
- NOTE: Real worker logic deferred to Phase 5+ Feature Updates (e.g. pg_dump+S3 upload, sharp image resize). Backup-cron pinned to `_pwbt` tenant + `system` user per V25 cron rule (whole-DB backup, not per-tenant iteration).

**packages/storage — S3/MinIO wrapper with tenant scoping**
- ✅ package.json (@aws-sdk/client-s3 ^3.717, @aws-sdk/s3-request-presigner)
- ✅ tsconfig.json
- ✅ src/client.ts (S3Client factory — MinIO endpoint + forcePathStyle for dev, native S3 for prod; reads STORAGE_ENDPOINT/REGION/ACCESS_KEY/SECRET_KEY env)
- ✅ src/buckets.ts (typed BUCKETS registry: uploads/backups/exports per inputs.yml `storage.buckets`)
- ✅ src/validate.ts (MIME whitelist PNG+JPEG only + magic byte verification + 2 MiB size limit + FileValidationError class; SVG INTENTIONALLY EXCLUDED per security.md rule 6)
- ✅ src/upload.ts (uploadBrandingImage with tenant-scoped path `${tenantId}/${entityType}/${randomFilename}.${ext}` per security.md File Upload Safety rule 4+5; tenantId regex guard + entityType kebab-case guard; CacheControl no-store defense-in-depth)
- ✅ src/download.ts (getBrandingSignedUrl with session tenantId match against storage key prefix per security.md rule 8; default 15-min expiry; getExportSignedUrl 24h variant for tenant-export queue per DECISIONS_LOG; StorageAccessError → generic "Not found" to prevent existence leak)
- ✅ src/index.ts (barrel)
- NOTE: SVG branding upload deferred to Phase 5/7 — needs DOMPurify wiring (security.md rule 6 default).

### Phase 4 Part 5 — apps/yelli Next.js Scaffold (2026-06-02) ✅ COMPLETE
- Branch: scaffold/part-5 (squash-merged → main)
- Full Next.js 16 + Auth.js v5 + tRPC v11 + shadcn/ui scaffold; 17 shadcn primitives; Clay tokens single source (tokens.css extracted from brownfield public/index.html); V25 anti-tenant-switching middleware (src/proxy.ts, Next.js 16 convention); 7 tRPC routers + 5 middleware (rate-limit, rbac, tenant, session-version, audit-log); Auth.js JWT Credentials (no PrismaAdapter — dual @auth/core conflict); platform/_pwbt isolated client (platform-prisma.ts, no L6 guard); PWA Workbox CDN + Web Push stub; Dockerfile 3-stage standalone; User.securityVersion from Part 3 deferral landed (packages/shared + schema.prisma + migration 0002)
- Verification: `pnpm -r typecheck` 0 errors across 8 packages; `SKIP_ENV_VALIDATION=true pnpm --filter @yelli/yelli build` success (.next/standalone created)
- Key decisions locked: Auth.js without PrismaAdapter; apps/yelli exactOptionalPropertyTypes:false (Radix UI); Next.js 16 proxy.ts convention; tRPC AppRouter key `calls` (not `call`); workspace barrels no .js extensions
- Phase 4 progress: 5/8 complete (Parts 1–5 done; Part 6 SKIPPED PWA-only; Part 7 tools+deploy; Part 8 CI+governance)

### Phase 4 Part 5 — apps/yelli (Next.js) [PLANNED — superseded by ✅ above]
- Add: Next.js 16 App Router scaffold
- Add: src/server/trpc/ (5-step middleware chain + tenant-scoped routers + Super-Admin isolated router)
- Add: src/server/auth/ (Auth.js v5 config)
- Add: src/middleware.ts (V25 tenant resolution + anti-tenant-switching cross-check)
- Add: shadcn/ui base components via `npx shadcn add`
- Add: src/styles/tokens.css (Clay tokens single source) + tokens.ts hand-maintained
- Add: PWA Workbox config + Web Push server
- Add: Rate limiter (rateLimiters.public/auth/api/upload tiers)
- Add: HTTP security headers in next.config.ts
- Add: src/server/lib/sanitize.ts (DOMPurify)
- REWRITE: server.js logic → Next.js Route Handlers + tRPC WebSocket subscription
- REWRITE: public/index.html → Next.js pages + shadcn components (Clay aesthetic preserved per DESIGN.md)
- RETAIN: Clay tokens in public/index.html as visual reference for shadcn variable mapping during Phase 4 Part 5

### Phase 4 Part 6 — apps/mobile (SKIPPED)
- Per PRODUCT.md: PWA web only, no native mobile app.

### Phase 4 Part 7 — tools/ + deploy/compose/ + scripts/ ✅ COMPLETE (2026-06-02)
✅ Phase 4 Part 7 — Governance tools + Compose stacks (done 2026-06-02)
   - tools/ (4 .mjs governance tools, wired to pnpm scripts)
   - deploy/compose/{dev,stage,prod}/ (20 compose files + 3 pgadmin-servers.json + start.sh + push.sh)
   - COMMANDS.md (master reference)
   - .socraticodecontextartifacts.json (4 artifacts indexed)
   - Verified: dev stack up→healthy→down cleanly

- Add: tools/validate-inputs.mjs, check-env.mjs, check-product-sync.mjs, hydration-lint.mjs
- Add: deploy/compose/dev|stage|prod/ split compose files (db, cache, storage, infra, app, pgadmin)
- Update: existing compose.yaml → migrate to deploy/compose/prod/ pattern with cloudflared retained
- Add: deploy/compose/start.sh + push.sh
- Add: COMMANDS.md
- Add: scripts/sync-credentials-to-env.sh (V30)
- Add: scripts/export-lan-tenant.sh + scripts/reset-admin-passphrase.sh
- Add: src/config/reserved-slugs.ts (18 reserved names, single source for validator + Traefik)
- Add: tests/perf/signaling.k6.js (k6 perf harness)
- Add: status-page/ repo scaffold (Cloudflare Pages, manual updates)
- RETAIN: deploy/windows/apply-update.ps1, Install-Yelli.cmd, Install-Yelli.ps1 (LAN distribution)
- RETAIN: scripts/gen-cert.sh, scripts/tunnel.sh (LAN HTTPS cert + dev tunnel)

### Phase 4 Part 8 — CI + governance + MANIFEST + SocratiCode index ✅ COMPLETE (2026-06-02)
✅ Phase 4 Part 8 — CI workflows + MANIFEST + ESLint 9 + env schema (done 2026-06-02)
- .github/workflows/ci.yml — governance gate (validate-inputs, check-env, check-product-sync) → quality matrix [lint, typecheck, test, build] parallel → security audit (blocks on HIGH/CRITICAL CVE)
- .github/workflows/docker-publish.yml — Docker Hub multi-platform push; tags: :staging-latest (Komodo auto-update) + :latest (manual prod deploy) + :sha-{short} (immutable per-commit)
- .github/workflows/release.yml — semver release workflow; tags: :vX.Y.Z + floating :prod on v*.*.* git tags
- MANIFEST.txt — 178 files enumerated across Parts 1–8; Part 6 SKIPPED (PWA-only, no native mobile)
- eslint.config.mjs — ESLint 9 flat config; apps/yelli/package.json lint script updated to `eslint . --ext .ts,.tsx` (Next.js 16 removed `next lint`)
- env schema finalized — 12 missing vars added to apps/yelli/src/env.ts (S3_*, SMTP_*, WEB_PUSH_*); DATABASE_URL `/` → `%2F` URL-encoding; apps/yelli/.env.local + .env.development.local added (gitignored, Next.js build bridges)
- Phase 5 validation gate: all 9 commands PASS (pnpm install / validate-inputs / check-env / check-product-sync / lint / typecheck / test / build / audit); 3 vulns (1 low + 2 moderate, no HIGH/CRITICAL)
- SocratiCode index: pending human trigger (`codebase_index {}` after fresh session)

## Migration Notes
- migration.brownfield: true in inputs.yml
- Existing live deployment at yelli-maes.powerbyte.app stays operational during Phase 4
- Phase 4 builds in parallel branches; cutover after staging verification + perf baseline
- Pre-existing data (data/branding.json) migration: one-shot script in Phase 4 Part 3 seed
- LAN customers running the existing vanilla edition continue working; v2 LAN image (Spec-Driven build) released after Cloud cutover

## Phase Status
- ✅ Phase 0 Bootstrap (Brownfield Adoption-mode via Prompt 1.5.4): complete 2026-06-01
- ✅ Phase 2 Operational Interview: complete 2026-06-01 (inputs.yml filled, CREDENTIALS.md written, .env.{dev,staging,prod} generated)
- ✅ Phase 4 Part 1 — Root config: complete 2026-06-01 (pnpm-workspace, turbo, tsconfig.base, eslintrc, prettierrc, editorconfig, nvmrc)
- ✅ Phase 4 Part 2 — packages/shared + packages/api-client: complete 2026-06-01 (7 entity types + Zod schemas + reserved-slugs + phantom-ui pinned 0.10.1 EXACT + tRPC client factory)
- ✅ Phase 4 Part 3 — packages/db: complete 2026-06-01 (Prisma schema + L2/L5/L6 security stack + webmaster seed; workspace typecheck 0 errors)
- ✅ Phase 4 Part 4 — packages/ui + packages/jobs + packages/storage: complete 2026-06-01 (Tailwind preset + 6 BullMQ queues with worker stubs + S3/MinIO wrapper; workspace typecheck 0 errors)
- ✅ Phase 4 Part 5 — apps/yelli (Next.js scaffold): complete 2026-06-02
- ❌ Phase 4 Part 6 — SKIPPED (PWA-only, no native mobile)
- ✅ Phase 4 Part 7 — tools/ + deploy/compose/ + SocratiCode artifacts: complete 2026-06-02
- ✅ Phase 4 Part 8 — CI workflows + MANIFEST + ESLint 9 + env schema: complete 2026-06-02 (8/8 — COMPLETE)

**Phase 4 COMPLETE — all 9 Phase 5 validation commands PASS. Next: human triggers Phase 5 in fresh session.**
- ✅ Phase 5: validation PASS — 2026-06-02 — 9/9 commands clean (0 lint, 7/7 typecheck, build OK, 0 HIGH/CRITICAL)
- ✅ Phase 6 (dev verification): PASS-WITH-PENDING-SEED — 2026-06-02 — all containers healthy, migrations applied, /api/health 200, /login interactive. Login-flow verification pending seed.
