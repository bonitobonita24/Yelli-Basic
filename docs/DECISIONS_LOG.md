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
- Workbox-equivalent vanilla SW + Web Push (PWA) <!-- amended [swarm W6 · q-W6-02]: next-pwa/Workbox plugin is Turbopack-incompatible and the Workbox CDN runtime violates the LAN offline-by-design lock (§21); a hand-rolled public/sw.js preserves the Workbox intent (cache-first static / network-first shell / push tap-to-open). -->

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

## LOCKED: Platform tenant slug — `_pwbt`

Decision: The Yelli super-admin (webmaster) lives in a tenant whose slug is `_pwbt`.
Rationale: `_pwbt` is in RESERVED_SLUGS (packages/shared/src/config/reserved-slugs.ts) — cannot be claimed by any signup. Underscore prefix marks it as a system tenant in URL routing. No User.isPlatformAdmin boolean was added (kept Part 2 TS types untouched as locked source of truth).
Phase 5 implication: the tRPC super-admin middleware identifies platform admin by checking `ctx.session.user.tenant.slug === "_pwbt"` and switches to the dedicated unguarded PrismaClient (separate from the L6-extended tenant-scoped client).
Locked at: Phase 4 Part 3 (2026-06-01)

## LOCKED: Webmaster password hash algorithm

Decision: User.passwordHash uses bcryptjs at 12 rounds.
Rationale: Reconfirms the prior "LOCKED: Webmaster admin email" decision. Argon2id remains reserved for Tenant.adminPassphraseHash (LAN Anonymous Admin) per the "LOCKED: LAN Anonymous Admin" decision — the two algorithms coexist for different fields.
Implementation: prisma/seed.ts reads process.env.WEBMASTER_PASSWORD at runtime, validates length ≥ 12, then bcrypt.hash(plaintext, 12) before upsert. Plaintext never lives in seed.ts. Plaintext value lives only in CREDENTIALS.md (gitignored, NEVER read into agent context).
Locked at: Phase 4 Part 3 (2026-06-01)

## LOCKED: AuditLog.targetId nullability

Decision: AuditLog.targetId is nullable (`String?` in Prisma; `string | null` in TS) in both the schema and Part 2 TS interface.
Rationale: Many of the 25 audit actions have no specific target (auth.login.success, pwa.install, lan.admin.passphrase.reset). The locked source of truth is packages/shared/src/types/audit-log.ts (Part 2 LOCKED). When D2 inadvertently scaffolded the column as NOT NULL with a `?? ""` workaround in audit.ts, D2-fix realigned the schema + regenerated the migration column + removed the workaround.
Rule established: Part 2 TS types are the locked source of truth for Prisma schema field shapes. Any Part 3+ mismatch found mid-execution: fix the schema, not the TS type. Cross-Part TS type changes require a Feature Update with synchronized governance.
Locked at: Phase 4 Part 3 (2026-06-01)

## LOCKED: L6 tenant-guard via Prisma `$allOperations`

Decision: packages/db/src/middleware/tenant-guard.ts uses `Prisma.defineExtension` with `query.$allModels.$allOperations`, NOT a list of individual methods (findMany, findFirst, create, etc.).
Rationale: security.md L6 mandate — any unlisted method becomes an unguarded tenant bypass. `$allOperations` future-proofs against new Prisma methods.
Excluded models (caller passes tenantId explicitly): Tenant (it IS the tenant), AuditLog (tenantId nullable for platform-level superadmin actions), Account/Session/VerificationToken (Auth.js — scoped via User relation).
Super-Admin: uses a SEPARATE PrismaClient without this extension (per the prior "LOCKED: tRPC Middleware Chain" decision — never inline if/else inside resolvers).
Locked at: Phase 4 Part 3 (2026-06-01)

## LOCKED: ioredis version pin (5.10.1 exact, deduped via pnpm.overrides)
Decision: @yelli/jobs declares `"ioredis": "5.10.1"` (exact, no caret); root package.json declares `pnpm.overrides.ioredis = "5.10.1"`.
Rationale: bullmq@5.77.7 ships ioredis@5.10.1 as a hard dependency. Without the override, pnpm hoists two ioredis instances (one for bullmq, one for @yelli/jobs) — under TypeScript strict + `exactOptionalPropertyTypes`, the Redis types from the two instances are not structurally identical, breaking typecheck. The override forces every workspace package + every transitive dep to use the same ioredis 5.10.1 instance.
Bump policy: bump only via Feature Update that simultaneously bumps bullmq + ioredis + verifies typecheck passes across all packages.
Locked at: Phase 4 Part 4 D2 (2026-06-01)

