# Decisions Log

## LOCKED: @yelli/api-client factory pattern — generic + @ts-expect-error (Part 2)
Decision: packages/api-client exports `createYelliTrpcClient<TRouter extends AnyRouter>` rather than a concrete typed client. The tRPC v11 link transformer constraint requires `@ts-expect-error` on the httpBatchLink line — documented rationale, Rule 12 compliant (not `as any`).
Rationale: api-client must not depend on apps/yelli (circular). Generic factory defers concrete typing to consumption site. Bootstrap Step 19 phantom-ui pin (^0.10.1 → 0.10.1 exact) also locked here.
Pin policy: @aejkatappaja/phantom-ui must remain at exact 0.10.1 in packages/shared/package.json until a Feature Update + DECISIONS_LOG entry approves a version bump.
Locked at Phase 4 Part 2 D3-fix. No re-asking.

## Brownfield Adoption — 2026-06-01
BROWNFIELD ADOPTION: project existed before Spec-Driven Platform V31. Existing stack retained as REFERENCE only; PRODUCT.md target stack supersedes per Rule 28 (Global Priority Order — PRODUCT.md priority 4 outranks memory/user-context priority 8). Confirmed via AskUserQuestion 2026-06-01.

**Pre-existing stack (May 2026 — retained as reference):**
- Vanilla Node.js + `ws` (WebSocket signaling, 385L server.js)
- Single-file vanilla HTML + inline CSS/JS (47KB public/index.html with Clay tokens inline)
- No database, no ORM, no auth
- Single-stage Dockerfile (node:24-alpine)
- compose.yaml with cloudflared sidecar
- Deployment: Komodo + Cloudflare Tunnel
- Live at yelli-maes.powerbyte.app

**Target stack (per docs/PRODUCT.md, locked 2026-05-31):**
- Next.js 16 + Node 24
- tRPC + Auth.js v5
- Prisma + PostgreSQL
- Valkey + BullMQ
- shadcn/ui + Tailwind + Clay tokens
- MinIO (dev) / S3 (prod)
- Workbox + Web Push (PWA)

**Migration plan:** Phase 4 Part 1 REWRITES the signaling layer (not retrofit). `inputs.yml` declares `migration.brownfield: true`. Existing `public/index.html` is the visual reference for Next.js + shadcn rebuild.

## LOCKED: Tenancy Model
[Step 1] Dual editions: LAN (self-hosted, MIT OSS) + Cloud (managed SaaS). Single codebase, non-negotiable feature parity (`@dual-mode-exception` required for any exception). LAN: single implicit tenant (slug="default", subdomain router disabled, anonymous admin mode default). Cloud: multi-tenant subdomain routing (`<slug>.yelli.app`).

## LOCKED: Calling Model
[Step 1] 1-on-1 WebRTC peer-to-peer only. Group calls deferred. Signaling-only server (no media). Default device role = `receiver`. CALL button hidden + server-rejects `forbidden_by_role` for non-caller roles (defense in depth). 30s no-answer auto-dismiss. Role change during active call does not disrupt call; new role takes effect after call ends.

## LOCKED: Roles + Permissions
[Steps 1, 6] Device User (LAN anon) / Member / Tenant Admin / Powerbyte Super-Admin. Peer promote/demote by any Tenant Admin. Last-admin guard blocks demotion/removal/suspension of sole admin. Transfer-admin = atomic promote+demote transaction. Super-Admin: separate tRPC router + dedicated Prisma client per V25 (no shared middleware with tenant-scoped routers). `session.invalidate` broadcast on role/tenant change within 30s SLO via Valkey pub/sub.

## LOCKED: Audit Trail
[Steps 4, 6] Immutable AuditLog (L5 always-active) for Tenant, User, Invitation, CallSession, login events, peer admin promote/demote (`member.role.promote`, `member.role.demote`), `lan.tenant.export`, `superadmin.tenant.import`, `pwa.install`. Retention: 7 years (PH BIR compliance). CallSession retention: 1 year; includes `callerRoleAtCall` + `calleeRoleAtCall` snapshots at invite time.

## LOCKED: Device Lifecycle
[Steps 4, 5] Device auto-archive: BullMQ cron daily 03:00 UTC; 90-day offline threshold; `archivedAt` set; tenant-scoped per V25 cron rule. Auto-unarchive on reconnect: `archivedAt` cleared, prior `callRole` restored, `device.unarchive` AuditLog written; orphaned devices (owner User hard-deleted during archival) blocked pending admin reassignment. Device rows retained indefinitely while active; hard-delete only on explicit admin removal.

