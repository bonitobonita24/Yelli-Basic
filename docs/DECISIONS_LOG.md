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