## LOCKED: Branding upload MIME whitelist — PNG + JPEG only
Decision: packages/storage/src/validate.ts allows ONLY `image/png` and `image/jpeg` for branding uploads. SVG, GIF, WEBP, HEIC, HTML are rejected.
Rationale: security.md File Upload Safety rule 6 — "SVG and HTML uploads are BLOCKED by default — they can contain embedded JavaScript (XSS vector)." SVG support requires DOMPurify server-side sanitization wiring + serving with strict CSP. That wiring is a Phase 5/7 task, not a Phase 4 scaffold concern.
Re-enable path: Phase 5 or later Feature Update adds DOMPurify-based SVG sanitizer + extends ALLOWED_MIMES + adds DOMPurify dep to packages/storage + new test coverage proving script-strip works. New DECISIONS_LOG entry required at that time.
Size limit: 2 MiB (MAX_BRANDING_BYTES). Magic-byte verification mandatory regardless of declared MIME.
Locked at: Phase 4 Part 4 D4 (2026-06-01)

## LOCKED: Worker payload guard convention
Decision: Every @yelli/jobs worker imports `assertTenantUser` from `packages/jobs/src/workers/_validate.ts` and calls it at the top of the BullMQ processor function — BEFORE any other logic.
Rationale: security.md Queue Safety rule 1+2 mandates tenantId + userId on every job payload, validated server-side, rejected if missing. Centralizing the guard prevents drift; future workers can't accidentally skip the check.
Exception: backup-cron worker uses a stricter local guard (must be tenantId === "_pwbt" + userId === "system") because it operates on the whole DB rather than scoped to one tenant.
Logging: all workers emit structured JSON via `log("info"|"warn"|"error", msg, { ... })` from the same shared helper — matches operations.observability.format = structured-json locked decision.
Locked at: Phase 4 Part 4 D3 (2026-06-01)

## LOCKED: User.securityVersion field (Phase 4 Part 5)
User.securityVersion: Int @default(0) added per security.md Auth Defaults #6. Auth.js v5 session() callback re-reads this on every session lookup and blanks out session.user if the stored version differs from the JWT-embedded version. Increment on role change, tenant change, account suspension, password change. Phase 7 TODO: 30s Valkey cache (locked tRPC Middleware Chain step 2 "requireFreshAccount via 30s Valkey cache") to avoid the DB hit on every request.
Locked at: Phase 4 Part 5 (2026-06-02)

## LOCKED: Auth.js v5 without PrismaAdapter — Credentials + JWT only
next-auth 5.0.0-beta.22 + @auth/prisma-adapter ^2.7.0 trigger a dual @auth/core version resolution at install time → TypeScript errors at the PrismaAdapter() call site. For the scaffold we ship Credentials provider + `session: { strategy: "jwt" }` (no DB-backed sessions). Account/Session/VerificationToken tables remain in the Prisma schema but stay empty until Phase 7 adds magic-link / email-link providers (which need the adapter back). The Auth.js v5 session() callback already DB-validates User.securityVersion + isSuspended on every call, so JWT strategy preserves the V28 session-invalidation guarantee.
Locked at: Phase 4 Part 5 (2026-06-02)