## LOCKED: Jobs + Queues
[Step 5] BullMQ: `tenant.export` (JSON bundle → S3/MinIO → signed 24h URL email; rate-limited 1/tenant/24h), device-archive cron (03:00 UTC daily), 7-day soft-delete hard-delete cron, invitation/verify/reset emails, logo image processing. Valkey pub/sub bus: cross-instance signaling events (role-change broadcast, directory join/leave, `session.invalidate`); 30s freshness cache keyed by `sessionId`.

## LOCKED: Database Backup
[Step 7] BullMQ cron daily 02:00 UTC: `pg_dump --format=custom --compress=9` → `s3://yelli-backups-prod/postgres/YYYY-MM-DD.dump`. 30-day retention; Glacier IR after 7 days; restore tested quarterly. PITR (wal-g) deferred until first enterprise ask. S3 lifecycle: `yelli-prod-uploads` versioned + no TTL; `yelli-backups-prod` 30d expiry; `tenant-exports/` 24h expiry.

## LOCKED: Tenant Slug Rules
[Step 7] 3–30 chars, regex `^[a-z][a-z0-9-]*[a-z0-9]$`, immutable after creation. 18 reserved names in `src/config/reserved-slugs.ts` (single source of truth for validator + Traefik router): www, api, app, admin, staging, dev, _pwbt, pwbt, status, blog, docs, mail, smtp, mx, support, help, auth, cdn.

## LOCKED: LAN Anonymous Admin
[Step 6] Argon2id passphrase hash on `Tenant.adminPassphraseHash`. HttpOnly `yelli_admin_session` cookie (30-day rolling, `SameSite=Lax`, `Secure` when HTTPS, scope `/admin/*` + `/setup`). Rate limit 5/min/IP on `/admin/login`. Reset via `./scripts/reset-admin-passphrase.sh` on host.

## LOCKED: tRPC Middleware Chain
[Step 6] 5-step chain: `requireSession` → `requireFreshAccount` → `requireTenantMatch` → `requireRole` → procedure guard. Super-Admin router runs isolated chain + dedicated Prisma client (V25 anti-tenant-switching). `session.tenantId === URL.slug.tenantId` cross-check on every Cloud request.

## LOCKED: Deployment Tags
[Step 7] Prod tag scheme: semver `:vX.Y.Z` (immutable) + floating `:prod` pointer. Rollback = re-tag `:prod` to prior semver + Komodo "Redeploy" (no rebuild). Prior 10 semver tags retained on Docker Hub. Komodo: staging `auto_update: true` (polls `:staging-latest`); prod `auto_update: false` (manual Komodo UI). Docker Hub: `powerbyteit/yelli`.

## LOCKED: LAN → Cloud Migration
[Step 7] `./scripts/export-lan-tenant.sh` bundle + `/_pwbt/import` endpoint. Powerbyte-assisted, not self-service in MVP. Single Prisma transaction with V25 cross-checks. Auto-tested coverage is a known gap. AuditLog extended with `lan.tenant.export` + `superadmin.tenant.import`.

## LOCKED: PWA Install UX
[Step 8] Custom Clay-styled banner triggered on 2nd visit by intercepted `beforeinstallprompt`. Buttons: Install / Dismiss. Dismiss snoozes 30 days via `localStorage.yelli_install_snoozed_until`. iOS Safari falls back to inline directory hint + "Install on iOS" walkthrough. Already-installed detection suppresses all affordances.

## LOCKED: Web Push UX
[Step 8] Tap-to-open + in-app modal. NO action buttons (uniform cross-platform incl iOS PWA). Service worker focuses existing client or opens `/app?incoming={callSessionId}`. Expired endpoints auto-pruned on 410 GONE.

## LOCKED: Offline Behavior
[Step 8] Service-worker cached shell + "Reconnecting…" banner. CALL disabled while offline. Exponential backoff `1s → 2s → 5s → 15s → 60s steady`. >5 min upgrades to "Still trying…" + manual Retry. Idempotent mutations queue with UUIDv7 keys; non-idempotent (`call.invite/accept/reject/end`) NEVER queued. Server dedup: Valkey `SET` keyed by `actorUserId`, 24h TTL, rejects duplicate `(actorUserId, idempotencyKey)`.

## LOCKED: Design Tokens
[Step 8] Single `src/styles/tokens.css` source declares Clay tokens as CSS vars. `globals.css` maps shadcn `--primary`/etc. FROM Clay tokens. `tailwind.config.ts` references same vars. `tokens.ts` hand-maintained for non-CSS consumers. Vitest token-parity test catches drift. One edit propagates everywhere, no codegen. Clay palette: canvas `#fffaf0`, navy primary `#0a0a0a`, 6-color (pink/teal/lavender/peach/ochre/mint). Radii: buttons 12px, cards 24px. Inter 500 with negative letter-spacing.

