# Implementation Map — Yelli

Last updated: 2026-06-01 by CLAUDE_CODE (Prompt 1.5.4 brownfield adoption)
Current phase: Phase 0 BROWNFIELD ADOPTION complete
Branch: chore/adopt-spec-driven

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

### Phase 4 Part 3 — packages/db
- Add: packages/db/prisma/schema.prisma (8 entities: Tenant, User, Device, Invitation, AuditLog, CallSession, WebPushSubscription + Auth.js Session/VerificationToken)
- Add: Initial migration with RLS scaffolding
- Add: Seed script (webmaster account + dev tenants)
- Add: src/audit.ts (L5 AuditLog write helper, always-active)
- Add: src/middleware/tenant-guard.ts (L6 Prisma `$allOperations` extension)

### Phase 4 Part 4 — packages/ui + packages/jobs + packages/storage
- Add: packages/ui/ (shadcn/ui + Clay tokens + Tailwind config)
- Add: packages/jobs/ (BullMQ workers: tenant.export, device-archive cron, soft-delete cron, backup cron)
- Add: packages/storage/ (MinIO/S3 typed wrapper)

### Phase 4 Part 5 — apps/yelli (Next.js)
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

### Phase 4 Part 7 — tools/ + deploy/compose/ + scripts/
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

### Phase 4 Part 8 — CI + governance + MANIFEST + SocratiCode index
- Add: .github/workflows/ci.yml (governance + quality + security audit)
- Add: .github/workflows/docker-publish.yml (push to Docker Hub `powerbyteit/yelli:vX.Y.Z` + `:prod`)
- Add: MANIFEST.txt
- Update: .socraticodecontextartifacts.json (extend after Phase 4 Part 7)
- Run: codebase_index after Part 8 complete

## Migration Notes
- migration.brownfield: true in inputs.yml
- Existing live deployment at yelli-maes.powerbyte.app stays operational during Phase 4
- Phase 4 builds in parallel branches; cutover after staging verification + perf baseline
- Pre-existing data (data/branding.json) migration: one-shot script in Phase 4 Part 3 seed
- LAN customers running the existing vanilla edition continue working; v2 LAN image (Spec-Driven build) released after Cloud cutover

## Phase Status
- ✅ Phase 0 Bootstrap (Brownfield Adoption-mode via Prompt 1.5.4): complete 2026-06-01
- ⏳ Phase 2: operational interview pending (Docker Hub creds, dev ports, CORS, model routing finalization)
- ⏳ Phase 3: generate full spec files (currently inputs.yml is brownfield scaffold; Phase 3 will refine)
- ⏳ Phase 4 Part 1: pending
- ❌ Phases 4 Parts 2–8: pending
- ❌ Phase 5: validation pending
- ❌ Phase 6: Docker + Visual QA pending