## LOCKED: apps/yelli tsconfig exactOptionalPropertyTypes override
apps/yelli/tsconfig.json sets `"exactOptionalPropertyTypes": false` to accommodate Radix UI v1 component types (shadcn primitives). The strict setting remains active in tsconfig.base.json — packages/* stay at exactOptionalPropertyTypes:true. The override is localized to the consumer app. Re-evaluate when Radix UI ships a strict-compatible release.
Locked at: Phase 4 Part 5 (2026-06-02)

## LOCKED: Next.js 16 proxy.ts convention (V25 anti-tenant-switching)
V25 middleware lives at `apps/yelli/src/proxy.ts` using Next.js 16's `proxy()` + `proxyConfig` export convention (previously `middleware.ts` + `middleware()` in Next.js 13–15). Same matcher semantics. Edge-safe via `getToken({ req, secret })` from next-auth/jwt — no DB hit at the proxy layer. Phase 6 must verify runtime behavior on Komodo + Cloudflare Tunnel deployment matches expectations (intercepts every non-static request; redirects on subdomain↔JWT.tenantSlug mismatch).
Locked at: Phase 4 Part 5 (2026-06-02)

## LOCKED: tRPC AppRouter key for call procedures = `calls` (not `call`)
tRPC v11 reserves `call` as a router-builder key (collides with internal `Router.call`). The merged AppRouter exposes the call procedures under `appRouter.calls` (plural). Client-side: `trpc.calls.invite.useMutation()`. The source file remains `apps/yelli/src/server/trpc/routers/call.ts` and the export remains `callRouter` — only the merge key in root.ts changed.
Locked at: Phase 4 Part 5 (2026-06-02)

## LOCKED: Workspace barrel imports — no `.js` extension
Workspace packages with `main: ./src/index.ts` (consumed as source via `workspace:*` exports) MUST use extension-less imports (`from "./xyz"`) in their barrel and sub-barrel files. TypeScript with moduleResolution=bundler accepts both forms, but Next.js webpack/Turbopack rejects literal `.js` extensions on .ts source. Universal compatibility (TypeScript bundler, webpack, Turbopack, esbuild, Vite) is the no-extension form.
Locked at: Phase 4 Part 5 (2026-06-02)

## LOCKED: Docker image publishing tags — 4-tag strategy
Decision: CI/CD produces 4 Docker Hub image tags per release:
  :staging-latest  — pushed on every merge to main; Komodo staging auto_update polls this
  :latest          — pushed on every merge to main; used for manual prod deploy from Komodo UI
  :sha-{short}     — immutable per-commit tag pushed on every merge to main
  :vX.Y.Z + :prod  — pushed by release.yml workflow when a v*.*.* git tag is created; :prod floats to newest semver release
Rationale: :staging-latest enables zero-config Komodo auto-update for staging. :latest enables simple manual prod deploy. Immutable sha tags enable rollback without rebuild. Semver :vX.Y.Z tags are the official release artifact. :prod floats for dashboards/monitoring that track "what's in production".
GitHub Actions never contacts Komodo directly — Docker Hub is the CI/CD handoff point (V27 model).
Locked at: Phase 4 Part 8 (2026-06-02)

## LOCKED: CI matrix architecture — governance gate + parallel quality matrix + security audit
Decision: GitHub Actions CI runs 3 job groups in order:
  1. governance (sequential): validate-inputs → check-env → check-product-sync
  2. quality (parallel matrix): [lint, typecheck, test, build] — all 4 run in parallel, fail-fast: false
  3. security (parallel with governance): pnpm audit --audit-level=high — blocks on HIGH or CRITICAL CVE
All 3 groups must pass before any merge to main. CVE threshold is HIGH (not CRITICAL) — accept no HIGH CVEs without documented mitigation in DECISIONS_LOG.md.
Locked at: Phase 4 Part 8 (2026-06-02)

## LOCKED: ESLint 9 flat config + Next.js 16 lint removal
Decision: apps/yelli uses direct ESLint CLI invocation (`eslint . --ext .ts,.tsx`) rather than `next lint`. Root eslint.config.mjs is ESLint 9 flat config format (replaces legacy .eslintrc.js which is retained for IDE backward-compat only).
Rationale: Next.js 16 removed the `next lint` binary. Turborepo passes the task name as a positional arg which previously resolved via `next lint` shim — that shim is gone. Direct `eslint` invocation is the correct path for ESLint 9+ projects.
Consequence for future Feature Updates: any lint rule changes go into eslint.config.mjs (flat config). The .eslintrc.js file is a compatibility stub only — do not add rules there.
Locked at: Phase 4 Part 8 (2026-06-02)


## LOCKED: V32.6.1 Phase 3 spec generation decisions — 2026-06-07
Decision: Phase 3 of V32.6.1 canary rebuild locks the following 5 decisions in addition to the V31 baseline preserved through the clean-slate wipe.

### Port strategy (Rule 22)
Random base: 46838. Offsets: db=+0, pgbouncer=+1, valkey=+2, minio=+3, minio_console=+4, mailhog=+5, mailhog_ui=+6, pgadmin=+7, app=+10, worker=+11, prisma_studio=+20. Stored in inputs.yml ports.dev.*. Staging + prod use standard ports (DB=5432, Valkey=6379, MinIO=9000, app internal=3000 via Traefik).
Reproducibility: regenerating env files from the same base yields identical port assignments.

### Bot protection (Cloudflare Turnstile)
Disabled. Reason: Yelli is LAN-first with optional Cloud edition. LAN edition has no public attack surface (private network deployment). Cloud edition relies on Auth.js v5 credential gate + tiered rate limiting (10/min auth IP, 100/min API user, 300/min public IP). No Turnstile widget on prod hostname. Revisit if Cloud edition adds public marketing/landing surfaces.

### Accessibility level
None (shadcn/ui keyboard + focus defaults only). Reason: B2B internal-use tool; no contract WCAG requirement. No a11y skill checklist gate in Phase 4 Parts 5-6 or Phase 7 delivery. Revisit if customer demands WCAG AA.

### Payment gateway
None. Reason: Yelli is a P2P calling app, no transactional surface. No Xendit/Stripe/PayMongo integration. Removes XENDIT_* env vars from all 3 env files and webhook security scaffolding from Phase 4 Part 5.

### vibe_test (Phase 2.7 spec stress-test)
Enabled. Reason: framework default; cheap insurance against PRODUCT.md gaps before Phase 4 scaffolding burns context. Already passed for V32.6.1 baseline.

Locked at: Phase 3 of V32.6.1 canary rebuild (2026-06-07).


## LOCKED 2026-06-08 — Phase 3.3 simulation technique (V32.6)

Decision: the Phase 3.3 interactive prototype uses an **in-memory mock service layer + localStorage persistence**, mirroring the inputs.schema.json entity shapes, exposed behind a single barrel export at `prototype/src/lib/sim/index.ts`. Cross-tab and same-tab reactivity is wired via the native `window` `'storage'` event plus a custom `'yelli:sim:change'` event. A `clock.ts` time-travel helper supports edge cases that depend on wall-clock progression (notably the 90d-offline → device-archive rule).

Rationale: Yelli is workflow-heavy (signaling, role propagation, audit-log invariants) with light per-entity CRUD volume. localStorage gives instant reads, survives page reloads (matches PWA expectations declared in PRODUCT.md §8), and avoids forcing a real backend into the prototype phase. This matches the user-confirmed choice during the Phase 3.3 kickoff Q&A. A pure in-memory layer would have lost state on reload; full IndexedDB would have over-engineered the swap boundary.

Swap boundary (the contract Phase 4 honors): exactly 6 repo namespaces — `devices`, `callSessions`, `users`, `tenants`, `invitations`, `auditLog` — plus `seedDefaults()` and the shared `types` export. Phase 4 swaps these six namespaces (or their counterparts under `apps/web/src/`) for real tRPC client calls. UI consumers do NOT change. `storage.ts` and `clock.ts` are sim-only debug helpers and are removed (not swapped) when the real backend is wired.

Prototype runtime: Next.js 14 App Router (matches inputs.yml `apps[].framework=next` lock). This maximizes Phase 4 code reuse — UI primitives, layout shell, font wiring, and Tailwind token plumbing built in Phase 3.3 carry forward verbatim.

Flow scope: all 9 Core User Flows declared in PRODUCT.md §3 MUST be walkable end-to-end in the prototype before Phase 3.3 gate-closure (per the V32.6 hard-gate requirement before Phase 3.5 begins).

Locked at: Phase 3.3 Wave 2 of V32.6.1 canary rebuild (2026-06-08).

---

## LOCKED — Phase 3.3 Gate-Closure Design Decisions (2026-06-09)

**Trigger:** `/design-review` run for Phase 3.3 gate-closure surfaced 1 CRITICAL + 3 MAJOR flags. Refines applied to F1 (token drift) and F4 (a11y attrs). The following decisions resolve the remaining contract gaps (F2, F3) and document a pre-existing font substitution.

**Decision 1 — Token consumption boundary (resolves F2):**
The `prototype/` directory hardcodes hex literals inline (~250 occurrences) rather than consuming `globals.css` CSS variables or `tokens.ts` exports. This is **accepted for prototype scope only**. Phase 4 Parts 5-6 (production UI scaffold) MUST wire shadcn/ui theme to read `globals.css` CSS variables — no inline hex literals in production component code. `docs/DESIGN.md` is the canonical source; `globals.css` is the runtime mirror; `tokens.ts` is informational only and may be retired in Phase 4 if redundant with the shadcn theme config.

**Decision 2 — Caption typography substitution (resolves F3):**
`docs/DESIGN.md` defines the `caption` slot as 13px / weight 500. Prototype components use 13px / weight 400 for muted supporting body text (no `font-semibold`). This weight delta is **accepted as a soft variant of the caption slot** rather than introducing a new `caption-soft` slot. Phase 4 may consolidate via a Tailwind `text-caption` utility that defaults to weight 400 and accepts a `font-semibold` modifier when the heavier variant is needed.

**Decision 3 — Display font substitution:**
`docs/DESIGN.md` specifies `"Plain Black, Inter, sans-serif"` for display slots. Plain Black is a paid commercial typeface — substituting to Inter for all slots per Scenario 33 ("substitute the closest Google Fonts alternative; note substitution in DECISIONS_LOG.md with both names"). This applies to prototype AND Phase 4 production unless a license is procured.

**Decision 4 — Font loading mechanism (Phase 4 follow-up):**
Prototype uses `@import url('https://fonts.googleapis.com/...Inter...')` in `globals.css`. Phase 4 Parts 5-6 MUST migrate to `next/font/google` for correct Next.js production optimization (FOUT prevention, self-hosting, preload hints). Logged as a Phase 4 prerequisite, not a prototype defect.

Locked at: Phase 3.3 gate-closure design refine (2026-06-09).

---

## LOCKED — Phase 3.3 Client Sign-Off (2026-06-11)

**Trigger:** Final gate-closure for Phase 3.3 per V32.6 hard-gate requirement (phases.md §Phase 3.3). All technical gates cleared (9/9 §3 flows walkable, `docs/PROTOTYPE.md` drafted, `/design-review` GREEN-AFTER-REFINE at 94/100). This entry records the client sign-off that closes Phase 3.3 and unblocks Phase 3.5.

**Client:** Bonito Bonita (solo project — client and developer are the same person; sign-off is a formal framework gate, not a stakeholder review).

**Verification basis:**
1. Playwright walkthrough during the design-review session (2026-06-09) verified all 9 flows end-to-end at the data layer — canonical audit emissions confirmed live, sim state machines advance correctly.
2. Manual in-browser walkthrough (2026-06-10, prototype dev server port 4838) covered Flows A–H interactively. Flow I (tenant export) covered by Playwright pass.

**Per-flow verdict (all 9 §3 Core User Flows):**

| Flow | Title                                | Verdict | Notes                                                       |
|------|--------------------------------------|---------|-------------------------------------------------------------|
| A    | Member places a 1-on-1 call          | ✅ PASS | Sim signaling + role propagation + audit emit verified      |
| B    | Member receives a call               | ✅ PASS | Incoming overlay + accept/decline + endReason machine OK    |
| C    | Admin assigns call role              | ✅ PASS | Role overlay + `device.role.set {from,to}` audit OK         |
| D    | Device first-join naming             | ✅ PASS | OverlayNamePicker auto-trigger + `device.first_join` OK     |
| E    | LAN anonymous admin login            | ✅ PASS (with deferred UX bug — see Deferrals) |
| F    | Invite member by email               | ✅ PASS | 7-day expiry + `invitation.create` + `user.create` OK       |
| G    | Manage devices (rename / archive)    | ✅ PASS | Wave 9 `device.archive` split intact; audit pills correct   |
| H    | Audit log view                       | ✅ PASS | Search + category filter + read-only invariant verified     |
| I    | Tenant export (full JSON snapshot)   | ✅ PASS | Async queued → processing → ready + 24h signed URL OK       |

**Scope confirmed:** the prototype covers every §3 Core User Flow verbatim. No flows added, removed, or scope-trimmed during Phase 3.3. The simulated→production swap boundary documented in `docs/PROTOTYPE.md` (6 sim namespaces under `prototype/src/lib/sim/index.ts`) is the binding contract Phase 4 will honor.

**Deferrals (logged here for Phase 4 pickup — not blocking sign-off):**

1. **Flow E LAN-admin-login UI gate re-render no-op.** `ScreenAdminLogin.submit()` calls `go('admin-members')`, but when the user arrived via a gated nav click, `screen` state is already `'admin-members'` → React `setState` bails on same-value primitive → no re-render → user appears stuck on login despite successful auth. Data layer is 100% correct (session row written, `lan.admin.login.success` audit emitted, reload bypasses gate). **Phase 4 fix:** wire via tRPC session query + react-query invalidation (structurally different from prototype solution). Do NOT refine in prototype — the production fix shape is different from any prototype patch.

2. **Overlay heading semantics.** 2 overlays (`OverlayIncomingCall`, `OverlayCallRoleAssign`) use eyebrow `<div>` instead of semantic `<h*>` for `aria-labelledby`. Phase 4 should promote to `<h2>` when wiring the production component library.

3. **Font loading mechanism.** Prototype uses CSS `@import` for Inter; Phase 4 Parts 5-6 migrates to `next/font/google` (already locked 2026-06-09 §Decision 4).

4. **Token consumption boundary.** Prototype hardcodes hex literals inline; Phase 4 Parts 5-6 wires shadcn theme to read `globals.css` CSS variables (already locked 2026-06-09 §Decision 1).

**Divergences from PRODUCT.md:** none. All declared §3 flows implemented as specified.

**Sign-off statement:** Phase 3.3 is closed. The interactive prototype + `docs/PROTOTYPE.md` + the 6-namespace swap boundary constitute the binding behavioral blueprint for Phase 4. Phase 3.5 (Execution Plan generation) is unblocked.

Locked at: Phase 3.3 client sign-off — gate-closure complete (2026-06-11).
- [swarm S4 · 2026-06-12 16:05:10] 2026-06-12 S4 split APPROVED by Brain (q-S4-01, bucket A, high): S4a apps/yelli APP SHELL + S4b apps/yelli AUTH+tRPC SKELETON (depends on S4a). Provenance: Master Prompt V32 Anti-Thrashing + memory-governance.md §1 Tiered Decomposition (AT_RISK + >500L ⇒ mandatory split); STATE.md NEXT:135 pre-flag. Sequential execution; each session honors ≤12 files / ≤80K / ≤500L budget.
- [swarm S4 · 2026-06-12 16:05:21] S4/q-S4-02: Resolved by Brain (bucket A) — adopted recommended 17 shadcn primitives (button, card, input, label, dialog, badge, avatar, separator, scroll-area, tabs, select, switch, sonner, skeleton, tooltip, dropdown-menu, form) derived from 8 production screens + Rule 11 dual-path loading, per ui-rules.md and inputs.yml tech_stack.ui. Worker's note that prototype/ has no components.json acknowledged; derivation source corrected to production screens.
- [swarm S4 · 2026-06-12 16:28:56] 2026-06-12 q-S4-03 [A/high] Approved 3-way split of S4: S4a-1 DONE (1eb2ae4), dispatch S4a-2 (primitives+tokens.ts+parity test) then S4b (Auth.js v5 + tRPC v11 + middleware + proxy.ts + env.ts) as separate dependent worker sessions. Provenance: Master Prompt V32 Anti-Thrashing + memory-governance.md §1 Tiered Decomposition; refines q-S4-01.
- [swarm S4 · 2026-06-12 16:29:17] 2026-06-12 S4/q-S4-04 [A/framework] shadcn CLI pinned to shadcn@2.x for S4a-2 primitive generation against Tailwind v3 + v3-mode components.json; shadcn@latest (4.x) rejected to protect Phase 3.3 GREEN v3 token plumbing; hand-author rejected per ui-rules.md. Post-add diff gate: tailwindcss must remain ^3.4.10, no v4 packages introduced.
- [swarm S5 · 2026-06-12 16:49:57] S5 q-run9-S5-02 [bucket A, brain]: Resolved coturn-vs-cloudflared conflict in S5 scope. Mirroring pre-clean-slate-20260607-134026 BUILT state: restore cloudflared sidecar (deploy/compose/prod/docker-compose.cloudflared.yml); drop coturn from compose services. WebRTC uses external Open Relay TURN, not self-hosted. Authority: Rule 1 + locked 'cloudflared over Fly.io' deploy decision. Option B rejected — would fabricate TURN credentials with no source.
- [swarm S5 · 2026-06-12 16:50:44] S5 q-run9-S5-03: Deferred release.yml + deploy/windows/*.ps1 (5 PS1 LAN installer/cert/update/service scripts) out of S5; S5 ships only ci.yml + docker-publish.yml per explicit scope. Restorable from tag pre-clean-slate-20260607-134026 in a future LAN-Windows-installer session. Provenance: Master Prompt R6 + Rule 4 scope discipline. [brain:A/high]
- [swarm W1 · 2026-06-12 17:54:48] 2026-06-12 W1/q-W1-01 — Brain(A,high): scaffold-then-wire ordering enforced; S4b dispatched as standalone session before W1 re-dispatch. Cite: CLAUDE.md Anti-Thrashing (≤12 files/≤80K) + STATE.md NEXT items 1 & 3.
- [swarm W1 · 2026-06-12 17:57:05] q-W1-02 [A/framework]: W1 halted pending S4b. Dispatch S4b first (auth + tRPC v11 + 7 routers + 5 middleware + proxy.ts + env.ts + api handlers), verify scaffold on disk, then re-dispatch W1 unchanged. Honors q-W1-01; preserves ≤12-file/≤80K budget and Output Equivalence.
- [swarm W1 · 2026-06-12 17:59:08] 2026-06-12 q-W1-03 [A/high] W1 blocked by absent S4b backend surface (filesystem-verified). Resolution: dispatch S4b standalone first (Auth.js v5 Credentials+jwt no-PrismaAdapter per DL:172, tRPC v11 init+context+7 routers incl. `calls` key, 5 middleware, proxy.ts per DL:179, env.ts Zod, LAN admin hook, api handlers); verify via filesystem; then re-dispatch W1 unchanged. R5 split S4b-1/S4b-2 only if Tier-2 estimate >500L. Per Master Prompt Anti-Thrashing + Output Equivalence; no W1 inline expansion.
- [swarm W1 · 2026-06-12 18:01:23] 2026-06-12 W1/q-W1-04 [Brain·A·high] Dispatch S4b standalone (Auth.js v5 + tRPC v11 + 7 routers + 5 middleware + proxy.ts + env.ts); split S4b-1/S4b-2 if >500L per R5; filesystem-verify before re-dispatching W1 unchanged. Reaffirms q-W1-01/02/03 — scheduler must execute, not re-ask. Cites: Master Prompt Anti-Thrashing + V32 R1-R5 + phases.md W1 pre-flight gate.
- [swarm W1 · 2026-06-12 18:31:30] 2026-06-12 W1 split decision (q-W1-05, bucket A, Brain): W1 exceeded Tier-3 budget (~1100-1400L / 18-22 files vs ≤500L / ≤12 files). Split into W1a (devices+users routers + TRPCProvider/SessionProvider/layout mount, ~6-7 files / ~400-450L) → W1b (device+auth UI port: ScreenAdminLogin/OverlayNamePicker/ScreenAdminMembers/OverlayCallRoleAssign + TenantTopBar/Pill/BottomNav + app-shell, ~8-11 files / ~450-550L, split W1b-1/W1b-2 if pre-flight overruns). W1a blocks W1b. Cites: memory-governance.md §1 Tiered Decomposition Engine + Master Prompt Output Equivalence Guarantee; precedent: S4→S4a-1/S4a-2/S4b.
- [swarm W2 · 2026-06-12 19:08:09] W2 split approved (W2a calls router ~200L now; W2b WS signaling rewrite + Valkey pub/sub + deploy wiring deferred pending Q2 topology). Provenance: Brain q-W2-01, V32 R5 conditional-split + phases.md pre-flight rule 3, precedent q-W1-05.
- [swarm W2b · 2026-06-12 22:43:57] 2026-06-12 W2b q-W2b-01 [Brain A/high]: Signaling topology = own apps/signaling container; Traefik PathPrefix(`/ws`) higher-priority router on ${APP_DOMAIN}; reuses @yelli/shared + W2a BUS_CHANNELS.callSignal via createBusSubscriber(); /_pwbt/health `signaling` field driven by short-TTL Valkey heartbeat. Rejected: custom Next server (couples WS to web), dedicated subdomain (unnecessary DNS/cert surface).
- [swarm W2b · 2026-06-12 22:44:15] 2026-06-12 — W2b split approved by Brain (q-W2b-02, bucket A): W2b-1 = signaling server + deploy + health (~470L/~9 files); W2b-2 = client protocol + useSignaling hook + calling-UI wiring (~250L, deps=[W2b-1]). Rationale: Tier 3 over-budget cohesive scope per memory-governance.md §1; precedent q-W1-05, q-W2-01. Output Equivalence preserved.
- [swarm W2b · 2026-06-12 22:44:36] 2026-06-12 W2b q-W2b-03 [Brain/A]: Narrowed W2b-2 scope to transport-hook-only (useSignaling + contracts + lifecycle + smoke harness). Calling-UI port (ScreenActiveCall/OverlayIncomingCall/OverlayCallRoleAssign/CallRoleLabel) deferred to a dedicated later session under Phase 4 Part 5. Rationale: Master Prompt R1/R6 + V32.2 dispatch discipline; avoids anti-thrashing budget violation and preserves single-concern session contract.

## LOCKED: Signaling server — standalone `@yelli/signaling` container (W2b-1, 2026-06-12)

Decision: The WebRTC signaling layer is its OWN workspace package + container (`apps/signaling`, `@yelli/signaling`), NOT hosted inline in the Next 16 standalone `server.js`. A `ws` server bundled (esbuild, CJS, self-contained — zero runtime node_modules) and run as `node server.cjs`.
- **Routing:** Traefik `Host(\`${APP_DOMAIN}\`) && PathPrefix(\`/ws\`)` at `priority=100` (above the app's bare `Host()` router) on the SAME domain — no new subdomain. Dev maps host `${SIGNALING_PORT}` (46850, base+12) → container `:3001`. WebSocket upgrade is proxied transparently by Traefik.
- **Bus contract reuse:** `BUS_CHANNELS` + bus event types + the NEW WS wire protocol were PROMOTED to `@yelli/shared` (`realtime.ts`) as the single source of truth; `apps/yelli/.../realtime/bus.ts` re-imports + re-exports (public API unchanged). The signaler owns its own subscriber `Redis` connection (same contract as `createBusSubscriber`).
- **Health:** signaling writes a short-TTL Valkey heartbeat key (`yelli:signaling:heartbeat`); `GET /_pwbt/health` reads it for the `{...,signaling}` field (DECISIONS L88). The `_pwbt` App Router segment uses the `%5F` folder-name escape (Next treats bare `_`-folders as private).
- **WS handshake auth:** verifies the LOCKED Auth.js v5 jwt session token via `@auth/core/jwt` `decode` with the shared `AUTH_SECRET` (tries both cookie-name salts). Fail-closed.
- **Call role-guard (defense in depth):** the JWT carries User.role, not Device.callRole, so the signaler does NOT re-derive the call-role. Instead `CallAuthorizer` gates WebRTC relay on the AUTHORITATIVE `call-signal` `start` published by the W2a `calls.start` tRPC procedure (which already enforced the Device.callRole guard). An `offer` from a non-authorized caller ⇒ `forbidden_by_role`.
Rejected: custom Next server (couples a stateful WS process to the web container lifecycle); dedicated `ws.` subdomain (DNS/cert surface with no MVP benefit — reversible later if cross-origin/scaling demands it).

Open (NON-BLOCKING, q-W2b-04): confirm the JWT-decode handshake (incl. salt handling) is the intended mechanism vs a signed-ticket pattern before W2b-2 wires the client; deviceId↔authenticated-user binding at handshake is a follow-up hardening tied to the still-unbuilt device-session model. `apps/signaling/src/auth.ts` is isolated for a clean swap.
- [swarm W5 · 2026-06-13 00:45:40] 2026-06-13 W5 q-W5-01 [Brain/B] Soft-delete cron schema gap resolved from PRODUCT.md §Roles L181-182 + §Data Entities L198/L202/L204 + §Non-functional L297: add User.removedAt DateTime? (set by removeMember alongside isSuspended=true), hard-delete cron filters removedAt < now()-7d; FK policy on hard-delete = DELETE outgoing Invitations (NOT NULL FK, no standalone value), SET NULL AuditLog.actorUserId (nullable; 7yr retention must survive actor). Dispatch in 2 steps: schema session first (packages/db migration + removeMember mutation), then W5 soft-delete-cron against it.
- [swarm W5 · 2026-06-13 00:45:53] W5/q-W5-02 — Email transport resolved to SMTP via nodemailer (Brain, bucket A). Authority: PRODUCT.md stories 12/13 + DECISIONS_LOG Step 5 + staging/prod env (SMTP_HOST/PORT/USER/PASS, MailHog in dev). W5 scope-sheet reference to 'Resend' treated as drift and overridden per Rule 1 / H1 hierarchy; no RESEND_API_KEY provisioned.
- [swarm W5 · 2026-06-13 00:46:19] 2026-06-13 W5 split approved by Brain (A/high): W5a device-archive → W5-runtime (BullMQ Worker+cron+entrypoint) → W5b tenant-export (+presigner) → W5c email (+nodemailer) → W5d logo-image (+sharp, +onlyBuiltDependencies entry) → W5e backup (+pg_dump, env-gated BACKUP_S3_*). Deps approved per-subsession. Bucket provisioning + worker Dockerfile deferred to Phase 6 infra. Cites memory-governance §1, phases.md pre-flight rule 3, Master Prompt locked stack.
- [swarm W6 · 2026-06-13 01:10:00] 2026-06-13 W6 split approved by Brain (q-W6-01, bucket A): W6a = SW + manifest + push/record tRPC + Valkey dedup + SW registration (no UI deps); W6b = install banner + offline banner + UUIDv7 replay queue, gated on W1b idle-screen shell. Authority: memory-governance.md §1 Tiered Decomposition (Tier 3, >500 lines) + Output Equivalence Guarantee; precedent W5a/W5b-e, S4a-1/S4a-2.
- [swarm W6 · 2026-06-13 01:10:33] W6/q-W6-03 — Brain (A/high): Reconcile pwa.install into locked AUDIT_ACTIONS via prescribed ritual (audit.ts append + PROTOTYPE.md §3 amendment + this entry). Source: PRODUCT.md §11 L204 + L390 (Cloud-only, deduped by deviceId); audit.ts header amendment procedure. W6a push.recordInstall to emit 'pwa.install' verbatim.
- [swarm W6 · 2026-06-13 01:10:47] 2026-06-13 W6 q-W6-04 [A/Brain] push.subscribe + push.unsubscribe → protectedProcedure (Auth.js v5 session, tenantId+userId bound) per security.md L3/L5/L6 + locked stack; LAN-anonymous device-only push deferred to W2b-04 device-session follow-up.
- [swarm W6 · 2026-06-13] Brain-decided SW strategy: vanilla Workbox-equivalent public/sw.js (Turbopack + LAN-offline rule out Workbox plugin/CDN). L28 amended; intent preserved.

## LOCKED: PWA install audit (`pwa.install`)
[swarm W6a · 2026-06-13] Originating mandate: PRODUCT.md §11 (AuditLog) L204 + L390 — a PWA install on **Cloud** is an audited event. Resolution (q-W6-03 ritual, applied this session):
1. `pwa.install` appended to `AUDIT_ACTIONS` in `packages/shared/src/audit.ts` (new `pwa.*` namespace).
2. `docs/PROTOTYPE.md` §3 "Audit Vocabulary" amended to list `pwa.install` (Cloud-only; payload `{ platform? }`; deduped by deviceId) — keeps the §3 list the authoritative, grep-able source of truth (audit.ts header contract).
3. Emission: `push.recordInstall` (protectedProcedure) emits `pwa.install` VERBATIM via the L5 `ctx.recordAudit` recorder. Target = `{ type: 'Device', id: deviceId }`. **Deduped by deviceId** — a device with an existing `pwa.install` row in the tenant produces no second row (re-install / multi-tab no-op). Platform (`navigator.userAgentData.platform`) carried in the audit payload. LAN omits the row (single implicit tenant, no per-install audit requirement); the recorder simply isn't called on the LAN install path.