## LOCKED: Mobile-First Global Contract (Step 10, 2026-05-31)
Every page (incl all admin pages) designed from 375px portrait baseline FIRST. `md:` (768px) and `lg:` (1024px) ADD desktop affordances. No `max-md:` fallback anti-pattern. Touch targets ≥44×44px at <md viewports. Tables render as card lists at <md; `<table>` only at `md:`+; no horizontal scroll. Tenant top bar collapses to hamburger + bottom-nav at <md. Hero illustrations stack BELOW headline at <md.

## LOCKED: Operations (Step 9)
**Status page:** static `status.yelli.app` (Cloudflare Pages, Markdown source in `status-page/` repo). Manual updates by Powerbyte on-call. Current state + last 3 incidents. Hosted statuspage deferred.

**Observability:** GlitchTip self-hosted (errors) + Docker JSON-file log driver + Komodo per-container log viewer. Structured JSON `{ts, level, msg, tenantId?, userId?, requestId, ...}`. No central aggregator or APM in MVP. Future Loki/OTel = transport swap only.

**Uptime:** UptimeRobot free tier, 5-min interval, multi-region. Probes `/` + `/_pwbt/health`. Alerts to `oncall@powerbyteitsolutions.com` + Telegram. LAN not monitored (customer infra). `/_pwbt/health` returns `{ok, db, valkey, signaling}`, 200/503, no auth, rate-limited 60/min/IP.

**Perf:** `tests/perf/signaling.k6.js` (k6) — 200 concurrent WS peers, 1 req/s/peer, 5 min. Run pre-`:prod` against staging. Baselines in `perf-baselines/<git-sha>.json`. Regression block: p95 signaling > 150ms OR p95 call-setup > 3s. CI cron + Slack report deferred to Phase 5.

## LOCKED: Dev Environment Mode (V25)
MODE A — WSL2 native (only supported). No devcontainer. No DinD. Node + pnpm run natively. Docker Desktop provides backing services.

## LOCKED: Model Routing (V32)
Planning: claude-code (Opus 4.7 — Architect ONLY, V32 R1)
Execution: claude-sonnet-4-6 via Claude Code (ALL file writes per V32 R1)
Governance writes: gemini-2.5-flash-lite

## LOCKED: Git Strategy (Rule 23)
`feat/{slug}` for features · `scaffold/part-{N}` for Phase 4 Parts · `fix/{slug}` for bugs · `chore/{slug}` for chores. Conventional commit messages only. Squash-merge to main. Delete branch after merge.

## LOCKED: Loading State Library Dual-Path (V31.3)
PATH A: shadcn `<Skeleton>` for shadcn-composed UI. PATH B: `@aejkatappaja/phantom-ui` for bespoke/custom UI. NEVER hand-roll `*Skeleton.tsx` twin file.

## LOCKED: MCP Server Set (2026-06-01)
Active: socraticode (Qdrant + Ollama codebase search) + context7 (live library docs). DEFERRED: shadcn MCP — add when first UI Phase 7 introduces React/shadcn work (per AskUserQuestion 2026-06-01). Reason: existing public/index.html is vanilla HTML/CSS; shadcn MCP would be dead weight until Phase 4 Part 5.

## LOCKED: Webmaster admin email
[Phase 2 Op 2026-06-01] First super-admin seed account uses bonitobonita24@gmail.com — real inbox for password recovery if CREDENTIALS.md plaintext is lost. Seeded by pnpm db:seed in all envs. Plaintext password lives only in CREDENTIALS.md; bcrypt hash in seed.ts. Change immediately after first prod login.

## LOCKED: Dev port assignment strategy
[Phase 2 Op 2026-06-01] Random base 46838 in 40000-49999 range (Rule 22). Service offsets: db=+0, pgbouncer=+1, valkey=+2, minio=+3, minio_console=+4, mailhog=+5, mailhog_ui=+6, pgadmin=+7, app=+10, worker=+11, prisma_studio=+20. Stored in inputs.yml ports.dev. App dev port = 46848. Never reused across projects on same machine. Staging/prod use standard ports.

## LOCKED: CORS origin source
[Phase 2 Op 2026-06-01] CORS origins derived strictly from PRODUCT.md Step 7 domain locks. Prod: yelli.app + *.yelli.app. Staging: yelli-staging.app + *.yelli-staging.app. Dev: localhost:46848 + localhost:3000 + 127.0.0.1:46848. Excludes legacy yelli-maes.powerbyte.app (migration cutover domain — not part of permanent CORS).
