# CHANGELOG_AI

## Current State — Post Clean-Slate (V32.6.1 canary rebuild, 2026-06-07)

### 2026-06-13 — Phase 4 Swarm Session W6a — PWA backend surface (Service Worker + manifest + push tRPC + Valkey dedup)

- Agent: CLAUDE_CODE (Opus — R1 DEVIATION: authored Opus-inline. The V32.1 swarm subagent-dispatch regression is environment-structural; standing accepted fallback, not a discretionary bypass. W6a is a small, cohesive, already-split unit ⇒ no parallel fan-out warranted regardless.)
- Commit: `feat(phase-4-W6): PWA + Web Push + offline` (W6a slice — code + governance bundled).
- Why: Execute the first sub-session of the Brain-approved W6 split (q-W6-01 [A]): W6a = Service Worker + Web App Manifest + push tRPC endpoints + Valkey idempotency dedup helper + SW registration — zero UI dependency, validates green standalone. W6b (install banner + offline/Reconnecting banner + client UUIDv7 replay queue) is gated on the W1b idle-screen app-shell. W6 is decomposed (memory-governance §1 Tiered Decomposition — full PWA surface > Tier-3 ≤500-line ceiling).
- Files added:
  - `apps/yelli/src/server/trpc/routers/push.ts` — `push` router, 3 protectedProcedures (q-W6-04: tenantId+userId bound from the Auth.js v5 session; LAN-anonymous device-only subscription path DEFERRED to the q-W2b-04 device-session follow-up — NOT a publicProcedure device-fingerprint shortcut). `subscribe`: client-supplied `deviceId` VERIFIED in-tenant via the L6-guarded `ctx.db.device.findUnique` (cross-tenant id → NOT_FOUND, not FORBIDDEN — security.md error/IDOR rules); upsert-by-`endpoint` done as an explicit find→update/create branch (NOT Prisma `upsert`) because the L6 guard injects tenantId into `data` only, NOT into `upsert.create` (🔴 lessons). `unsubscribe`: `deleteMany` by endpoint (idempotent, 0-row safe). `recordInstall`: emits `pwa.install` (§11 VERBATIM) via the L5 `ctx.recordAudit` recorder, target `{ type: 'Device', id: deviceId }`, **deduped by deviceId** (an existing `pwa.install` AuditLog row for the device → `{recorded:false}`, no second row; the dedup read scopes `tenantId` explicitly because AuditLog is L6-excluded — security.md #10), `platform` carried in the payload.
  - `apps/yelli/src/server/idempotency.ts` — Valkey idempotency dedup primitive `reserveIdempotencyKey(actorUserId, key)` → atomic `SET yelli:idem:<uid>:<key> 1 NX EX 86400` (LOCKED 24h window, PRODUCT.md §21). Returns `{duplicate}`; fail-open no-op without `REDIS_URL` (best-effort, mirrors the realtime-bus convention). The primitive ONLY — the client UUIDv7 replay queue + per-mutation wrapping land in W6b.
  - `apps/yelli/public/sw.js` — hand-rolled, Workbox-EQUIVALENT Service Worker (q-W6-02, NO Workbox dep): cache-first `/_next/static/*`, network-first navigation with cached app-shell fallback (flow #21), `push` → ONE notification with no action buttons (§20), `notificationclick` → focus an existing client else `openWindow('/app?incoming={callSessionId}')` (flow #20). Rationale: next-pwa/the Workbox plugin is Next 16 Turbopack-incompatible; the Workbox CDN runtime violates the LAN offline-by-design lock (§21). Workbox INTENT preserved.
  - `apps/yelli/public/manifest.json` + `apps/yelli/public/icon.svg` — standalone PWA manifest (start_url `/app`, brand-teal `#1a3a3a` theme + canvas `#fffaf0` bg = LOCKED Clay tokens) + a single maskable SVG icon (`sizes:"any"` — no binary asset needed).
  - `apps/yelli/src/components/pwa/service-worker-register.tsx` — `'use client'` component registering `/sw.js` once on mount; no-ops where Service Workers are unavailable (SSR / unsupported / insecure origin).
- Files modified:
  - `packages/shared/src/audit.ts` — appended `pwa.install` (new `pwa.*` namespace) to the LOCKED `AUDIT_ACTIONS` (q-W6-03 ritual step 1).
  - `apps/yelli/src/server/trpc/root.ts` — registered `pushRouter` as `appRouter.push`.
  - `apps/yelli/src/app/layout.tsx` — render `<ServiceWorkerRegister/>`; add `metadata.manifest` + `appleWebApp`; add the Next 16 `viewport.themeColor` export (Next 16 moved themeColor out of `metadata`).
  - `docs/PROTOTYPE.md` — §3 "Audit Vocabulary" amended to list `pwa.install` (Cloud-only; payload `{platform?}`; deduped by deviceId) — q-W6-03 ritual step 2 (§3 stays the authoritative, grep-able vocab source).
  - `docs/DECISIONS_LOG.md` — L28 `Workbox + Web Push` → `Workbox-equivalent vanilla SW + Web Push` (q-W6-02) + a new LOCKED "PWA install audit (`pwa.install`)" entry citing the PRODUCT.md §11 L204+L390 mandate (q-W6-03 ritual step 3).
- Schema/migrations: none (consumes the S2 `WebPushSubscription` + `AuditLog` + `Device` models already present; `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY` already declared in `env.ts`).
- Decisions honored: §11 audit vocabulary VERBATIM (`pwa.install`); q-W6-01 split (W6a now / W6b gated on W1b); q-W6-02 vanilla SW; q-W6-03 audit ritual (3 steps); q-W6-04 protectedProcedure session-binding + deferred LAN-anon path. NEW decision locked: "PWA install audit (`pwa.install`)" in DECISIONS_LOG.
- ZERO new external npm deps: sending push (web-push + VAPID) is a worker concern (deferred); UUIDv7 generation is client-side (W6b); ioredis (5.10.1 pin) already present. No SOPS/secret provisioning required.
- Validation: `prisma generate` ✓; turbo typecheck ✓ (7/7, 0 errors); lint ✓ (7/7, 0/0); `next build` ✓ (`ƒ Proxy (Middleware)`; `push` router compiled into the tRPC handler); test ✓ (web 2/2); prettier ✓ on all touched files. Pre-existing non-fatal @prisma/client `export *` Turbopack warning only.
- Errors encountered/resolved: (1) initial `assertDeviceInTenant` helper typed its `db` param with a hand-written client shape — the real L6-extended `ctx.db.device.findUnique` overload is not structurally assignable to it → inlined the device check in each procedure (types against the real client). (2) Prettier reflow on `push.ts` (one ternary line) → `--write`, re-lint green.
- Tests: no NEW unit test added — matches the backend-package convention (W1a–W5a shipped router/worker bodies validated by typecheck+lint+build; tests concentrated in `@yelli/web`). The push procedures are strictly typed against the Prisma client + Zod inputs; the SW + manifest are static assets validated by `next build`.
- Execution note (Rule 15 / V32.1): headless single-executor `claude -p`, inline writes (standing env-structural fallback; sub-agent dispatch unavailable; dispatch_ratio metric N/A for the swarm-worker model — not a discretionary R1 bypass).
- Hand-off: W6a (PWA backend surface) DONE + committed. **W6 is NOT fully complete** — dispatch W6b (install banner + offline/Reconnecting banner + UUIDv7 client replay queue using `reserveIdempotencyKey`) with-or-after W1b once the idle-screen app-shell exists. Human reviews branch `swarm/rebuild` and pushes; worker never pushes.

### 2026-06-13 — Phase 4 Swarm Session W5a — BullMQ device-archive worker (1st of the W5 split)

- Agent: CLAUDE_CODE (Opus — R1 DEVIATION: authored Opus-inline. The V32.1 swarm subagent-dispatch regression is environment-structural; standing accepted fallback, not a discretionary bypass. Scope is a single indivisible file ⇒ no parallel fan-out warranted regardless.)
- Commit: `feat(phase-4-W5): BullMQ workers (implement the 6 queues)` (W5a slice — code + governance bundled).
- Why: Execute the first sub-session of the Brain-approved W5 split (q-W5-03 [A]): "dispatch W5a (device-archive) first as a clean DB-only session, zero new external deps." Replaces the `device-archive` worker STUB (S3 `throw NotImplemented`) with the real daily-03:00-UTC cron processor body. W5 is decomposed (memory-governance §1 Tiered Decomposition — 6 queues / new deps exceed the Tier-3 ≤500-line ceiling) into W5a → W5-runtime → W5b → W5c → W5d → W5e; soft-delete-cron is separately deferred behind a schema session (q-W5-01).
- Files modified:
  - `packages/jobs/src/workers/device-archive.ts` — replaced the stub body with the real processor (Phase 3.3 `sim.repo.archive(olderThanDays)` SWAP BOUNDARY, PROTOTYPE.md Flow G). Tenant-scoped per security.md Queue-Safety cron rule (the scheduler enqueues ONE job per tenant; the processor scopes every query to `job.data.tenantId` explicitly — defense-in-depth on the base/unguarded PrismaClient, outside the tRPC L6 request guard). Logic: `device.updateMany` where `{ tenantId, archivedAt: null, lastSeenAt < now-90d }` → set `archivedAt`; iff `count > 0`, write a SINGLE `device.archive.batch` AuditLog row (Wave-9 mass-cron action, distinct from singular admin `device.archive`) with payload `{ count, olderThanDays: 90 }` VERBATIM from the sim (Audit View fidelity / HARD CONSTRAINT), `actorUserId: null` (system cron — no human actor), `targetType: 'Device'`, `targetId: null`. Wrapped in `prisma.$transaction` so the sweep + its audit row are atomic. Per-tenant structured-JSON completion log (cron rule 7). Auto-unarchive on reconnect is explicitly NOT here (devices-router `unarchive` path).
  - `packages/jobs/package.json` — +`@yelli/db` (workspace) dependency (the only addition; an INTERNAL workspace link, not a new external npm package — the "zero new deps" constraint targets external packages, which W5a introduces none of). No dependency cycle (`@yelli/db` depends only on `@prisma/client`). `pnpm-lock.yaml` relinked.
- Schema/migrations: none (consumes the S2 `Device` + `AuditLog` models + the `[tenantId, archivedAt]` index already present).
- Decisions honored: §11 audit vocabulary VERBATIM — `device.archive.batch` is the Wave-9 mass-cron action in `@yelli/shared` AUDIT_ACTIONS (the LOCKED PROTOTYPE.md §3 contract); 90-day offline threshold (DECISIONS_LOG Step 5 "Jobs + Queues"); daily 03:00 UTC cadence; per-tenant cron iteration + explicit tenant scoping (security.md Queue Safety #7, Export/Report #10); `device.archive.batch` payload `{ count, olderThanDays }` byte-for-byte from `prototype/src/lib/sim/repo.ts:156` (production adapts the sim's `tenantId: null` → the job's real `tenantId` so the row surfaces in that tenant's Audit View — documented swap-boundary adaptation). No NEW decision locked.
- Validation: `pnpm install` ✓ (8 workspace projects; `@yelli/db` linked into `@yelli/jobs`); `prisma generate` ✓; turbo typecheck ✓ (7/7, 0 errors); lint ✓ (7/7, 0/0); test ✓ (web 2/2); `next build` ✓ (`ƒ Proxy (Middleware)`; api routes dynamic). Prettier ✓ on both changed files. Pre-existing non-fatal peer warnings only (`@trpc` wants TS≥5.7.2; next-auth beta vs next 16 — documented, accepted).
- Errors encountered/resolved: none.
- Tests: no NEW unit test harness added to `packages/jobs` — matches the established backend-package convention (every prior W-session W1a–W4 shipped router/worker bodies validated by typecheck+lint+build, tests concentrated in `@yelli/web`) AND the q-W5-03 "zero new deps" constraint (a jobs vitest harness = new dev dep + config). The processor is strictly typed against the Prisma client + the typed `DeviceArchiveJobData` payload; the sim SWAP BOUNDARY it reproduces is itself the signed-off behavioral contract.
- Deferred / remaining W5 sub-sessions (NOT blockers — Brain-approved future runs per q-W5-03, dispatch in order): **W5-runtime** (BullMQ `Worker` process + repeatable-cron bootstrap + worker entrypoint — no new external deps, infra only; processors need a host) → **W5b** tenant-export (+`@aws-sdk/s3-request-presigner` + `putObject`/`getObject`/`presignGet` on `@yelli/storage`; S3 + 24h signed URL) → **W5c** email (+`nodemailer` — SMTP, NOT Resend per q-W5-02) → **W5d** logo-image resize (+`sharp` + root `onlyBuiltDependencies` entry) → **W5e** backup (pg_dump shell-out + env-gated `BACKUP_S3_*` S3 upload; bucket provisioning + worker Dockerfile = Phase 6 infra). **soft-delete-cron is separately deferred** behind a schema session (q-W5-01: add `User.removedAt`, wire `removeMember`, then implement the 7-day hard-delete sweep).
- Execution note (Rule 15 / V32.1): headless single-executor `claude -p`, inline writes (standing env-structural fallback; sub-agent dispatch unavailable; dispatch_ratio metric N/A for the swarm-worker model — not a discretionary R1 bypass).
- Hand-off: W5a (device-archive) DONE + committed. **W5 is NOT fully complete** — dispatch the next run for W5-runtime, then W5b/W5c/W5d/W5e. Human reviews branch `swarm/rebuild` and pushes; worker never pushes.

### 2026-06-13 — Phase 4 Swarm Session W4 — Wire D (Audit + Branding)

- Agent: CLAUDE_CODE (Opus — R1 DEVIATION: authored Opus-inline. The V32.1 swarm subagent-dispatch regression is environment-structural; standing accepted fallback, not a discretionary bypass.)
- Commit: `feat(phase-4-W4): Wire D — Audit + Branding` (code + governance bundled).
- Why: Land the last two `_placeholder` routers — `audit` (read-only Audit View) + `brand` (`tenant.branding.update` with logo upload) — plus the L5 audit-middleware recorder, the `@yelli/storage` MIME-whitelisted upload package, and the `logo-image` queue trigger. (Verified-and-completed a prior in-session W4 draft that was written but never validated/committed; reviewed against scope + the HARD CONSTRAINT, ran full validation, committed.)
- Files added:
  - `packages/storage/` — new `@yelli/storage` workspace package (source-exported, like @yelli/jobs). `src/validate.ts` — LOCKED branding upload validation (DECISIONS_LOG "Branding upload MIME whitelist — PNG + JPEG only"): magic-byte verification (PNG `89 50 4E 47…`, JPEG `FF D8 FF`) MANDATORY regardless of declared MIME, declared-vs-sniffed agreement check, 2 MiB cap, SVG/GIF/WEBP/HTML rejected (security.md File Upload #6 — XSS); `BrandingValidationError` (framework-agnostic; caller maps to tRPC). `src/client.ts` — `putBrandingLogo` S3/MinIO PUT under a tenant-prefixed randomized key (`${tenantId}/branding/logo-${uuid}.${ext}`; security.md File Upload #4/#5); lazy client (side-effect-free import), `forcePathStyle` for MinIO, env-driven (`STORAGE_*`). `src/index.ts` barrel + `package.json` (+`@aws-sdk/client-s3` ^3.700.0) + `tsconfig.json` + `eslint.config.mjs`.
  - `apps/yelli/src/server/jobs/logo-queue.ts` — `logo-image` queue PRODUCER (`enqueueLogoImage`). Best-effort + build/test-safe (lazy singleton Queue over `@yelli/jobs` `QUEUE_NAMES.logoImage`; no-op without `REDIS_URL`), mirroring the W3 email-queue pattern. The resize CONSUMER worker stays a stub (BullMQ-wiring session) — the ORIGINAL logo is already live on `Tenant.logoUrl`, so branding works end-to-end without it.
- Files modified:
  - `apps/yelli/src/server/trpc/middleware/audit.ts` — replaced the L5 stub with the real recorder middleware: INJECTS a tenant+actor-bound `recordAudit(action, target, payload?)` onto ctx for every protected procedure (chain step 5, after auth + tenant-scope). The §11-canonical `action` is supplied verbatim by the call-site (`AuditAction` type from `@yelli/shared`); the recorder binds `tenantId`+`actorUserId` from the session so call-sites can't get them wrong. Writes through the base client (AuditLog is L6-guard-excluded) with explicit tenantId. Exports `RecordAudit` type. `brand.update` is the first adopter; the established per-procedure inline-write pattern (W1a/W3) coexists.
  - `apps/yelli/src/server/trpc/routers/audit.ts` — replaced `_placeholder` with the real read-only Audit View: `list` (admin-gated, cursor-paginated by id, `createdAt desc`, optional `actionPrefix` §11-namespace filter). AuditLog is L6-excluded → the read scopes `tenantId: ctx.tenantId` EXPLICITLY in every WHERE (security.md #10); tenantId omitted from returned rows (security.md #13). Read-only ⇒ emits no audit action (HARD CONSTRAINT applies to emitted actions; none here).
  - `apps/yelli/src/server/trpc/routers/brand.ts` — replaced `_placeholder` with `update` (admin-gated): optional `displayName` rename + optional `logo` ({base64 data, mime} to set / `null` to clear). Logo flow = decode → `validateBrandingUpload` (magic-byte PNG/JPEG + 2 MiB) → `putBrandingLogo` (tenant-prefixed randomized key) → set `Tenant.logoUrl` → emit **`tenant.branding.update`** (§11-canonical VERBATIM — HARD CONSTRAINT) via `ctx.recordAudit` → best-effort `enqueueLogoImage`. Tenant is L6-excluded → direct by-id update on `ctx.db`. LAN-admin passphrase set (`tenant.admin.passphrase.set`) DEFERRED to W6 (Argon2id path).
  - `apps/yelli/src/server/trpc/procedures.ts` — `protectedProcedure` chain now `.use(auditMiddleware)` (the real recorder); the LOCKED 5-step chain (error → rate-limit → auth → tenant-scope → audit) is now fully live.
  - `apps/yelli/src/server/trpc/root.ts` — already merged `audit` + `brand` keys at S4b; routers now carry real bodies.
  - `apps/yelli/next.config.ts` — `transpilePackages` += `@yelli/storage`; `serverExternalPackages` += `@aws-sdk/client-s3` (heavy server-only SDK kept external from the bundle, alongside `bullmq`).
  - `apps/yelli/package.json` — +`@yelli/storage` (workspace). `pnpm-lock.yaml` updated (`@aws-sdk/client-s3` tree; 8 workspace projects).
- Schema/migrations: none (consumes the S2 schema; AuditLog + Tenant models already present).
- Decisions honored: §11 audit vocabulary VERBATIM (`tenant.branding.update` is entry #46 in `@yelli/shared` AUDIT_ACTIONS — the LOCKED PROTOTYPE.md §3 contract); branding MIME whitelist PNG/JPEG only + magic-byte + 2 MiB (DECISIONS_LOG "Branding upload MIME whitelist"); tenant-prefixed randomized storage key + tenantId-explicit AuditLog read (security.md File Upload #4/#5, Export/Report #10, #13). No NEW decision locked.
- Validation: `pnpm install --frozen-lockfile` ✓ (8 workspace projects); `prisma generate` ✓; turbo typecheck ✓ (7/7, 0 errors — `@yelli/storage` included); lint ✓ (7/7, 0/0); test ✓ (web 2/2); `next build` ✓ (`ƒ Proxy (Middleware)`; api routes dynamic; 3 static pages; `@yelli/storage` transpiled + `@aws-sdk/client-s3` external resolved). Pre-existing non-fatal `@prisma/client` `export *` Turbopack warning (S2) only.
- Errors encountered/resolved: none — the prior draft was internally consistent; this session reviewed against scope + HARD CONSTRAINT, confirmed wiring (chain order, root merge, barrel exports, next.config externals), and ran the full validation suite clean.
- Deferred (documented, non-blocking): the `logo-image` resize/optimization CONSUMER worker (36×36 + retina re-encode) → BullMQ-wiring session (producer fires now; original logo is already live); `tenant.admin.passphrase.set` audit emit → W6 LAN-admin (Argon2id); `tenant.export.*` audit emits → tenant-export BullMQ session.
- Execution note (Rule 15 / V32.1): headless single-executor, inline writes (standing env-structural fallback; sub-agent dispatch unavailable in `claude -p`; dispatch_ratio metric N/A for the swarm-worker model — not a discretionary R1 bypass).
- Hand-off: ALL 7 routers now carry real bodies (`devices`/`users`/`calls`/`tenants`/`invitations`/`audit`/`brand`). Remaining wire deps: W1b (device+auth UI port), W2b-2 (client `useSignaling` hook), + the UI/PWA/validation sessions. Human reviews branch `swarm/rebuild` and pushes; worker never pushes.
- Commit: `feat(phase-4-W4): Wire D — Audit + Branding`

### 2026-06-13 — Phase 4 Swarm Session W3 — Wire C (Tenancy + Members + Invitations)

- Agent: CLAUDE_CODE (Opus — R1 DEVIATION: authored Opus-inline. The V32.1 swarm subagent-dispatch regression is environment-structural; standing accepted fallback, not a discretionary bypass.)
- Commit: `feat(phase-4-W3): Wire C — Tenancy + Members + Invitations` (code + governance bundled).
- Why: Replace the `tenants` + `invitations` `_placeholder`s with real procedures; fill the V25 proxy subdomain→tenant cross-check; land the invitation email queue trigger + the W2a session-kill call-sites that were explicitly deferred to "the W3 user routers".
- Files added:
  - `apps/yelli/src/server/jobs/email-queue.ts` — BullMQ email PRODUCER (lazy singleton Queue over `@yelli/jobs` `QUEUE_NAMES.email`; `enqueueInvitationEmail`). Best-effort + build/test-safe (no-op without `REDIS_URL`), mirroring `realtime/bus.ts`. The CONSUMER (SMTP worker) stays a stub (BullMQ-wiring session) — W3 fires the trigger only.
- Files modified:
  - `apps/yelli/src/server/trpc/routers/invitations.ts` — real `list`/`create`/`revoke`/`resend` (admin-gated). `create`+`resend` mint a single-use token (`randomBytes`→base64url), store ONLY its SHA-256 hash on `Invitation.tokenHash` (@unique), and enqueue the RAW token to the email queue post-commit. `revoke` = immediate expire (keeps the row for the admin history). §11 audit VERBATIM (`invitation.create`/`revoke`/`resend`). `accept` DEFERRED (accounts-auth — needs bcrypt + User provisioning; the router doc said so).
  - `apps/yelli/src/server/trpc/routers/tenants.ts` — `get` (caller's tenant profile) + member admin: `promoteMember`/`demoteMember`/`suspendMember`/`unsuspendMember`/`transferAdmin`. LAST-ADMIN GUARD (CONFLICT) on demote/suspend of the sole effective admin; `transferAdmin` = atomic promote+demote tx (DL Step 6). Every role/status change bumps `User.securityVersion` (V28) AND fires `publishSessionInvalidate` (W2a bus, 30s SLO) — the deferred W3 call-site. §11 audit VERBATIM (`user.role.promote`/`demote`, `user.suspend`; un-suspend emits none — W1a precedent). tenantId stripped from member rows (security.md #13).
  - `apps/yelli/src/proxy.ts` — V25 subdomain→slug resolution: parse the leftmost label against `APP_BASE_DOMAIN`, bypass apex / reserved (`isReservedSlug`) / non-Cloud hosts, and redirect to the user's own tenant host when `token.tenantSlug !== URL slug`. LAN (EDITION≠cloud or no base) disables the subdomain router (DL Step 1). Edge-light: reads `EDITION`/`APP_BASE_DOMAIN` off `process.env`; `@yelli/shared` is barrel-pure (zod-only — verified edge-safe).
  - `apps/yelli/src/env.ts` — +`EDITION` (enum lan|cloud, default lan) + `APP_BASE_DOMAIN` (optional) — server-side validation/doc of the new Cloud-routing env (proxy reads process.env directly).
  - `apps/yelli/next.config.ts` — `transpilePackages` += `@yelli/jobs`; `serverExternalPackages: ['bullmq']` (dynamic-require lib kept external from the bundle).
  - `apps/yelli/package.json` — +`@yelli/jobs` (workspace) + `bullmq` ^5.77.7 (direct, traceable). `pnpm-lock.yaml` updated.
- Schema/migrations: none (consumes the S2 schema; no Prisma changes).
- Decisions honored: §11 audit vocabulary VERBATIM from `@yelli/shared` (the LOCKED PROTOTYPE.md §3 contract — NOT DECISIONS_LOG line-42's illustrative `member.*`/`lan.tenant.export`, which the `audit.ts` header marks superseded by the signed-off list); last-admin guard + transfer-admin atomicity (DL Step 6); V25 cross-check (DL Step 1/6 + Next 16 proxy convention); `session.invalidate` ≤30s SLO (DL Step 6 / security.md REALTIME). No NEW decision locked.
- Validation: `pnpm install` ✓; `prisma generate` ✓; typecheck ✓ (0); lint ✓ (0/0); test ✓ (web 2/2); `next build` ✓ (proxy = `ƒ Proxy (Middleware)`); root turbo typecheck+lint+test ✓ (14/14). Pre-existing non-fatal `@prisma/client` `export *` Turbopack warning (S2) only.
- Errors encountered/resolved: (1) `SessionInvalidateEvent` requires `at` (ISO ts) — added via a local `invalidate()` helper. (2) the L6-extended `$transaction` tx type is NOT assignable to `Prisma.TransactionClient`, so a tx-typed helper fails typecheck — inlined the last-admin guard instead (devices.ts pattern). 🔴 lessons.md.
- Deferred (documented, non-blocking): `invitation.accept` → accounts-auth wire; `tenant.export.*` → BullMQ-wiring/storage session (queue-worker concern — orphaning a queued row without its worker would be worse than deferring); `removeMember` (hard User delete) → needs a schema decision (no soft-delete column; FK `Invitation.invitedByUserId` NOT NULL + AuditLog-immutability collision) — surfaced as a non-blocking question; suspend is the MVP deactivation path.
- Execution note (Rule 15 / V32.1): headless single-executor, inline writes (standing env-structural fallback; sub-agent dispatch unavailable in `claude -p`; dispatch_ratio metric N/A for the swarm-worker model — not a discretionary R1 bypass).
- Hand-off: `tenants` + `invitations` routers LIVE; `audit` + `brand` routers remain `_placeholder` (W5/W7). Human reviews branch `swarm/rebuild` and pushes; worker never pushes.
- Commit: `feat(phase-4-W3): Wire C — Tenancy + Members + Invitations`

### 2026-06-12 — Phase 4 Swarm Session W2b-1 — Wire B2 (WebSocket signaling server + deploy)

- Agent: CLAUDE_CODE (Opus — R1 DEVIATION: authored Opus-inline. The V32.1 swarm subagent-dispatch regression is environment-structural (Sonnet baseline-overhead; see lessons.md / memory 2026-06-09) — parallel Sonnet fan-out is unreliable in this headless `claude -p` worker. Standing accepted fallback, not a discretionary bypass.)
- Commit: `feat(phase-4-W2b): Wire B2 — WebSocket signaling server (Next 16 standalone)` (code + governance bundled).
- Why: Host the WebRTC signaling layer the W2a bus was built for. Resolved answers: q-W2b-01 (topology = own `apps/signaling` container, Traefik `PathPrefix(/ws)`, reuses `@yelli/shared` + the W2a bus), q-W2b-02 (split W2b → **W2b-1 server+deploy (this session)** + **W2b-2 client hook (next)**), q-W2b-03 (W2b-2 delivers the `useSignaling` transport hook only; calling-UI port is later).
- Files added:
  - `packages/shared/src/realtime.ts` — single source of truth promoted from bus.ts: `BUS_CHANNELS` + `tenantIdFromChannel` + the bus event types, PLUS the NEW WebSocket wire protocol (zod-validated `hello`/`signal`/`ping` client frames; `ServerMessage` union incl. `error{forbidden_by_role|…}`), `canInitiateCall(CallRole)`, and the `SIGNALING_HEARTBEAT_KEY` health contract.
  - `apps/signaling/` — new `@yelli/signaling` workspace package: `src/server.ts` (ws server: 10s handshake-auth gate, per-tenant relay, bus-authorized call-guard, `session-invalidate` force-close, heartbeat, graceful shutdown), `src/auth.ts` (Auth.js v5 JWE decode via `@auth/core/jwt`, both cookie-name salts), `src/registry.ts` (tenant-partitioned `PeerRegistry`), `src/authorizer.ts` (`CallAuthorizer` — bus-driven defense-in-depth relay guard), `src/heartbeat.ts`, `src/env.ts`, `src/index.ts` (entrypoint), `src/authorizer.test.ts` (6 tests), `package.json` (esbuild CJS bundle), `tsconfig.json`, `Dockerfile` (3-stage; self-contained 657KB bundle, zero runtime node_modules).
  - `deploy/compose/{dev,stage,prod}/docker-compose.signaling.yml` — dev builds + maps host port `${SIGNALING_PORT}`→:3001; stage/prod pull the `yelli-signaling` image and add the Traefik `PathPrefix(/ws)` router at priority 100 (above the app's Host() router), proxy network, no host port.
  - `apps/yelli/src/app/%5Fpwbt/health/route.ts` — `GET /_pwbt/health` → `{ok,db,valkey,signaling}` 200/503 (DECISIONS L88); `signaling` driven by the Valkey heartbeat key; `%5F` folder escape so Next 16 routes the `_pwbt` segment (verified in build output).
- Files modified:
  - `apps/yelli/src/server/realtime/bus.ts` — now imports `BUS_CHANNELS` + event types from `@yelli/shared` and re-exports them (public API unchanged; `call.ts` importers unaffected). Removed the local duplicate definitions + the now-unused `CallRole` import.
  - `packages/shared/src/index.ts` — barrel now `export * from './realtime'`.
  - `apps/yelli/Dockerfile` — added `COPY apps/signaling/package.json` so the web image's frozen-lockfile install resolves the expanded workspace importer graph.
  - `inputs.yml` — `apps[]` gains `signaling` (node/service); `ports.dev.signaling: 46850` (base+12).
  - `deploy/compose/start.sh` — signaling compose added to the FILES list (after app, before cloudflared).
  - `.env.example` (committed) + `.env.dev`/`.env.staging`/`.env.prod` (gitignored, local) — `SIGNALING_PORT` + `SIGNALING_HEARTBEAT_TTL_SEC` (+ `SIGNALING_IMAGE_TAG` for stage/prod).
  - `pnpm-lock.yaml` — `+ws ^8.18.0`, `@types/ws`, `esbuild ^0.27` (aligned to vitest's vite@8 peer), `@auth/core 0.35.3` (already in the tree) into `@yelli/signaling`.
- Files deleted: none.
- Security layers applied: WS handshake authenticated against the LOCKED Auth.js v5 jwt session (shared AUTH_SECRET) — fail-closed; channels + registry are tenant-partitioned (L1 at the transport layer); WebRTC relay gated by `CallAuthorizer` on the AUTHORITATIVE bus `call-signal` start (the W2a router already enforced the Device.callRole guard) → unauthorized `offer` ⇒ `forbidden_by_role` (defense in depth, DECISIONS L36); `session-invalidate` bus events force-close the user's live sockets (security.md REALTIME #3); `maxPayload` cap; signaling server is signaling-only (no media).
- Post-review hardening (automated security review, 1 HIGH — Device Impersonation / IDOR, the exact gap pre-surfaced as q-W2b-04): `PeerRegistry.add` now REFUSES to displace a deviceId already held by a DIFFERENT user in the tenant (returns `{ok:false,'device-in-use'}`); the server rejects that handshake (`unauthorized` + close) instead of last-writer-wins. This closes the acute vector (an authenticated same-tenant peer kicking + impersonating another user's LIVE device socket) WITHOUT violating the Brain-locked stateless/DB-free topology. Added `src/registry.test.ts` (4 tests: cross-user refusal, same-user reconnect, tenant partitioning, forUser/size/cleanup).
- NON-BLOCKING (q-W2b-04, residual): full deviceId↔authenticated-user binding at handshake still requires either deviceId claims in the Auth.js JWT (apps/yelli auth surface, out of W2b-1 scope) or a DB lookup in the signaler (rejected by the q-W2b-01 stateless topology) — tied to the unbuilt device-session model. Residual after the hardening: pre-claiming an OFFLINE device's id. Confirm the JWT-decode handshake (incl. salt) + the device-binding path before W2b-2 wires a LIVE client; `src/auth.ts` + `registry.add` are isolated for a clean swap.
- Schema/migrations: none.
- Tier: 2 — moderate (1 shared contract + 1 new package [10 src files incl. 2 tests] + 3 compose + 1 health route + Dockerfile/config edits; ~700 authored lines across ~19 files; no thrash).
- Verification: `pnpm install` ✓; `pnpm typecheck` ✓ 6/6; `pnpm lint` ✓ 6/6; `pnpm build` ✓ 2/2 (`/_pwbt/health` routes; signaling esbuild bundle 642.7KB); `pnpm test` ✓ 12/12 (signaling 10 + web 2).
- Drift review: dispatch_ratio sonnet=0/opus=1 → N/A for the headless swarm-worker model (V32.1 env-structural fallback; logged in lessons.md).
- NEXT: **W2b-2** — the client `useSignaling` transport hook (typed to `@yelli/shared` wire protocol, connect/reconnect/disconnect lifecycle, auth handshake using the W1b session, smoke harness). Then a later session ports the calling UI screens onto the hook.

### 2026-06-12 — Phase 4 Swarm Session W2a — Wire B1 (Calling data + realtime: calls router, CallSession, Valkey bus)

- Agent: CLAUDE_CODE (Opus — R1 DEVIATION: standing acceptance per the headless swarm-worker model; single-executor `claude -p`, sub-agent dispatch unavailable in this harness — documented V32.1 env-structural fallback, not a discretionary bypass).
- Commit: `feat(phase-4-W2a): Wire B1 — Calling data+realtime (calls router, CallSession, Valkey bus)` (code + governance bundled).
- Why: Wire the calling DATA + REALTIME-fan-out plane. Replaces the S4b `_placeholder` for the call router with the real `calls` router persisting the CallSession lifecycle (Phase 3.3 `sim.callSessions` SWAP BOUNDARY, PROTOTYPE.md §3 Flow A/B), and adds the Valkey pub/sub bus for cross-instance signaling fan-out + the 30s session-kill SLO. This is **W2a** — the data/realtime half; the WebSocket signaling *server* (offer/answer/ICE host) is **W2b**.
- Files added:
  - `apps/yelli/src/server/realtime/bus.ts` — Valkey (ioredis) pub/sub bus. Tenant-scoped channels (`call-signal` / `role-change` / `session-invalidate`); typed event unions; lazy publisher singleton (no-op when `REDIS_URL` unset → import is side-effect-free in build/test); best-effort `publishCallSignal` / `publishRoleChange` / `publishSessionInvalidate`; **hybrid push+pull session-kill** — `publishSessionInvalidate` publishes AND writes a 30s-TTL key (LOCKED 30s SLO, Step 6); `getInvalidatedSecurityVersion` is the pull-side backstop; `createBusSubscriber()` is the dedicated subscriber connection the W2b WS server consumes.
- Files modified:
  - `apps/yelli/src/server/trpc/routers/call.ts` — real `calls` router (merge key `calls`, LOCKED): `list`, `byId`, `start` (Flow A — snapshots `callerRoleAtCall`/`calleeRoleAtCall`, enforces the server-side role guard, auto-rejects forbidden pairings by creating+ending the row with `endReason: forbidden-by-role`), `connect` (Flow B accept — stamps `connectedAt`), `end` (reject/hang-up — computes `durationSec` from connectedAt∥startedAt, idempotent). Each transition publishes a best-effort `call-signal` to the bus for cross-instance fan-out. `endReason` crosses the shared-union (hyphen) ↔ Prisma-enum (underscore) boundary via two exhaustive `Record` maps.
  - `apps/yelli/package.json` — `+ "ioredis": "5.10.1"` (exact, matching the LOCKED root `pnpm.overrides.ioredis`).
- Files deleted: none.
- AUDIT decision (🔴 lessons.md): calls are **NOT** written to L5 AuditLog — they are recorded in the `CallSession` entity (PRODUCT.md §11). Forced by three locked artifacts: the sim does not audit calls, `AuditTargetType` has no `CallSession` value, and the Wave 4 §11 reconciliation removed off-spec `call.*` emissions. PROTOTYPE.md §3's "Audit: call.start" prose + the `call.*` AUDIT_ACTIONS entries are stale/reserved — surfaced as a NON-blocking docs-reconciliation question (q-W2a-01).
- Security layers applied: L1+L6 (every read/write on `ctx.db` = tenant-auto-scoped → cross-tenant deviceId/sessionId resolves to NOT_FOUND); security.md #13 (tenantId stripped from every client row via `CALL_SESSION_SELECT`); role-guard server-reject enforcement (caller∈{caller,both} ∧ callee∈{receiver,both}, else `forbidden-by-role`); bus channels + session-invalidate keys are tenant-namespaced (no cross-tenant leakage); bus publishes are best-effort (a Valkey failure never fails the persisted mutation).
- Post-review hardening (automated security review, 2 HIGH — IDOR-within-tenant; same class W1a closed on `register`/`setDisplayName`): the protected mutations now enforce PARTICIPANT ownership (security.md #5) — `start` requires `caller.userId === ctx.user.id` (a member places calls only from a device they operate, no client-supplied spoof), `connect` requires the actor to operate the callee device, `end` requires the actor to be a participant (caller or callee operator). The sim did not model this (single-user); porting an IDOR hole into multi-tenant Cloud is not faithful — closed. LAN-anonymous calling (device.userId null) is a separate unauthenticated path, never this protected router; W2b server-initiated ends (peer-disconnect/ice-failed) use a separate system path.
- Bus producers — scope boundary: `call-signal` is LIVE (produced by the `calls` router). `publishRoleChange` (producer = `devices.setRole`, W1a's file) and `publishSessionInvalidate` (producers = the W3 user role/suspend routers, still placeholders) are delivered as ready public API; their one-line call-sites are deferred to those sessions to keep W2a self-contained (no edits to out-of-scope W1a/W3 files).
- Schema/migrations: none (S2 CallSession + EndReason reused as-is).
- Tier: 1 — lightweight (1 new bus module + 1 router replace + 1 package.json line; ~330 authored lines; no thrash).
- Verification: `pnpm install` ✓ (+ioredis 5.10.1 via override); `prisma generate` ✓; web `typecheck` ✓ (0); web `lint` ✓ (0); root turbo `build` ✓ (`call.ts` compiled as App Route; `ƒ Proxy (Middleware)`; 3/3 static pages); root turbo `test` ✓ (@yelli/web 2/2 token-parity).
- Drift review: dispatch_ratio sonnet=0/opus=1 → N/A for the headless swarm-worker model (sub-agent dispatch unavailable). Standing V32.1 fallback already logged.
- NEXT: **W2b** — host the WebSocket signaling server (offer/answer/ICE) that subscribes to the bus (`createBusSubscriber` + `BUS_CHANNELS.callSignal`) and fans signals to the right peer connections across instances; wire `publishRoleChange` into `devices.setRole` and `publishSessionInvalidate` into the W3 user routers as those land.

### 2026-06-12 — Phase 4 Swarm Session W1a — Wire A (Devices + Auth surface: backend + provider plumbing)

- Agent: CLAUDE_CODE (Opus — R1 DEVIATION: standing acceptance per the headless swarm-worker model; single-executor `claude -p`, sub-agent dispatch unavailable in this harness — documented V32.1 env-structural fallback, not a discretionary bypass).
- Commit: `feat(phase-4-W1): Wire A — Devices + Auth surface` (code + governance bundled).
- Why: First wire session. Replaces the S4b `_placeholder` skeletons for the `devices` + `users` routers with real Prisma-backed procedures, and mounts the client provider stack (tRPC + react-query + Auth.js session) so the app shell can call the backend. This is **W1a** — the backend + provider HALF of the resolved W1 split (q-W1-05). **W1b (the device + auth UI port) is the next session** and depends on this commit.
- Resolved answers applied: q-W1-01..04 (dispatch S4b first — already DONE/committed `b06e958`, so W1 is unblocked); **q-W1-05 (bucket A — split W1 into W1a → W1b; W1a = routers + providers + layout mount; W1b = UI port). This session is W1a.**
- Files added: `apps/yelli/src/lib/providers.tsx` (client `Providers`: `SessionProvider` seeded with the server-resolved session + `trpc.Provider` over `httpBatchLink({ transformer: superjson })` + `QueryClientProvider`).
- Files modified:
  - `apps/yelli/src/server/trpc/routers/devices.ts` — real `devices` router, 10 procedures wiring the Phase 3.3 `sim.devices` surface (the SWAP BOUNDARY): `list`, `listOnline` (5-min presence window), `byId`, `register` (Flow D), `setDisplayName` (first_join vs rename branch — mirrors sim), `setRole` (Flow C, admin-only), `touch` (heartbeat, no audit), `archive` (Flow G, admin), `unarchive` (admin), `delete` (admin). The cron `device.archive.batch` is intentionally NOT a router procedure (it is the packages/jobs path). Every mutation writes one L5 AuditLog row INLINE on the L6-guarded tx (`tx.auditLog.create`), using the §11-canonical action vocabulary VERBATIM (`device.create / first_join / rename / role.assign / archive / unarchive / delete`) with the sim's payload shapes so the Audit View keeps rendering.
  - `apps/yelli/src/server/trpc/routers/users.ts` — real `users` ownership router: `me` (self profile), `list` (tenant member directory — for ScreenAdminMembers), `setDisplayName` (self-rename, ownership-bound to `ctx.user.id`). Admin member mutations (suspend/promote/demote) deferred to W2 (tenancy-members). No §11 audit action exists for user display-name changes, so none is emitted (locked-vocabulary fidelity — the sim's off-spec `user.unsuspend` was NOT reproduced).
  - `apps/yelli/src/app/layout.tsx` — now an async server component: resolves `auth()` server-side and wraps children in `<Providers session={…}>` (first paint carries real auth state; route `/` becomes `ƒ Dynamic` — expected, the shell reads the session).
  - `packages/shared/src/{index,entities,validators}.ts` — stripped 10 explicit `.js` import specifiers → extensionless (BUILD FIX, see Errors). Required because W1a is the first code to pull the `@yelli/shared` barrel into the Next/Turbopack build graph.
- Files deleted: none.
- Security layers applied: L1+L6 (every query/mutation runs on `ctx.db` = `prisma.$extends(tenantGuardExtension(ctx.tenantId))` → tenant auto-scoped); L5 (inline AuditLog per mutation, explicit tenantId since AuditLog is guard-excluded); RBAC (admin-gate on setRole/archive/unarchive/delete via `requireAdmin(ctx.user.role)`); security.md #13 (tenantId stripped from every client row via `DEVICE_SELECT`/`USER_SELECT`); security.md #4 (passwordHash + securityVersion never selected on user rows); IDOR (id-by-tenant whereUnique → cross-tenant id resolves to NOT_FOUND). Post-review hardening (automated security review, 2 HIGH): `register` binds device owner + audit actor to `ctx.user.id` (dropped client-supplied `userId` — closes ownership/audit-actor spoofing); `setDisplayName` gates on owner-or-admin (`prior.userId === ctx.user.id || role==='admin'`, closes cross-member rename IDOR) and records `ctx.user.id` as the audit actor.
- Schema/migrations: none (S2 schema reused as-is).
- Tier: 1 — lightweight (4 W1a app files + 3 one-line-each shared build-fix files; ~300 authored lines; no thrash).
- Errors encountered + resolved:
  1. `omit` query-arg not present on the L6-extended Prisma delegate types → switched tenantId/secret stripping from `omit` to reusable `select` consts (`DEVICE_SELECT` / `USER_SELECT`). RESOLVED.
  2. The L6-extended interactive-tx client is not assignable to `writeAuditLog`'s `Prisma.TransactionClient | PrismaClient` param → inlined the L5 write as `tx.auditLog.create({ data })` on the guarded tx (AuditLog is guard-excluded; tenantId passed explicitly). Same DB write, type-clean, atomic with the mutation. RESOLVED.
  3. 🔴 `next build` (Turbopack) `Module not found: Can't resolve './audit.js'` etc. — `@yelli/shared` used `.js` ESM specifiers but the repo is `moduleResolution: Bundler` and the files are `.ts`; `@yelli/db` (extensionless) builds fine. Stripped the `.js` extensions in `@yelli/shared` to match the proven db pattern. RESOLVED (logged to lessons.md as a 🔴 gotcha for future barrel imports).
- Verification: `prisma generate` ✓; web `typecheck` ✓ (0); web `lint` ✓ (0); web `build` ✓ (`ƒ Proxy (Middleware)`; `/` dynamic; api routes dynamic; non-fatal pre-existing `export *`/@prisma CJS Turbopack warning); root turbo `typecheck` ✓ (5/5), `lint` ✓ (5/5), `test` ✓ (@yelli/web 2/2).
- Drift review: dispatch_ratio sonnet=0/opus=1 → N/A for the headless swarm-worker model (sub-agent dispatch unavailable). Standing V32.1 fallback already logged; no new drift entry beyond the build-fix gotcha.
- NEXT: **W1b** — port the validated prototype device + auth UI (ScreenAdminLogin + Flow E re-render fix, OverlayNamePicker/Flow D, ScreenAdminMembers devices-list/Flow G, OverlayCallRoleAssign/Flow C, TenantTopBar/Pill/BottomNav + app-shell) onto these tRPC hooks + the mounted providers.

### 2026-06-12 — Phase 4 Swarm Session S5 — Scaffold Part 6 (deploy/ + CI)

- Agent: CLAUDE_CODE (Opus — R1 DEVIATION: standing acceptance per the headless swarm-worker model; single-executor `claude -p`, sub-agent dispatch unavailable in this harness — documented V32.1 env-structural fallback, not a discretionary bypass).
- Commit: `feat(phase-4-S5): Scaffold Part 6 — deploy/ + CI` (code + governance bundled).
- Why: Scaffold the deployment + CI layer for the clean-slate rebuild (framework Part 7+8 content), mirroring the proven structure from the pre-clean-slate BUILT state (tag `pre-clean-slate-20260607-134026`) per scope, adapted to current clean-slate reality (`@yelli/web`; packages shared/db/ui/jobs only).
- Resolved answers applied: q-run9-S5-02 (bucket A — restore cloudflared sidecar, NO self-hosted coturn; WebRTC uses external Open Relay TURN); q-run9-S5-03 (defer `release.yml` + `deploy/windows/*.ps1` to a future LAN-Windows-installer session).
- Files added (restored mirror from tag): `deploy/compose/{dev,stage,prod}/docker-compose.*.yml` + `pgadmin-servers.json` (22 files), `deploy/compose/start.sh`, `deploy/compose/push.sh`, `tools/{validate-inputs,check-env,check-product-sync,hydration-lint}.mjs`, `.github/workflows/docker-publish.yml`, `apps/yelli/.dockerignore`, `MANIFEST.txt` (fresh), `.socraticodecontextartifacts.json` (fresh; gitignored — machine-local).
- Files modified: `apps/yelli/Dockerfile` (removed api-client + storage COPY lines — not scaffolded yet; fixed build filter `@yelli/yelli` → `@yelli/web`); `.github/workflows/ci.yml` (wired `pnpm --filter @yelli/db run db:generate` before the turbo typecheck/build matrix — plan item); `package.json` (+4 `tools:*` scripts; +`pnpm.onlyBuiltDependencies = [argon2, esbuild, @prisma/client, prisma]` — plan item, exact proven value from tag); `docs/STATE.md`; `docs/DECISIONS_LOG.md` (S5 answer-log).
- Files deleted: none.
- Compose services (q-run9-S5-02): postgres+pgbouncer · valkey · minio · pgadmin · app (all envs); mailhog/infra (dev only); cloudflared sidecar (prod only). NO coturn (scope-sheet template error — no backing in inputs.yml/.env/CREDENTIALS.md/tag). pgAdmin + MailHog retained: both have full config backing (inputs.yml ports + .env keys + CREDENTIALS.md sections) → part of "mirror the structure."
- Scope note (tools/): `tools/` is not in the literal S5 scope line but was included — four converging signals: framework Part 7 bundles tools/ with deploy; the in-scope `ci.yml` governance job hard-depends on the `tools:*` scripts; STATE.md NEXT explicitly said "tools/ lands in S5"; the tag contains them. js-yaml + ajv already resolved in the lockfile → dependency-clean restore. All three validators run green on current config.
- Schema/migrations: none.
- Tier: 1 — lightweight (mostly faithful restore + ~30 hand-authored lines of adaptation; no thrash).
- Errors encountered: none. (Dockerfile would have failed `docker build` on the two non-existent package COPYs + wrong app filter — caught pre-build via package-reality check, fixed before validation.)
- Errors resolved: Dockerfile package-set + filter-name drift vs clean-slate reality (see above).
- Verification: `pnpm install --frozen-lockfile` ✓ (lockfile unchanged); `pnpm --filter @yelli/db run db:generate` ✓; `pnpm lint` ✓ (5/5); `pnpm test` ✓ (@yelli/web 2/2); `pnpm build` ✓ (static); `pnpm tools:validate-inputs` ✓; `pnpm tools:check-env` ✓; `pnpm tools:check-product-sync` ✓.
- Drift review: NO new `lessons.md` entry — same single-executor swarm-worker / V32.1 dispatch fallback already logged; no new 🔴 evidence.
- Dispatch ratio (S5): sonnet_writes=0, opus_writes=1; N/A for the headless swarm-worker model (sub-agent dispatch unavailable). Documented in STATE.md EXECUTION NOTE.
- Deferred (q-run9-S5-03): `.github/workflows/release.yml` (semver `:vX.Y.Z` + floating `:prod`) + `deploy/windows/*.ps1` (5 LAN-installer scripts) — restorable from the tag in a dedicated future session.

### 2026-06-09 — Phase 3.3 Wave 9 — Flow G Manage Devices walkable (PRODUCT.md §3 Flow G)

- Agent: CLAUDE_CODE (Opus 4.7 — R1 DEVIATION: standing acceptance per Wave 7 STATE.md NEXT-field; fifth consecutive wave Opus-inline; framework-layer skill auto-load budget fix still pending — no Sonnet dispatch attempted this wave).
- Commit: pending (code + governance bundled).
- Why: 7th of 9 §3 Core User Flows. Wave 4B's `ScreenAdminMembers` was narrowed to Flow C call-role-assign only; Wave 9 expands the same screen with full device-lifecycle admin: clickable All / Online / Archived filter, per-row Rename, single-device Archive, Unarchive, Remove. Reuses existing `OverlayCallRoleAssign` for role-change (Flow C).
- Files added: none.
- Files modified:
  - `prototype/src/lib/sim/repo.ts` (+17L): new `devices.archiveOne(id, adminUserId?)` — single-device manual archive sibling to existing batch `devices.archive(olderThanDays)`. Emits §11-canonical singular `device.archive` audit row `{deviceId}` (distinct from existing `device.archive.batch` so admin-initiated archives are traceable). Existing `setDisplayName` / `unarchive` / `remove` unchanged (already §11-canonical from Waves 5–6).
  - `prototype/src/screens/ScreenAdminMembers.tsx` (187L → ~245L; ~+58L net): adds `filter` state `'all' | 'online' | 'archived'`; filter pills become clickable single-source filter toggles; per-row action set splits by archive state — active devices show `Change role` / `Rename` / `Archive`, archived devices show `Unarchive` / `Remove`; empty-state card when no devices match filter; mobile card layout reflows actions below identity block. Rename uses `window.prompt`, Archive/Remove use `window.confirm` — prototype-tier UX consistent with Wave 5's name-picker pattern. Counts on pills reflect active vs total semantics (`All · {active.length}`, `Archived · {archivedCount}`).
- Files deleted: none.
- Schema/migrations: none. `Device.archivedAt` field already present (Wave 1 schema).
- Sim audit emits: new single `device.archive {deviceId}` introduced (singular form, complementing existing `device.archive.batch`). All other emits unchanged. PRODUCT.md §11 enumerates `device.archive` as canonical — Wave 9 finally exercises it from the UI layer.
- Tier: 1 — lightweight (2 files modified, ~75L gross / ~75L net; would have been a single Sonnet dispatch had the dispatch layer worked).
- Errors encountered: none (typecheck exit 0 first try).
- Errors resolved: none.
- Walkable now: A Calling + B Receive + C Admin-Assigns-Role + D Register-Device + E LAN-Admin-Login + F Invite + G Manage-Devices. **7 of 9** §3 Core User Flows walkable.
- Verification: (1) `cd prototype && npx tsc --noEmit` exits 0 first try. (2) `cd prototype && npm run dev` → http://localhost:4838 → login as admin (passphrase `yelli-admin` from Wave 7) → nav "Members" → ScreenAdminMembers; (3) click `All / Online / Archived` pills → list filters; (4) on an active row click `Rename` → enter new name → list updates; `auditLog.list()` shows `{action:'device.rename', payload:{deviceId, from, to}}`; (5) click `Archive` on active row → confirm → row disappears from All view, `Archived` pill count increments; `auditLog.list()` shows `{action:'device.archive', payload:{deviceId}}`; (6) click `Archived` pill → archived devices listed; click `Unarchive` → row returns to All view; audit `{action:'device.unarchive'}`; (7) click `Remove` on archived row → confirm → row gone permanently; audit `{action:'device.delete'}`. Filter pills show correct counts at all times.
- Drift review: NO new `lessons.md` entry — same dispatch-layer regression root cause + same Opus-inline mitigation as Waves 5–8 (already logged); standing acceptance pattern continues without new evidence.
- Dispatch ratio (Wave 9 session): sonnet_writes=0, opus_writes=~5 (2 code Edit/Write + ~3 governance Edits); ratio 0.0 — FAIL by V32 R9 metric. Standing acceptance per Wave 7 falsification — environment-structural, not session-accumulated.

### 2026-06-09 — Phase 3.3 Wave 8 — Flow F Invite walkable (PRODUCT.md §3 Flow F)

- Agent: CLAUDE_CODE (Opus 4.7 — R1 DEVIATION: standing acceptance per STATE.md NEXT-field recommendation after Wave 7's fresh-session-reset falsification)
- Commit: `ac1a003` (code) + this entry's checkpoint commit (governance)
- Why: Continue Phase 3.3 walkable progression. Adds 6th of 9 §3 Core User Flows: a cloud + LAN-account-mode admin can invite a member by email; an invited recipient can accept via the simulated invitation link and become a tenant member.
- Files added:
  - `prototype/src/screens/ScreenAdminInvitations.tsx` (~150L) — admin-gated screen: pending/accepted/expired Invitation list, email-input create form (7-day TTL handled by `sim.invitations.create` from Wave 2B), "Open link" deep-routes to ScreenJoinByInvite via new `go('join-invite:<id>')` protocol, "Revoke" calls `sim.invitations.expire`. On-demand `ensureAdminUser(tenantId)` synthesizes a stub admin User when the seed mode is LAN-anonymous (no users seeded) so `invitations.create(tenantId, email, invitedByUserId)` has a valid `invitedByUserId` without changing the global seed mode — preserves Wave 7 admin-login + Wave 5 first-join walkability.
  - `prototype/src/screens/ScreenJoinByInvite.tsx` (~120L) — 3-phase state machine: `review` → `accepted` | `invalid`. Initial state computed in one useMemo (validates tenant scope, expiry, already-accepted). On accept: provisions the member User via `sim.users.create` if not already present, then `sim.invitations.accept` (sim repo emits §11-canonical `invitation.accept` audit row). PRODUCT.md §3-compatible generic copy on invalid/expired (no enumeration leak).
- Files modified:
  - `prototype/src/app/page.tsx` (+33L): Screen union gains `'admin-invitations'` + `'join-invite'`; new `joinInviteId` state; `go()` parses `'join-invite:<id>'` protocol and pre-fills `joinInviteId`; `'admin-invitations'` admin-gated via `adminSession.current()` mirroring Wave 7's single-source routing gate (no per-screen guard spread across screens).
  - `prototype/src/components/TenantTopBar.tsx` (-1L net): nav `items` swap stub `'members'`/`'orgSettings'` for the real routes `'admin-members'` + new `'admin-invitations'` (matches BottomNav `'admin-members'` key already in place from Wave 4).
  - `TODO`: append Wave 8 line marked complete.
- Files deleted: none.
- Schema/migrations: none. `Invitation` type + `invitations` repo unchanged (Wave 2B baseline already had `create / accept / expire / list / byId`). `User` type + `users.create` unchanged.
- Sim audit emits: unchanged — `invitation.create {invitationId, email}` and `invitation.accept {invitationId}` already present in Wave 2B baseline. `user.create {userId, email, role}` already present. All §11-canonical; no new audit-action enum values introduced this wave.
- Tier: 1 — lightweight (4 files total, ~313L gross, ~313L net new — no deletions; would have been a single Sonnet dispatch had the dispatch layer worked).
- Errors encountered: none (typecheck exit 0 first try).
- Errors resolved: none.
- Walkable now: A Calling + B Receive + C Admin-Assigns-Role + D Register-Device + E LAN-Admin-Login + F Invite. **6 of 9** §3 Core User Flows walkable.
- Verification: (1) `cd prototype && npx tsc --noEmit` exits 0 first try; (2) `cd prototype && npm run dev` → http://localhost:4838 → log in as admin (Wave 7: passphrase `yelli-admin`) → nav "Invites" → enter an email → "Send invite" → list shows `Pending` row → "Open link" → ScreenJoinByInvite shows `review` phase with the invited email → enter a name → "Accept & join" → `accepted` phase confirms; back at Invites the row now shows `Accepted`. `auditLog.list()` last two entries: `{action:'user.create', payload:{email, role:'member'}}` then `{action:'invitation.accept', payload:{invitationId}}`. (3) Revoke on a pending invitation → row flips to `Expired`. (4) Already-accepted or expired link → `invalid` phase ("This invitation is invalid, expired, or has been revoked.").

#### Dispatch ledger (this session, Wave 8)

- Executor (Opus inline): Opus 4.7 — SUCCEEDED, R1 DEVIATION DOCUMENTED HERE
- No Sonnet dispatch attempted this wave: per STATE.md NEXT-field standing recommendation after Wave 7's 1-word-`pwd` falsification test, fresh-session resets do NOT clear the environment-structural Sonnet baseline-overhead regression; pursuing further Sonnet dispatches at the prototype scope would only burn additional rejection cycles without surfacing new diagnostic signal. Fourth consecutive wave R1 deviation.

#### Dispatch ratio (R9)

- sonnet_writes: 0 (no Sonnet Edit/Write — dispatch attempt deliberately skipped under standing recommendation)
- opus_writes: ~7 (Wave-8 code: 4 Edit/Write ops on 4 files; this checkpoint: ~3 governance Edits)
- ratio: 0 / 7 = 0
- target: ≥ 3.0
- status: FAIL (<1.0)
- trigger: extends prior waves' lessons.md entry on V32.1 dispatch-layer regression (no NEW entry — same root cause + same mitigation; redundant)
- root cause: NOT Opus drift — same as Waves 5+6+7 environment-structural baseline overhead. Pursue framework-layer fix (skill auto-load budget) before retrying Sonnet path.

### 2026-06-09 — Phase 3.3 Wave 7 — Flow E LAN admin login walkable (PRODUCT.md §3 Flow 18)

- Agent: CLAUDE_CODE (Opus 4.7 — R1 DEVIATION: dispatch-layer rejection cascade persisted into fresh session)
- Commit: `ee4c90c` (code) + this entry's checkpoint commit (governance)
- Why: §3 Flow 18 (LAN-anonymous-admin sign-in) was the next missing core flow per STATE.md NEXT field. Step 6 lock (Argon2id passphrase + `yelli_admin_session` HttpOnly cookie + 5-step middleware chain) is Phase 4 backend concern — prototype simulates the user-facing flow (passphrase → audit emit → routing gate) without the cryptography, so Phase 4 swap is the persistence + auth-layer substitution while UI behavior already matches the contract.
- Files (Tier 1, ~145L gross / ~55L net across 5 modified + 1 new):
  - `prototype/src/lib/sim/types.ts` (+6L): new `AdminSession` type; new `'adminSession'` key in `TABLES` const.
  - `prototype/src/lib/sim/repo.ts` (+48L append-only at EOF): new `adminSession` module — `current()` returns single-row or null; `login(tenantId, passphrase)` returns discriminated `{ok:true, session} | {ok:false, reason:'wrong-passphrase'}` with §11-canonical audit emit per branch (`lan.admin.login.success`/`lan.admin.login.fail` payload `{}`); `logout()` clears row + emits `lan.admin.logout`. SIM stub passphrase `'yelli-admin'` (plaintext compare) with inline marker comment pointing Phase 4 swap at Argon2id + `Tenant.adminPassphraseHash`. No edits to existing repo code — append-only addition.
  - `prototype/src/lib/sim/index.ts` (+1L): barrel exports `adminSession`.
  - `prototype/src/lib/sim/seed.ts` (+1L): LAN-anon seed branch calls `tenants.setAdminPassphrase(tenant.id, 'yelli-admin')` after tenant creation — emits `tenant.admin.passphrase.set` audit row so the §11-canonical first-run-wizard signature is present in sim from boot.
  - `prototype/src/screens/ScreenAdminLogin.tsx` (NEW, 79L): `'use client'` passphrase form; controlled `<input type="password">`; submit calls `adminSession.login`; on `{ok:true}` routes to `'admin-members'`; on `{ok:false}` sets error to PRODUCT.md §3-verbatim generic string `"Couldn't sign in"` + clears input (no enumeration leak). Reuses `TenantTopBar` + `AppFooter` + `BottomNav` for layout consistency with Wave 4B's `ScreenAdminMembers`. Demo passphrase shown inline (`yelli-admin`) for prototype walkability per Phase 3.3 client-validation goal.
  - `prototype/src/app/page.tsx` (+10L): `Screen` union gains `'admin-login'`; new gated branch — `if (screen === 'admin-members')` now checks `adminSession.current()` and returns `ScreenAdminLogin` when null; explicit `'admin-login'` branch added for direct routing. Single-source gating point — no per-route gate scattered across `ScreenAdminMembers`.
- Audit-emit vocabulary (§11-canonical):
  - `lan.admin.login.success` on correct passphrase — `tenantId`, `payload:{}`
  - `lan.admin.login.fail` on wrong passphrase — `tenantId`, `payload:{}` (matches §3 line 73 generic "Couldn't sign in" + AuditLog spec verbatim)
  - `lan.admin.logout` on logout — kept for prototype symmetry; not in §11 enumeration; Phase 4 backend may drop in favor of cookie-expiry-only signal
  - `tenant.admin.passphrase.set` emitted from sim seed on tenant creation (already existed via `tenants.setAdminPassphrase`; Wave 7 just exercises it)
- TypeScript: `cd prototype && npx tsc --noEmit` → exit 0 on first run (no errors, no warnings).
- DISPATCH-LAYER REGRESSION — FRESH-SESSION HYPOTHESIS FALSIFIED:
  - Wave 6 STATE.md NEXT field recommended testing a fresh Claude Code session for Wave 7 to reset accumulated baseline context inheritance.
  - Wave 7 opened in a verified fresh session. Two dispatch attempts:
    1. `Agent(subagent_type:"general-purpose", model:"sonnet")` with ~3K-token wave-impl prompt → REJECTED "Prompt is too long" (agentId `a933df73...`)
    2. Same agent with the literal 1-word prompt `pwd` as a falsification test → ALSO REJECTED "Prompt is too long" (agentId `a076ca12...`)
  - Hypothesis FALSIFIED. A 1-word prompt rejection at fresh-session start proves the rejection is NOT session-accumulated context overhead — it is **environment-structural Sonnet baseline inheritance**. The Sonnet subagent's auto-loaded skills + MCP descriptions exceed budget *before* the task prompt is evaluated, independent of session age.
  - Cumulative session-failure count across Waves 5+6+7: **8 dispatches, 3 subagent_types (general-purpose, Explore, code-simplifier:code-simplifier), 0 successes** at prompt sizes spanning 1 word to ~3K tokens.
  - Per V32 R4 and prior wave precedent: fell back to Opus inline as **documented R1 deviation**. Same root cause as existing `🔴 V32.1 dispatch-layer regression at small prompt sizes` lessons.md entry — no new entry written (redundant; same diagnosis, same mitigation).
  - This is the THIRD consecutive wave the R1-deviation pattern has been forced. Tier 1 work justifies Opus inline as bounded cost when dispatch path is structurally unavailable; the deviation is being honestly recorded for audit (not suppressed) so R9 metric retains signal for genuine future Opus-drift events.
- dispatch_ratio (Wave 7 only):
  - sonnet_writes: 0 (dispatch-layer-blocked, 2 attempts including 1-word falsification test)
  - opus_writes: 6 code edits + 3 governance edits (CHANGELOG + IMPLEMENTATION_MAP + STATE.md checkpoint) = 9
  - ratio: 0 / 9 = 0 — status FAIL (<1.0)
  - trigger: extends Wave 5+6 lessons.md entry; no new entry (redundant). Root cause confirmed environment-structural by 1-word falsification.
- Walkability:
  - `cd prototype && npm run dev` → http://localhost:4838
  - Top-bar/sidebar **Admin** → routed to admin-members → no active session → login screen shown
  - Enter wrong passphrase → generic "Couldn't sign in" + `lan.admin.login.fail` audit row
  - Enter `yelli-admin` → routed to ScreenAdminMembers (Wave 4B Flow C) + `lan.admin.login.success` audit row
  - Direct nav to `admin-login` works as standalone route too
- §3 Core User Flows walkable: **5 of 9** (was 4): A Calling + B Receive + C Admin-Assigns-Role + D Register-Device + **E LAN-Admin-Login**
- Remaining §3 flows (4): F Invite, G Manage Devices full, H Audit View, I Tenant Export

### 2026-06-09 — Phase 3.3 Wave 6 — Housekeeping: sim audit emits canonical (collapses Wave 4B + Wave 5 double-emit pairs)
- Agent: CLAUDE_CODE (Opus 4.7 inline — R1 DEVIATION, see Dispatch ledger)
- Why: STATE.md NEXT-field housekeeping bundle. Two prior waves left audit-emit drift: Wave 4B's `device.role.assign` payload was `{deviceId, role}` instead of §11's `{from, to}`; Wave 5's first-join scenario emitted BOTH a UI-side `device.first_join` and sim's trailing `device.rename` for the same operation. Closing both before Phase 4 backend swap ensures the sim layer's audit shape already matches the production contract — the swap becomes a pure persistence substitution, not a vocabulary migration.
- Scope decision: User selected "Housekeeping only (~40L, safe)" via AskUserQuestion when offered three options (housekeeping-only / Flow E-only / both). Flow E (LAN-anonymous-admin login) deferred to Wave 7. Rationale: prior wave's 4/4 dispatch failures made a combined ~150L wave higher-risk; housekeeping-only maximized landing probability.
- Files modified:
  - prototype/src/lib/sim/repo.ts (+19/-12 = +7L net) — setDisplayName captures prior row, branches on `prior.displayName.trim() === ''` to emit `device.first_join {deviceId, name}` (first set) vs `device.rename {deviceId, from, to}` (subsequent); setRole captures prior row, emits `device.role.assign {deviceId, from, to}` (was `{deviceId, role}`)
  - prototype/src/screens/ScreenApp.tsx (+4/-14 = -10L net) — saveMyName collapses from 19L → 5L; removed UI-side conditional `auditLog.append({action:'device.first_join'})` block (sim is now sole emission point); removed `isFirstJoin` local; dropped `auditLog` import from `@/lib/sim` (verified unused via grep before removal)
- Files added: none
- Files deleted: none
- Schema/migrations: none (sim layer only)
- Audit vocabulary state (post-Wave 6):
  - `device.first_join` — now emitted by sim.devices.setDisplayName on first-set (was UI duplicate + sim's wrong-action `device.rename`)
  - `device.rename` — now emitted with canonical `{deviceId, from, to}` payload on subsequent rename (was `{deviceId, displayName}`)
  - `device.role.assign` — now emitted with canonical `{deviceId, from, to}` payload (was `{deviceId, role}`)
  - `device.create` — STILL emits non-canonical action name (§11 prefers `device.first_join` on Device row creation); preserved this wave to keep scope bounded. Phase 4 backend collapses this into a single `device.first_join` per Device insert + rename.
- Errors encountered: zero. TypeScript exits 0 first try (mechanical refactor with no signature changes — all callers of setDisplayName/setRole continue to compile unchanged).
- Errors resolved: n/a
- Dispatch ledger (this session):
  - Attempt 1: `Agent(subagent_type:"code-simplifier", model:"sonnet")` — REJECTED "Prompt is too long" at ~1500 token prompt
  - Attempt 2: `Agent(subagent_type:"general-purpose", model:"sonnet")` with minimal ~30-token prompt pointing at `.wave6-task.md` scratch file (deliberate baseline-pressure test) — STILL REJECTED "Prompt is too long"
  - Fallback: Opus 4.7 inline — SUCCEEDED. R1 deviation documented in commit body.
  - Combined with Wave 5: 6 total dispatch-layer rejections across two distinct subagent_types this session, prompt sizes 30–1500 tokens, all rejected BEFORE prompt evaluation. Confirms V32.1 operational note (baseline overhead from auto-loaded skills + MCP context inheritance) — NOT Opus drift. Per V32 R4, this exceeds the 3-attempt re-decomposition ceiling; correct response is defer or scope-reduce dispatch path entirely, not infinite retry.
- dispatch_ratio (this session):
  - sonnet_writes: 0 (dispatch-layer-blocked, both attempts)
  - opus_writes: ~5 (2 code Edits + 1 scratch Write + 1 scratch rm + this checkpoint's governance Edits — full count after checkpoint completes)
  - ratio: 0 / 5 = 0
  - target: ≥ 3.0
  - status: FAIL (<1.0)
  - trigger: extends prior wave's lessons.md entry on dispatch-layer regression (no NEW lesson written — same root cause, same mitigation)
- TIER_CLASSIFICATION: 1 — lightweight (2 files, ~40L gross / -3L net)
- LOC delta: -3L net (collapsed duplicate emit logic; refactor produced cleaner code than it replaced)
- Commit: `b64b251` on `main`. Working tree clean post-commit.
- Next: Wave 7 — Flow E (LAN-anonymous-admin login per Step 6 spec). Sim shape gap to resolve in Wave 7: prototype needs an "admin session" state (currently no auth/session concept in sim). Pre-Wave-7 recommendation: if dispatch-layer regression persists, consider a fresh Claude Code session to reset inherited baseline context (the 4+ system-reminder banners stacked in this session likely contribute), OR continue with Opus inline + documented R1 deviation pattern.

### 2026-06-08 — Phase 3.3 Wave 3 — Calling flow walkable (PRODUCT.md §3 Flow A)
- Agent: CLAUDE_CODE (Opus 4.7 Architect + Sonnet 4.6 Executor, V32 R1; Opus writes restricted to R8 allow-list)
- Why: V32.6 Phase 3.3 first Core User Flow — wire the Wave 2 sim layer to a walkable Calling experience inheriting MOCKUP.jsx visuals VERBATIM (V32.5 INHERIT-not-REPLACE). Validates the swap-boundary contract end-to-end before remaining 8 flows.
- Files added:
  - prototype/src/lib/tokens.ts (12L), prototype/src/lib/dummy-tenant.ts (11L)
  - prototype/src/components/Pill.tsx (34L), CallRoleLabel.tsx (13L), AppFooter.tsx (12L), TenantTopBar.tsx (59L "use client"), BottomNav.tsx (33L)
  - prototype/src/screens/ScreenApp.tsx (220L "use client") — Directory + Demo-view-as role toggle + CALL placement
  - prototype/src/screens/ScreenActiveCall.tsx (84L "use client") — in-call view + END
- Files modified:
  - prototype/src/app/page.tsx (REPLACED from Wave 2 placeholder, 58L) — screen router useState<"app"|"call"> + seedDefaults bootstrap + runtime tenantId from tenants.list()[0]
  - .cline/STATE.md, docs/CHANGELOG_AI.md, docs/IMPLEMENTATION_MAP.md (governance — Opus R8 allow-list writes)
- Schema/migrations: none (sim layer only)
- Sim methods exercised: seedDefaults, tenants.list, devices.list, devices.setRole, devices.byId, callSessions.create, callSessions.byId, callSessions.end, auditLog.append. Wired CALL → create+audit.write('call.placed') → setActiveCallId → go('call'). Wired END → end(id,'completed')+audit.write('call.ended') → go('app'). Wired "Demo: view as" → devices.setRole + state.
- Errors encountered: 3 typecheck residuals from parallel Sonnet dispatches — (1) Wave 3A used `export default` while Wave 3B used `import { Named }` (R7 parallel coordination gap); (2) `tenants.list()[0]` failed TS2532 under noUncheckedIndexedAccess; (3) `go: (screen: Screen) => void` failed strictFunctionTypes contravariance against BottomNav's wider `(screen: string) => void`.
- Errors resolved: 2 small Sonnet fix dispatches (3C-1 + 3C-2). 5 import lines changed to default + nullable guard via `?? ""` + widened ScreenApp signature with `as Screen` cast in page.tsx. Final `npx tsc --noEmit` exits 0.
- Audit-action reconciliation pending: `sim.callSessions.create` already emits internal `call.start` audit + `.end` emits `call.end`; Wave 3B layered PRODUCT.md §11 names `call.placed`/`call.ended` on top (additive). Next wave drops sim-emitted names in favor of PRODUCT.md canonical.
- Stubs deferred to Wave 4: incomingCall / namePicker / pwa / offline overlays render null; mute/camera/speaker/swap call controls are no-op `onClick`; 02:14 timer hardcoded; "me device" picked as `visibleMembers[0]` (no auth context yet).
- Dispatch ledger: 3 Sonnet scouts (PRODUCT/DESIGN/MOCKUP) + 2 Sonnet exec (3A 174L/123s/13t, 3B 361L/199s/15t) + 2 Sonnet fixes (3C-1 ~8L/57s/6t, 3C-2 ~2L/59s/9t). dispatch_ratio: 4 sonnet_writes / 3 opus_writes (3 governance docs) = 1.33 (WARN — within tolerance; R9 FAIL only triggers <1.0). Three independent governance docs in one checkpoint inflate the opus side this wave; rebounds next wave.
- LOC delta: ~570L net new across 11 files. Each Sonnet dispatch ≤500L per V32 R2 — improvement vs Wave 2B's 821L overshoot.
- Next: Wave 4 — Flow B Receive (incoming-call overlay + accept/reject paths). Likely paired with Flow C Admin-Assigns-Role in same dispatch round if R7 parallelism holds.

### 2026-06-08 — Phase 3.3 Wave 2 — Prototype scaffold + simulated data layer
- Agent: CLAUDE_CODE
- Why: V32.6 Phase 3.3 hard gate before Phase 3.5 — lay the prototype foundation (Next.js scaffold + sim/ swap-boundary module + design-token EXPAND) so subsequent waves can build flow screens against a stable base.
- Files added:
  - prototype/package.json, prototype/tsconfig.json, prototype/tailwind.config.ts, prototype/next.config.mjs, prototype/postcss.config.mjs
  - prototype/src/app/layout.tsx, prototype/src/app/page.tsx, prototype/src/app/globals.css
  - prototype/README.md, prototype/.gitignore
  - prototype/src/lib/sim/types.ts (105L) — 6 entity shapes mirroring PRODUCT.md §11
  - prototype/src/lib/sim/storage.ts (73L) — SSR-safe localStorage + cross-tab/same-tab pub/sub
  - prototype/src/lib/sim/repo.ts (448L) — typed repos for all 6 entities + per-write AuditLog
  - prototype/src/lib/sim/seed.ts (146L) — idempotent LAN-anon / LAN-account / Cloud demo fixtures
  - prototype/src/lib/sim/clock.ts (41L) — time-travel helper for 90d archive simulation
  - prototype/src/lib/sim/index.ts (8L) — barrel export, the ONLY UI import surface
- Files modified:
  - docs/DESIGN.md (+37L EXPAND per V32.5 INHERIT-not-REPLACE: motion 3 durations + 3 easings, shadows 5 elevations, z-index 6 layers; no existing tokens modified)
  - .cline/STATE.md, docs/DECISIONS_LOG.md, docs/IMPLEMENTATION_MAP.md, .cline/memory/lessons.md (this dispatch — governance writes)
- Schema/migrations: none (sim layer only — real schema lives in Phase 4 Part 3)
- Errors encountered: 1 — Wave 2B Sonnet dispatch wrote 821L total (repo.ts alone 448L), exceeding V32 R2 500L-per-task gate by 64%. The repo file naturally grew large because the swap-boundary contract requires one barrel covering all 6 entities + per-write audit-log entries; no meaningful abstraction layer can be inserted without breaking the Phase 4 swap promise.
- Errors resolved: tactically accepted (no further split for this foundational wave; the volume is one-time). Logged as 🔴 gotcha in `.cline/memory/lessons.md`. Future per-flow waves will be strictly under the gate (UI primitives and flow screens are naturally smaller surfaces).
- Decisions locked: simulation technique (in-memory + localStorage + 6-namespace barrel) recorded in DECISIONS_LOG.md as LOCKED 2026-06-08.
- Dispatch ledger: 3 Sonnet dispatches (A=scaffold 315L/~112s, B=sim 821L/~141s, C=this governance checkpoint). dispatch_ratio: 3 sonnet_writes / 0 opus_writes = ∞ (target ≥ 3.0, status PASS).
- LOC delta: ~1173L net new (315 scaffold + 821 sim + 37 DESIGN.md EXPAND) plus ~70L across 5 governance files.
- Next: Wave 3 — UI primitives (shadcn aligned to expanded tokens) + first Core User Flow (Calling, per PRODUCT.md §3 Flow A). Then iterative waves per remaining 8 flows → /design-review + docs/PROTOTYPE.md + client sign-off → Phase 3.3 gate-closure → Phase 3.5.

### 2026-06-07 — Phase 3 spec files generated (V32.6.1 canary rebuild)
- Agent: CLAUDE_CODE
- Why: Generate inputs.yml + JSON schema + sync-credentials script per CLAUDE.md Phase 3 contract. Validate env files survived clean-slate wipe with credentials intact.
- Files added:
  - inputs.yml (151L) — V3 schema; locked tech stack + port base 46838 + 8 entities + 6 modules + 4 roles
  - inputs.schema.json (274L) — JSON Schema Draft 2020-12 strict validation
  - scripts/sync-credentials-to-env.sh (99L, +x) — propagates CREDENTIALS.md filled values → .env files (Xendit + Turnstile sections pruned per Yelli config)
- Files modified:
  - .cline/STATE.md (rewrite — Phase 3 complete)
  - docs/DECISIONS_LOG.md (append — port strategy, turnstile=false, a11y=none, payment=none, vibe_test=true all LOCKED)
  - docs/IMPLEMENTATION_MAP.md (append — Phase 3 row)
- Files validated (existing, no edit):
  - .env.dev, .env.staging, .env.prod, .env.example (survived clean-slate wipe, gitignored, AI-generated credentials intact)
- Schema/migrations: none (Phase 4 Part 3 owns schema)
- Errors encountered: none
- Errors resolved: none
- Dispatch ledger: 4 Sonnet dispatches under V32 R1/R7 (A=inputs+schema, B=env validation, C=sync script, D=governance writes). dispatch_ratio: 4 sonnet_writes / 0 opus_writes = ∞ (target ≥ 3.0, status PASS).
- Decisions locked in DECISIONS_LOG.md: port base 46838, Turnstile disabled, accessibility=none, payment=none, vibe_test enabled.
- LOC delta: ~711 lines net new + 4 governance file updates.
- Next: Phase 3.3 (Interactive Prototype & Simulation, V32.6) auto-runs from PRODUCT.md §3 + DESIGN.md baseline.

### 2026-06-07 — Clean-slate wipe for V32.6.1 canary rebuild
- Agent: CLAUDE_CODE
- Tag: clean-slate-20260607
- Commit: 0a94f48
- Backup: ~/clean-slate-backup-20260607T064929Z.tar.gz
- Pre-wipe IMPLEMENTATION_MAP archived for reference.

## Archived — Pre-Clean-Slate (V31 baseline, archived 2026-06-07)

Reference-only. No code from the entries below survives on the filesystem after commit `0a94f48`. Retained as historical attribution + decision trail for the V32.6.1 rebuild.

## 2026-06-03 — Phase 7 Feature 3f: fix PgBouncer config generation (DATABASE_URL → individual env vars)
- Agent: CLAUDE_CODE
- Why: PgBouncer container's `[databases]` section was generating garbage when the postgres password contained a literal `/` character (edoburu/pgbouncer entrypoint splits the DATABASE_URL on `/` without URL-decoding). Plain password used in DB_PASSWORD env var, not URL-encoded — so the encoded-in-DATABASE_URL workaround did not apply. App was bypassing pgbouncer via DATABASE_URL_INTERNAL → direct postgres connection, so the bug was non-blocking but real. Additionally, `DATABASE_URL` from env_file contained `?schema=public` which caused a pgbouncer syntax error at startup. Fixed by switching all 3 env (dev/staging/prod) compose pgbouncer services to use individual DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME env vars edoburu also supports, plus setting `DATABASE_URL: ""` in the environment block to prevent the env_file value from taking precedence. No .env changes — those vars already exist as plain strings.
- Files added: none
- Files modified:
  - deploy/compose/dev/docker-compose.db.yml (pgbouncer environment: replaced DATABASE_URL with DATABASE_URL="" + 5 individual DB_* vars)
  - deploy/compose/stage/docker-compose.db.yml (same)
  - deploy/compose/prod/docker-compose.db.yml (same)
- Files deleted: none
- Schema/migrations: none
- Errors encountered: garbled [databases] config (RDNEGY@yelli_dev_postgres:5432/yelli_dev = host=... — mangled split on `/`); pgbouncer syntax error from `?schema=public` in dbname; env_file `DATABASE_URL` taking precedence over `environment:` block individual vars
- Errors resolved: clean [databases] config (yelli_dev = host=yelli_dev_postgres port=5432 auth_user=...) — pgbouncer starts and runs without config errors
- Note: Pgbouncer is functional now but the app still routes through DATABASE_URL_INTERNAL (direct postgres). Switching the app to pool through pgbouncer is a separate Feature Update (requires verifying transaction-mode pooling against prisma's prepared-statement usage).

## 2026-06-03 — Bug fix retroactive doc: SessionProvider missing from tree (commit 43a1b77)
- Agent: CLAUDE_CODE
- Why: During Phase 7 Feature 3d-1 Playwright smoke, the new useSession() call in DeviceList crashed SSR because SessionProvider was not in the provider tree. Sonnet committed the fix directly to main as 43a1b77 mid-smoke without a feature branch (Rule 23 deviation, justified by emergency context). This entry documents the fix retroactively per Rule 15 attribution requirements.
- Files added: none
- Files modified:
  - apps/yelli/src/components/providers/TRPCProvider.tsx (wrapped children in <SessionProvider> from "next-auth/react") — +6 -3 lines
- Files deleted: none
- Schema/migrations: none
- Errors encountered: SSR crash on every page request after 3d-1 client merge
- Errors resolved: SessionProvider mount in root provider tree
- Note: Rule 23 (branch-per-feature) deviation deliberate due to emergency. lessons.md gotcha entry added in 3e batch alongside this CHANGELOG retroactive doc.

## 2026-06-03 — Phase 7 Feature 3e: vitest + RTL component test infrastructure
- Agent: CLAUDE_CODE
- Why: No test infra existed in apps/yelli (discovered during 3d-1 scope assessment). Future client-component features cannot follow Rule 25 TDD without this. Establishes vitest v3.2.6 (jsdom env) + @vitejs/plugin-react (new JSX transform for React 19) + React Testing Library + jest-dom matchers + a sanity test suite (3 tests) that proves the infra works. Retroactive tests for Phase 7 Features 1+2 and 3d-1 (RegisterDeviceButton, DeviceList, CallingModal, IncomingCallModal) are NOT in this dispatch — they are separate Feature Updates unblocked by this infra.
- Files added:
  - apps/yelli/vitest.config.ts (jsdom env, @vitejs/plugin-react for React 19 JSX transform, alias @→./src, setupFiles)
  - apps/yelli/src/test/setup.ts (jest-dom matchers via @testing-library/jest-dom/vitest + matchMedia stub)
  - apps/yelli/src/test/sanity.test.tsx (3 tests: RTL render, regex query, toHaveTextContent — proves full infra stack)
- Files modified:
  - apps/yelli/package.json (devDeps: @testing-library/jest-dom ^6.6.3, @testing-library/react ^16.3.0, @testing-library/user-event ^14.5.2, @vitejs/plugin-react ^4.5.2, jsdom ^26.1.0, vitest ^3.2.4, @vitest/ui ^3.2.4; scripts: test, test:watch added)
  - pnpm-lock.yaml (regenerated)
- Files deleted: none
- Schema/migrations: none
- Errors encountered: React is not defined — React 19 uses new JSX transform; vitest needs @vitejs/plugin-react to auto-inject the import
- Errors resolved: added @vitejs/plugin-react to vitest.config.ts plugins array; all 3 tests pass

## 2026-06-03 — Phase 7 Feature 3d-1 (client half): call invitation UI
- Agent: CLAUDE_CODE
- Why: First user-facing call placement flow per PRODUCT.md core flow A. CALL button on DeviceList rows (hidden against receiver-only peers and self), invite mutation, "Calling..." modal with CANCEL + 30s no-answer auto-end, callee IncomingCallModal with Accept/Reject. NO WebRTC media in this slice — pure invitation lifecycle. 3d-2 will add Valkey pub/sub WS signaling to replace polling.
- Files added:
  - apps/yelli/src/hooks/use-incoming-call.ts (~18L — polls trpc.calls.pending every 3s)
  - apps/yelli/src/components/calls/CallingModal.tsx (~90L — caller side, CANCEL + 30s no-answer timer)
  - apps/yelli/src/components/calls/IncomingCallModal.tsx (~75L — callee side, Accept/Reject)
- Files modified:
  - apps/yelli/src/components/devices/DeviceList.tsx (added CALL button per row, self-filter, invite mutation, CallingModal mount, error surface)
  - apps/yelli/src/app/(app)/page.tsx (mount global IncomingCallModal)
- Files deleted: none
- Schema/migrations: none
- Errors encountered: TS2322 on device.userId/displayName (Prisma select inference types these as string | null despite non-null FK in schema)
- Errors resolved: null-coalescing fallbacks (`?? ""` / `?? "Unknown"`) at call sites; typecheck 0 errors
- TEST DEFERRAL (Rule 25 deviation): vitest+RTL are not yet configured in apps/yelli. No unit/component tests written for 3d-1 client. Phase 7 Feature 3e (RTL + vitest-component infra) is the chronological successor and will retroactively add tests for Phase 7 Features 1+2 + 3d-1.
- DEFERRED to 3d-2/3/4: actual WebRTC peer connection, signaling transport (Valkey pub/sub WS), mute/cam/end controls, video elements, connection-state badge.

## 2026-06-03 — Phase 7 Feature 3d-1 (server half): add calls.pending query
- Agent: CLAUDE_CODE
- Why: Callee side of PRODUCT.md core flow A needs a way to learn "is there a fresh incoming call for me?". 3d-1's IncomingCallModal hook polls this query every 3s. Phase 7 sub-feature 3d-2 will replace polling with a Valkey pub/sub WS subscription per the schema's TODO comments.
- Files added: none
- Files modified:
  - apps/yelli/src/server/trpc/routers/call.ts (+1 procedure `pending` ~55L; also corrected `user` → `owner` relation name and `name` → `displayName` field name per actual Prisma schema)
- Files deleted: none
- Schema/migrations: none — uses existing CallSession schema with a time-window + endedAt≈startedAt placeholder filter as the "ringing" state proxy.
- Errors encountered: Two TS errors — Device relation is `owner` (not `user`), User field is `displayName` (not `name`); nested select on callerDevice requires `include` not `select` at top level for Prisma type inference.
- Errors resolved: Fixed relation name, field name, and promoted callerDevice to `include` clause.
- TEST DEFERRAL (Rule 25 deviation): vitest is not yet configured in apps/yelli. No unit test written for `pending`. Phase 7 Feature 3e (RTL + vitest-component infra) is the chronological successor and will retroactively add server-side + client-side tests covering 3d-1.

## 2026-06-02 — Phase 7 Feature 3c: cleanup batch (icon-192 stub + healthcheck IPv4 fix + stray PNG cleanup)
- Agent: CLAUDE_CODE
- Why: Kill console noise + fix Docker container health status. (a) apps/yelli/public/icons/ did not exist, causing 2× 404 in console on every page load — added 192×192 brand-navy stub PNG to satisfy PWA manifest. (b) Docker healthcheck reported "unhealthy" despite GET /api/health returning 200 — root cause: alpine container's `localhost` resolves to ::1 (IPv6) but Next.js standalone listens only on 0.0.0.0:3000 (IPv4). Fixed by switching wget URL to 127.0.0.1 in all 3 env compose files. (c) Removed 2 stray screenshot PNGs (yelli-3b-directory-{pre,post}.png) that accidentally landed in repo root during Phase 7 Feature 3b first smoke + added /yelli-*.png pattern to .gitignore to prevent recurrence.
- Files added:
  - apps/yelli/public/icons/icon-192.png (192×192 brand-navy stub)
- Files modified:
  - deploy/compose/dev/docker-compose.app.yml (healthcheck URL localhost → 127.0.0.1)
  - deploy/compose/stage/docker-compose.app.yml (same)
  - deploy/compose/prod/docker-compose.app.yml (same)
  - .gitignore (added /yelli-*.png pattern)
- Files deleted:
  - yelli-3b-directory-pre.png (stray, repo root)
  - yelli-3b-directory-post.png (stray, repo root)
- Schema/migrations: none
- Errors encountered: Docker healthcheck FailingStreak=7 throughout Phase 6 + 7 dev runs, masking real-vs-cosmetic container health
- Errors resolved: localhost → 127.0.0.1 in healthcheck URL fixes IPv6/IPv4 resolution mismatch in alpine

## 2026-06-02 — Bug fix: tRPC client missing superjson transformer (latent Phase 4 bug)
- Agent: CLAUDE_CODE
- Why: Server tRPC config has `transformer: superjson` (apps/yelli/src/server/trpc/trpc.ts:52) but both client-side httpBatchLink calls omitted it. Caused all client-side tRPC calls to fail with HTTP 400 "Unable to transform response from server". Latent since Phase 4 Part 5 — only surfaced by Phase 7 Feature 3b Playwright smoke because login uses next-auth (not tRPC) and Feature 2's `trpc.device.list.useQuery` is the first client-side tRPC call ever exercised. Features 1+2 code itself is correct; this is purely a Phase 4 wiring oversight.
- Files added: none
- Files modified:
  - packages/api-client/package.json (added superjson ^2.2.1)
  - packages/api-client/src/index.ts (import superjson + transformer in httpBatchLink)
  - apps/yelli/src/lib/trpc-client.ts (import superjson + transformer in httpBatchLink)
  - pnpm-lock.yaml (regenerated)
- Files deleted: none
- Schema/migrations: none
- Errors encountered: All client-side tRPC procedures returned HTTP 400 with "Unable to transform response from server"
- Errors resolved: Added matching superjson transformer to both client httpBatchLink calls

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

## 2026-06-08 — Phase 3.3 Wave 4: Flows B (Receive) + C (Admin-Assigns-Role) walkable
- Agent:               CLAUDE_CODE (Opus 4.7 Architect + Sonnet 4.6 Executor, V32.6.1 R1/R6/R7)
- Why:                 Wire the second and third Core User Flows in the Phase 3.3 prototype: Flow B (Receive — incoming-call overlay + accept/reject) and Flow C (Admin-Assigns-Role — device call-role assignment surface). Parallel R7 dispatch since flows are independent. Reconcile audit-action vocabulary to PRODUCT.md §11 — Wave 3B emitted speculative `call.placed`/`call.ended` not present in the §11 enum; calls live in CallSession entity via `endReason`, not AuditLog.
- Files added:
  - prototype/src/components/OverlayIncomingCall.tsx (59L — modal: caller initials avatar + ✕ red Reject + 📞 green Accept; inline modal shell; in-app vs native push explanatory copy)
  - prototype/src/components/OverlayCallRoleAssign.tsx (88L — Both/Caller only/Receiver only radio + live `device.role.assign` audit preview + Save disabled when unchanged)
  - prototype/src/screens/ScreenAdminMembers.tsx (187L — narrowed to Flow C call-role-assign scope; member promote/demote/suspend/remove deferred to later waves; responsive mobile-cards + desktop-table; filter pills + search visual-only; refreshKey state forces re-render after sim.devices.setRole)
- Files modified:
  - prototype/src/screens/ScreenApp.tsx (overlay slot at line 214 wired; demo trigger synthesizes incoming session via callSessions.create(peer, me); accept → go('call'); reject → callSessions.end(id, 'declined'); explicit call.placed audit emit dropped)
  - prototype/src/screens/ScreenActiveCall.tsx (call.ended audit emit + auditLog import dropped)
  - prototype/src/lib/sim/repo.ts (internal call.start/call.end emits dropped from callSessions.create + callSessions.end; §11 reference comment added — calls live in CallSession entity, not AuditLog)
  - prototype/src/app/page.tsx (Screen union widened to 'admin-members'; ScreenAdminMembers render branch; activeCallId prop wired to ScreenApp)
  - prototype/src/components/BottomNav.tsx (Members tab key rerouted from 'members' → 'admin-members')
- Files deleted:       none
- Schema/migrations:   none (Phase 3.3 — sim layer only)
- Errors encountered:  none in either parallel Sonnet dispatch — both reported DONE first attempt; combined `cd prototype && npx tsc --noEmit` exits 0 with no errors.
- Errors resolved:     n/a
- Dispatch ledger:     2 Sonnet Scouts (R6) + 2 Sonnet Executors (R7 parallel) + 3 Opus governance writes (R8 allow-list) + 1 Sonnet drift-review write (lessons.md, R9). Wave 4A: 1 created + 4 modified, 219s, 26 tool uses, ~150L net. Wave 4B: 2 created + 2 modified, 192s, 18 tool uses, ~280L net. Each ≤500L per V32 R2.
- Audit reconciliation: grep over `prototype/src/screens/*.tsx` + `prototype/src/lib/sim/repo.ts` for `call.placed|call.ended|call.start|call.end` returns ZERO matches. PRODUCT.md §11 contract restored — sim AuditLog now strictly matches §11 enum vocabulary. Canonical Flow C action `device.role.assign` with payload `{from, to}` emitted on every role assignment.
- Sim semantics gap (deferred):  `sim.devices.setRole` already audits internally with `{deviceId, role}` payload but lacks the `from` field PRODUCT.md §11 mandates. Wave 4B layered a second fully-specified entry rather than refactor repo.ts mid-wave. Phase 4 backend swap will collapse both into the real assignment endpoint with a single §11-conformant audit row.
- dispatch_ratio:      3 sonnet_writes / 3 opus_writes = 1.0 (WARN — boundary). Same governance-doc-batching pattern as Wave 3 (1.33 WARN). Sonnet handled 100% of executor work — code, scouts, drift review. The R9 lessons.md drift entry was itself dispatched to Sonnet because lessons.md is not on the R8 allow-list. See `.cline/memory/lessons.md` for the typed `⚖️ trade-off` entry on per-wave governance-batching ratio inflation.
- LOC delta:           ~430L net new across 8 files in prototype/.

## 2026-06-09 — Phase 3.3 Wave 5 (Flow D Register Device — first-join naming walkable; V32 R1 deviation due to dispatch-layer regression)
- Agent:               CLAUDE_CODE (Opus 4.7 executor fallback — R1 DEVIATION; Sonnet executor dispatches all rejected "Prompt is too long")
- Why:                 Wire the fourth Core User Flow in the Phase 3.3 prototype: Flow D (Register Device — first-join naming) per the MOCKUP.jsx §1132-1147 OverlayNamePicker baseline. Discovery via two parallel Sonnet Scouts (R6/R7); execution dispatched to Sonnet four times at progressively smaller prompt sizes (1.5K → 600 tokens) and all REJECTED with "Prompt is too long" — V32.1 baseline-overhead failure (subagent inherits ~30-50K tokens of CLAUDE.md + skills + MCPs before any task prompt evaluation; this session's four sticky reminder banners likely inflated baseline). Bounded scope (3 files, ~112L net) made Opus inline fallback safe; documented in commit body + lessons.md drift entry. Recommend resolving dispatch-layer regression before Wave 6.
- Files added:
  - prototype/src/components/OverlayNamePicker.tsx (64L — inline modal shell matching OverlayIncomingCall pattern; controlled input with React state; live `{trimmed}/24` counter; canSave requires non-empty + changed; canCancel false when initialName empty → mandatory first-join; props `{ initialName; onSave; onClose? }`)
- Files modified:
  - prototype/src/screens/ScreenApp.tsx (+53/-5 = 48L net — useEffect/useState + OverlayNamePicker + auditLog imports; refreshKey state; auto-trigger useEffect when myDevice.displayName empty; saveMyName handler emits device.first_join audit ONLY on first set then setDisplayName then setRefreshKey then setOverlay(null); namePicker render block uses exactOptionalPropertyTypes-safe conditional — with-onClose branch passes onClose, without-onClose branch omits the prop entirely)
  - TODO (+1/-0 — Wave 5 marked done, Wave 6 queued)
- Files deleted:       none
- Schema/migrations:   none (Phase 3.3 — sim layer only)
- Errors encountered:  (1) 4× "Prompt is too long" rejections on Sonnet executor dispatches at minimal prompt sizes — V32.1 baseline-overhead regression. (2) Initial namePicker render block produced TS error `TS2375` under `exactOptionalPropertyTypes: true` because `onClose: (() => void) | undefined` is not assignable to `onClose?: () => void` — fixed by conditional render (with-onClose vs without-onClose branches).
- Errors resolved:     (1) Fell back to Opus inline execution for bounded ~112L change; documented R1 deviation in commit body + lessons.md (R9-mandated FAIL drift entry). (2) Replaced ternary-`undefined` pattern with two-branch conditional render at the call site.
- Dispatch ledger:     2 Sonnet Scouts (R6) SUCCEEDED via Agent(subagent_type:"Explore") — lighter context profile. 4 Sonnet Executor attempts via Agent(model:"sonnet") ALL REJECTED. 1 Opus inline executor fallback SUCCEEDED. 4 Opus governance writes (R8 allow-list, this entry being one of them). 1 Opus lessons.md drift entry write (R9 — lessons.md is NOT on R8 allow-list, so this is itself a second R1 deviation pending Wave 6 dispatch resolution).
- Audit reconciliation: §11 audit enum's `device.first_join` action is now emitted from the UI layer on first-set of `Device.displayName` (Path A — UI-explicit) with payload `{name}` (§11 declares no payload schema for `device.first_join`; `{name}` is the minimal-context choice per §11's "minimal context, no sensitive data" guideline). Sim layer's `devices.setDisplayName` ALWAYS emits `device.rename` regardless of first-set vs subsequent — Wave 5 accepted the trailing duplicate emit (mirrors Wave 4B `device.role.assign` double-emit pattern). Sim layer's `devices.create` already emits `device.create` (NOT §11-canonical `device.first_join`) on Device row insert — pre-existing gap untouched. Both sim gaps queued for Wave 6 R7 housekeeping bundle.
- dispatch_ratio:      0 sonnet_writes / 8 opus_writes = 0.0 (FAIL — <1.0). NOT Opus drift; dispatch-layer rejection cascade. Documented in lessons.md as a typed 🔴 gotcha so the R9 metric retains signal for genuine future drift events.
- LOC delta:           ~112L net new across 3 files in prototype/.
- Commit:              989f893

## 2026-06-09 — Wave 11: Flow I (Tenant Export) walkable — §3 Core User Flows complete (9/9)
- Agent: CLAUDE_CODE
- Why: close §3 Core User Flows for Phase 3.3 gate-closure prep
- Files added: prototype/src/screens/ScreenAdminExport.tsx (~165L)
- Files modified: prototype/src/lib/sim/types.ts (ExportJob + TABLES.tenantExports), prototype/src/lib/sim/repo.ts (tenantExports API: request/list/byId/markDownloaded + internal _markProcessing/_markReady; ~95L append), prototype/src/lib/sim/index.ts (barrel), prototype/src/app/page.tsx (admin-export route behind adminSession gate), prototype/src/components/TenantTopBar.tsx (Export nav entry)
- Sim behavior: BullMQ stub state machine queued → processing → ready → expired; 1.5s processing delay (window.setTimeout); 24h signed URL stub (https://exports.yelli.app/sim/<id>.json?expires=<iso>&sig=stub-<short>); payloadBytes computed from JSON.stringify of full tenant snapshot (users + devices + invitations + callSessions + auditLog.recent(10000)); expiry checked lazily on read (no scheduled job needed in sim); markDownloaded refuses on non-ready/expired
- Audit vocabulary: tenant.export.requested, tenant.export.ready, tenant.export.downloaded (all logged with exportId; ready includes payloadBytes + expiresAt)
- Dispatch: Opus-inline R1 deviation continued (seventh wave); V32.1 environment-structural regression unchanged
- Verification: cd prototype && npx tsc --noEmit → exit 0
- Next: Phase 3.3 gate-closure (docs/PROTOTYPE.md + /design-review green + client sign-off → Phase 3.5)

## 2026-06-09 — Phase 3.3 gate-closure prep: docs/PROTOTYPE.md drafted
- Agent: CLAUDE_CODE
- Why: Phase 3.3 gate-closure mandates a durable behavioural blueprint before Phase 3.5
- Files added: docs/PROTOTYPE.md (313L)
- Content: simulation technique (localStorage + in-tab pub/sub), simulated data model (8 tables), §11-canonical audit vocabulary inventory, Flows A–I walkthroughs (all 9 §3 Core User Flows) with states + audit emits per flow, simulated→production swap-boundary table mapping every sim API to its Phase 4 tRPC/Prisma/BullMQ/Valkey binding, out-of-scope list (real WebRTC/SMTP/Web Push/Argon2id/cron/cloud-onboarding all explicitly deferred to Phase 4), verification protocol, gate-closure outstanding items
- Locked contracts for Phase 4: @/lib/sim barrel is the sole UI data import surface; audit-action vocabulary verbatim; status machines (device/invitation/export job) verbatim; UI MUST NOT import from repo.ts/storage.ts/clock.ts directly
- Next: /design-review against PA MOCKUP.jsx + finalized tokens; client sign-off → DECISIONS_LOG.md → close Phase 3.3 → Phase 3.5

## 2026-06-11 — Phase 3.5 Execution Plan generated (brownfield-aware, 9 sessions ≤80K each)
- Agent:               CLAUDE_CODE (Opus 4.7 architect + Sonnet executor for file write)
- Why:                 Phase 3.3 closed (commit `2a5b1dc`). V32.6 mandates Phase 3.5 produce `.cline/tasks/execution-plan.md` before Phase 4 begins. Plan reconciles brownfield reality (Phase 4 Parts 1–8 already BUILT in May 2026 V31 adoption) with V32.6 intent (prototype→production wiring is the actual Phase 4 work).
- Files added:         .cline/tasks/execution-plan.md (136L) — 9-session schedule, dependency graph, per-session pre-flight, skill activation schedule, Output Equivalence Guarantee, human hand-off contract.
- Files modified:      docs/STATE.md (Phase 3.5 checkpoint + dispatch_ratio), docs/CHANGELOG_AI.md (this entry).
- Complexity profile:  8 domain entities + 3 Auth.js-managed; 8 modules; 9 §3 flows; 6 BullMQ queues; hybrid LAN+Cloud tenancy; WebRTC + WebSocket signaling + Valkey pub/sub; PWA-only (no native mobile). Bucket: MEDIUM (SMALL entity count, but cross-cutting realtime + dual-edition deployment elevate effective complexity).
- Session schedule:    4.1 Foundation finalization (shadcn init verify + securityVersion wiring); 4.2 Swap A Devices+Auth (fixes Flow E re-render deferral); 4.3 Swap B Calling subsystem (largest, ⚠ AT RISK); 4.4 Swap C Tenancy+Members+Invitations; 4.5 Swap D Audit+Branding; 4.6 BullMQ workers (6 queues); 4.7 PWA + Web Push + offline; 4.8 Design system finalization (3 of 4 Phase 3.3 deferrals); 4.9 Pre-production validation.
- V32 rule compliance:
  R1 (Zero Opus Execution):    PASS — execution-plan.md (not on R8 allow-list) dispatched to Sonnet; STATE.md + CHANGELOG_AI.md are R8 allow-list writes.
  R2 (File-Size Dispatch):     PASS — Sonnet task was single mechanical write (136L target, no analysis).
  R6 (Scout-Before-Plan):      PASS — 3 parallel Scouts dispatched for PRODUCT.md + DECISIONS_LOG.md + IMPLEMENTATION_MAP.md. PRODUCT.md Scout REJECTED ("Prompt is too long" — documented V32.1 baseline-overhead regression); recovered via `ctx_execute_file` sandbox extraction (raw bytes never entered Opus context). DECISIONS_LOG + IMPLEMENTATION_MAP Scouts succeeded.
  R7 (Default Parallel Fan-Out): PASS — 3 Scouts in one Opus response.
  R8 (Opus Write Allow-List):  PASS — only STATE.md + CHANGELOG_AI.md written directly by Opus.
  R9 (Dispatch Ratio Metric):  sonnet_writes=1 / opus_writes=2 = 0.5 (WARN). Phase 3.5 is intrinsically a single-Sonnet-write phase (one plan file); the metric will rebalance starting at session 4.1.
- Errors encountered:  PRODUCT.md Scout rejected by V32.1 baseline-overhead regression (env-structural; falsified-as-session-accumulated 2026-06-09 per memory 10788).
- Errors resolved:     Pivoted to `mcp__plugin_context-mode_context-mode__ctx_execute_file` for PRODUCT.md structural extraction; bytes stayed in sandbox.
- Hand-off:            Human reviews `.cline/tasks/execution-plan.md`. Next session: fresh Claude Code → "Start Part 4.1".
- Commit:              `552d8ad` chore(phase-3.5): execution plan generated — 9 sessions, brownfield-aware

## 2026-06-12 — Clean-Slate Re-baseline + inputs.yml regen (swarm S0, Bootstrap)
- Agent:               CLAUDE_CODE (swarm worker, headless `claude -p`)
- Why:                 The Phase 3.5 execution plan (commit `552d8ad`) and the prior docs/STATE.md both
                       asserted a FALSE premise — "Phase 4 Parts 1–8 already BUILT; only prototype→production
                       wiring remains (brownfield)." That premise is invalid: the V32.6.1 clean-slate wipe
                       (2026-06-07, commit `0a94f48`) removed `apps/` and `packages/` from the filesystem.
                       IMPLEMENTATION_MAP.md is authoritative — "Filesystem: clean-slate. No apps/, packages/."
                       Session 4.1 (run-1-4.1) correctly halted (status=blocked, q-4.1-01) on this contradiction.
                       S0 re-baselines the governance state to reality so Phase 4 proceeds as a scaffold-then-wire
                       rebuild (swarm plan S0→S5 scaffold, W1–W8 wire) rather than wiring a non-existent scaffold.
- Plan correction:     The brownfield assumption is retired. The old `.cline/tasks/execution-plan.md` (136L) is
                       SUPERSEDED (retained for reference). Authoritative Phase 4 plan = swarm S0→S5→W1–W8.
- Files modified:      inputs.yml (regenerated from docs/PRODUCT.md), docs/STATE.md (rewritten to real state),
                       docs/CHANGELOG_AI.md (this entry).
- Files added:         none.
- Files deleted:       none.
- inputs.yml changes (faithful to docs/PRODUCT.md Data Entities + Modules + DECISIONS_LOG locked decisions):
    • entities — removed fabricated `BrandAsset / CallSnapshot / SessionInvalidation` (absent from PRODUCT.md);
      now the 8 PRODUCT.md domain models: Tenant, User, Device, Invitation, AuditLog, CallSession,
      WebPushSubscription, ExportJob. (Auth.js v5 owns Session/VerificationToken/Account separately.)
    • modules — 6 → 8 faithful: calling, directory, device-identity, accounts-auth, tenancy-members,
      branding, admin-console, pwa.
    • jobs.queues — 2 → 6: device-archive, tenant-export, soft-delete-cron, backup, email, logo-image
      (grounded in DECISIONS_LOG "LOCKED: Jobs + Queues" Step 5 + "LOCKED: Database Backup" Step 7).
    • tenancy.notes — clarified hybrid LAN + Cloud one-codebase model (Cloud multi-tenant via subdomain;
      LAN single implicit tenant).
    • security.audit_events — aligned to PRODUCT.md AuditLog action prefixes
      (member.* / device.* / tenant.* / auth.* / superadmin.* / lan.* / pwa.*).
    • All schema-required sections preserved; no schema change needed (PWA captured in modules; no new
      top-level keys, so inputs.schema.json `additionalProperties:false` stays satisfied).
- Validation:          inputs.yml parses as YAML and is VALID against inputs.schema.json (jsonschema check in
                       sandbox — PASS). `pnpm lint|build|test` and `pnpm tools:validate-inputs` are n/a this
                       session: no package.json / pnpm-workspace.yaml / node_modules / tools/ exist yet
                       (pre-scaffold re-baseline; those land in scaffold sessions S1–S5).
- Phase 0 skeleton:    Verified intact — governance docs present; .gitignore comprehensive; MCP wiring
                       (.mcp.json + .vscode/mcp.json: socraticode + context7 + shadcn) present and correct.
                       No repair required.
- Errors encountered:  none.
- Errors resolved:     Plan/state drift (false brownfield premise) corrected — the root cause of the 4.1 block.
- Execution note (Rule 15 / V32.1): This swarm worker runs headless as a single executor agent and writes
                       files inline (sub-agent dispatch is not used in this harness). This is the standing
                       V32.1 Opus-inline fallback pattern (env-structural), not a discretionary R1 bypass.
- Hand-off:            Next swarm session S1 — scaffold Parts 1–2 (root config + packages/shared). Human
                       reviews this branch (`swarm/rebuild`) and pushes; the worker never pushes.
- Commit:              feat(phase-4-S0): Re-baseline + inputs.yml regen (Bootstrap)

## 2026-06-12 — Phase 4 swarm S1: Scaffold Parts 1–2 (root config + packages/shared)
- Agent:               CLAUDE_CODE (swarm worker, headless)
- Why:                 First scaffold session of the clean-slate Scaffold-then-Wire rebuild. Establishes the
                       pnpm/turbo monorepo root and the `@yelli/shared` package — the type + validation contract
                       every downstream session (S2 Prisma, S4 tRPC, W1–W4 wiring) consumes.
- Files added (root):  package.json (pnpm@10.33.2 workspace root, turbo-delegating scripts), pnpm-workspace.yaml
                       (apps/* + packages/* globs; pnpm `catalog:` pins — phantom-ui 0.10.1 EXACT, zod, typescript),
                       turbo.json (turbo 2.x `tasks`: build/lint/typecheck/test), tsconfig.base.json (strict +
                       noUncheckedIndexedAccess + exactOptionalPropertyTypes, Rule 12), eslint.config.mjs
                       (ESLint 9 flat config; @typescript-eslint/no-explicit-any: error), .prettierrc,
                       .prettierignore, .editorconfig, .nvmrc (22).
- Files added (shared): packages/shared/{package.json,tsconfig.json,eslint.config.mjs} +
                       src/{index.ts,enums.ts,audit.ts,entities.ts,validators.ts,config/reserved-slugs.ts}.
                         • enums.ts — Edition, CallRole, UserRole, CallEndReason, ExportJobStatus, AuditTargetType
                           (readonly tuple + union, verbatim from PRODUCT.md Data Entities).
                         • audit.ts — AUDIT_ACTIONS (§11-canonical, 29 actions) + AuditAction type + isAuditAction().
                           SOURCE OF TRUTH = docs/PROTOTYPE.md §3 (signed-off Phase 3.3 lock), NOT the illustrative
                           `etc.`-terminated PRODUCT.md line-204 enum. HARD CONSTRAINT for W4 + W1/W2/W3.
                         • entities.ts — 8 domain interfaces (Tenant, User, Device, Invitation, AuditLog,
                           CallSession, WebPushSubscription, ExportJob); Date timestamps (Prisma runtime shape).
                         • config/reserved-slugs.ts — RESERVED_SLUGS (18, verbatim) + isReservedSlug().
                         • validators.ts — Zod: tenantSlugSchema (3–30, `^[a-z][a-z0-9-]*[a-z0-9]$`, no `--`,
                           reserved-check, generic "slug unavailable" per V25), display-name caps (tenant ≤40,
                           user ≤24, device ≤24), email, browserFingerprint, idempotencyKey (uuid), enum schemas.
- Files deleted:       none.
- Schema/migrations:   none (Prisma schema is S2).
- Validation:          pnpm install ✓ (lockfile generated, 112 pkgs); pnpm typecheck ✓ (tsc --noEmit, 0 errors);
                       pnpm lint ✓ (eslint, 0 problems); pnpm build → no-op (shared is source-exported, no build
                       step) exit 0; pnpm test → no tasks (no tests in S1 scope) exit 0; prettier --check ✓ on all
                       created code files. 465 lines total — within the 500-line dispatch budget.
- Errors encountered:  1 — self-caught import typo (entities.ts imported AuditTargetType from ./audit.js; it lives
                       in ./enums.js). Caught by the first `pnpm typecheck` (TS2305) and fixed inline. Trivial
                       self-correction; no lessons.md entry warranted.
- Errors resolved:     the above import fix.
- Audit-vocabulary note: PRODUCT.md line-204 AuditLog enum and PROTOTYPE.md §3 diverge (member.* vs user.*;
                       tenant.brand.update vs tenant.branding.update; etc.). Resolved in favour of PROTOTYPE.md §3
                       — the explicitly-labelled "§11-canonical" signed-off contract that "must be preserved
                       verbatim" in Phase 4. S2/W4 inherit AUDIT_ACTIONS as the single source.
- Execution note (Rule 15 / V32.1): swarm worker ran headless as a single executor and wrote files inline
                       (sub-agent dispatch not used in this harness — standing V32.1 env-structural fallback).
- Hand-off:            Next swarm session S2 — packages/db Prisma schema (the contract; AT_RISK). Human reviews
                       branch `swarm/rebuild` and pushes; the worker never pushes.
- Commit:              feat(phase-4-S1): Scaffold Parts 1-2 — root config + packages/shared

## 2026-06-12 — Phase 4 Swarm Session S2 — Scaffold Part 3: packages/db (Prisma schema + L2/L5/L6 + migration 0001)
- Agent:               CLAUDE_CODE (swarm worker, headless `claude -p`)
- Why:                 Establish the Prisma data contract for the clean-slate rebuild — the schema every wire
                       session (W1–W4) swaps the prototype sim layer onto. Reproduces the LOCKED Phase-4-Part-3
                       decisions (Output Equivalence) from the wiped scaffold (git `96920d0`), adapting imports to
                       S1's `@yelli/shared` barrel and applying the explicit S2 scope additions.
- Files added (db):    packages/db/{package.json,tsconfig.json,eslint.config.mjs} +
                       prisma/schema.prisma + prisma/migrations/0001_init/{migration.sql,down.sql} +
                       prisma/migrations/migration_lock.toml +
                       src/{index.ts,audit.ts,rls.ts,middleware/tenant-guard.ts}.
                         • schema.prisma — 8 domain models (Tenant, User, Device, Invitation, AuditLog, CallSession,
                           WebPushSubscription, ExportJob) + 3 Auth.js-managed (Account, Session, VerificationToken)
                           + 5 Prisma enums (Role, CallRole, AuditTargetType, EndReason, ExportJobStatus). Field
                           names/shapes align 1:1 with @yelli/shared entities.ts. tenantId NOT NULL on tenant-scoped
                           models (+ @@index); nullable on AuditLog + WebPushSubscription. cuid() string PKs.
                         • migration.sql (0001_init) — full DDL + L2 RLS: ENABLE ROW LEVEL SECURITY + tenant_isolation
                           policies (USING tenant_id = current_setting('app.current_tenant_id', true)) on users,
                           devices, invitations, call_sessions, export_jobs; permissive (… OR tenant_id IS NULL) on the
                           two nullable-tenant tables (audit_logs, web_push_subscriptions). down.sql reverses
                           (policies → RLS disable → tables → enums).
                         • src/audit.ts — L5 writeAuditLog() helper (immutable AuditLog write; action as String per
                           the §11-canonical-in-@yelli/shared design; tenantId+targetId nullable).
                         • src/rls.ts — L2 setTenantContext() + withTenant() (SET LOCAL app.current_tenant_id in a tx).
                         • src/middleware/tenant-guard.ts — L6 tenantGuardExtension() via Prisma.defineExtension +
                           `query.$allModels.$allOperations` (LOCKED). Excludes Tenant/AuditLog/Account/Session/
                           VerificationToken. Super-Admin uses the base unguarded client (no inline if/else).
                         • src/index.ts — base PrismaClient singleton (dev-HMR-safe) + barrel re-exports.
                         • ExportJob model + ExportJobStatus enum + export_jobs table/index/FKs/RLS ADDED to reach the
                           "8 domain models" scope and align 1:1 with @yelli/shared entities.ts ExportJob (status,
                           signedUrl, expiresAt 24h, downloadedAt, payloadBytes; FK tenant + nullable requestedBy).
                           Output-Equivalence divergence: the wiped scaffold (`96920d0`) never materialized an
                           ExportJob table (its tenant.export was BullMQ/queue-tracked; migrations were 0001_init +
                           0002_user_security_version only). S2 materializes it because (a) the explicit S2 scope says
                           "8 domain models", (b) entities.ts (S1 contract) defines it as a persistent entity, (c)
                           AuditTargetType references "ExportJob" (audit rows need a stable target id). Self-contained
                           + tenant-scoped (L6-guarded automatically; strict RLS). REVIEW NOTE for the human/Brain:
                           if export-job state is intended to live only in BullMQ/Valkey (not Postgres), drop this
                           table in S3 (packages/jobs) — it is additive and isolated.
- Files modified:      packages/shared/src/entities.ts — 2 alignment edits restoring the LOCKED schema↔TS contract:
                         (1) User.securityVersion: number added (LOCKED: User.securityVersion + security.md §AUTH #6);
                         (2) AuditLog.targetId widened to `string | null` (LOCKED: AuditLog.targetId nullability —
                             "nullable in both the schema and the Part-2 TS interface").
                       pnpm-lock.yaml — +prisma/@prisma/client 5.22.0 (+@types/node) resolved.
- Schema/migrations:   prisma/migrations/0001_init (init). `prisma validate` ✓; `prisma generate` ✓ (client v5.22.0).
- Deviations from the wiped scaffold (`96920d0`), all rule-backed (Output Equivalence preserved):
                         • +User.securityVersion (the old Part-3 deferred it to Part-5; S2 scope folds it into Part-3).
                         • CallSession.endedAt + endReason → nullable, matching S1 entities.ts (`Date|null`,
                           `CallEndReason|null`) per the LOCKED rule "Part-2 TS is the source of truth; on a Part-3+
                           mismatch fix the schema, not the type." (Also semantically correct: a ringing/active call
                           has no endedAt/endReason yet.)
                         • Prisma pinned ^5.22.0 (registry now serves 7.x; v7 would break the proven generator output).
                         • Comment header source-of-truth path updated types/* → entities.ts (S1's consolidated barrel).
- Scope deferrals (NOT in S2's literal scope — left for a later session):
                         • prisma/seed.ts (webmaster admin) — needs CREDENTIALS.md + a live DB; argon2 is a native build.
                           Deferred to the session that wires seeding (keeps S2 install surface minimal + DB-free).
                         • @yelli/shared NOT added as a db dependency — no S2 src file imports it (the db layer uses
                           Prisma's own generated AuditTargetType enum). Add when a consumer (W4 seed/audit) needs it.
- Validation:          pnpm typecheck ✓ (2/2 packages, 0 errors); pnpm lint ✓ (2/2, 0 problems); pnpm build → no-op
                       exit 0 (db + shared source-exported); pnpm test → no tasks exit 0; prettier --check ✓ on all
                       S2 code files. (Repo-wide `format:check` fails on 44 PRE-EXISTING files — docs/, inputs.yml,
                       README.md — untouched by S2; not an S2 regression.)
- Prerequisite note:   `pnpm install` gates Prisma's build scripts (pnpm onlyBuiltDependencies). `prisma generate`
                       (`pnpm --filter @yelli/db db:generate`) MUST run before typechecking @yelli/db on a fresh
                       clone — the generated client lives in node_modules (gitignored). Standard Prisma practice;
                       CI wiring (S5) should run db:generate before the typecheck step.
- Errors encountered:  1 (non-blocking) — first `pnpm lint` warned: unused `eslint-disable no-var` directive in
                       index.ts (root flat config does not enable `no-var`). Removed the directive (plain `var` is
                       required for the `declare global` augmentation and is not flagged). 0 problems after.
- Errors resolved:     the above.
- Execution note (Rule 15 / V32.1): swarm worker ran headless as a single executor and wrote files inline
                       (sub-agent dispatch not used in this harness — standing V32.1 env-structural fallback).
- Hand-off:            Next swarm session S3 — packages/ui + packages/jobs. Human reviews branch `swarm/rebuild`
                       and pushes; the worker never pushes.
- Commit:              feat(phase-4-S2): Scaffold Part 3 — packages/db (Prisma schema + migration)

## 2026-06-12 — Phase 4 Swarm Session S3 — Scaffold Part 4: packages/ui + packages/jobs
- Agent:               CLAUDE_CODE (swarm worker, headless `claude -p`)
- Why:                 Scaffold the shared UI utility layer (@yelli/ui) + the BullMQ job DEFINITIONS layer
                       (@yelli/jobs) for the clean-slate rebuild. Reproduces the LOCKED Phase-4-Part-4 decisions
                       (Output Equivalence) — ioredis pin, worker payload-guard convention, branding MIME context —
                       and the Phase 3.3 signed-off design tokens. Consumes @yelli/shared (S1) + @yelli/db (S2)
                       conceptually; the running app + workers are wired in S4 + the BullMQ-wiring session.
- Files added (ui):    packages/ui/{package.json,tsconfig.json,eslint.config.mjs} +
                       src/{index.ts,lib/cn.ts,tailwind-preset.ts}.
                         • src/lib/cn.ts — canonical shadcn `cn()` (clsx + tailwind-merge). No shadcn primitives yet
                           (those land with the app via `npx shadcn@latest init` in S4 — per scope).
                         • src/tailwind-preset.ts — `yelliTailwindPreset` (`satisfies Partial<Config>`). REPRODUCES the
                           Phase 3.3 signed-off design system verbatim from prototype/tailwind.config.ts (the
                           human-validated baseline / docs/DESIGN.md): the full brand+semantic color map onto
                           CSS vars (canvas/surface/text-*/brand-*/success/warning/error), borderRadius
                           (xs/sm/md/lg/xl/pill), boxShadow (hairline/card/raised/modal), transitionDuration +
                           transitionTimingFunction. No `content` (consuming app owns its globs). Token VALUES live
                           in the app globals.css (S4) as CSS custom properties; the preset only maps utility names.
                           Output Equivalence: reproduced, not re-decided — keeps the design-review GREEN intact.
                         • Deps: clsx ^2.1.1 + tailwind-merge ^2.5.5 (runtime), tailwindcss ^3.4.10 (dev — Config type,
                           pinned to the prototype's proven Tailwind v3 line, not v4).
- Files added (jobs):  packages/jobs/{package.json,tsconfig.json,eslint.config.mjs} +
                       src/{index.ts,connection.ts,queues.ts} +
                       src/workers/{_validate.ts,device-archive.ts,tenant-export.ts,soft-delete-cron.ts,
                       backup.ts,email.ts,logo-image.ts}.
                         • src/queues.ts — the 6 queue DEFINITIONS (LOCKED: Jobs + Queues [Step 5] + Database Backup
                           [Step 7]): QUEUE_NAMES const (device-archive, tenant-export, soft-delete-cron, backup,
                           email, logo-image — verbatim from inputs.yml jobs.queues), per-queue typed payloads
                           (BaseJobData{tenantId,userId,idempotencyKey?} + the 6 specializations), a static JobDataMap,
                           and a `createQueue<N>(name, connection, options)` factory (connection INJECTED — no eager
                           Redis at import; definitions only, Workers/cron schedulers land in the wiring session).
                         • src/connection.ts — `createRedisConnection()` ioredis factory; defaults BullMQ's required
                           `maxRetriesPerRequest: null`; reads REDIS_URL (Valkey).
                         • src/workers/_validate.ts — the LOCKED worker payload-guard convention: `assertTenantUser`
                           (every worker calls it at the TOP of its processor, BEFORE any logic — security.md Queue
                           Safety rule 1+2), the stricter `assertSystemJob` (LOCKED backup exception: tenantId '_pwbt'
                           + userId 'system' — whole-DB job), and the shared structured-JSON `log()` helper
                           (operations.observability.format = structured-json — LOCKED).
                         • 6 worker STUBS — each imports the correct guard (assertTenantUser; backup → assertSystemJob)
                           + `log`, calls the guard first, logs receipt, then `throw new Error('… not yet implemented
                           (S3 stub)')` with a TODO(BullMQ wiring session) describing the LOCKED behavior (03:00 UTC
                           device-archive sweep; tenant-export JSON→S3/MinIO→signed-24h-URL email; 7-day soft-delete
                           hard-delete; 02:00 UTC pg_dump custom/compress=9→S3 30d/Glacier-IR-7d; invite/verify/reset
                           email; logo PNG/JPEG-only resize per the LOCKED branding MIME whitelist). No `new Worker()`
                           — keeps the package definitional (no eager Redis connection), implementation deferred.
                         • Deps: bullmq ^5.77.7 + ioredis 5.10.1 (EXACT — LOCKED: ioredis version pin).
- Files modified:      package.json (root) — ADDED `pnpm.overrides.ioredis = "5.10.1"` (LOCKED: ioredis version pin).
                       Verified single-instance dedup: `node_modules/.pnpm` resolves exactly one `ioredis@5.10.1`
                       (bullmq's bundled instance + @yelli/jobs's direct dep collapse to one — required under strict +
                       exactOptionalPropertyTypes so the Redis types are structurally identical).
                       pnpm-lock.yaml — +bullmq/ioredis/clsx/tailwind-merge/tailwindcss (and transitive) resolved.
- Schema/migrations:   none.
- ExportJob REVIEW NOTE resolution (carried from S2): KEPT the packages/db export_jobs table — NOT dropped.
                       Rationale: PRODUCT.md flow #15 needs a durable ExportJob row for (a) the "An export is already
                       in progress" 1/tenant/24h rate-limit query, (b) AuditLog tenant.export.request/complete/failed
                       correlation by a stable exportJobId, and (c) the signed-URL/expiry/downloadedAt lifecycle —
                       BullMQ job state is ephemeral (jobs are removed on completion) and cannot serve those queries.
                       TenantExportJobData therefore carries `exportJobId` referencing that row. The S2 table stands.
- Validation:          pnpm typecheck ✓ (4/4 packages, 0 errors); pnpm lint ✓ (4/4, 0 problems); pnpm build → no-op
                       exit 0 (all packages source-exported; no build task yet); pnpm test → no tasks exit 0; prettier
                       --check ✓ on all S3 files + root package.json. ioredis dedup verified = single 5.10.1.
                       (Repo-wide `format:check` still fails on the same 44 PRE-EXISTING files — docs/, inputs.yml,
                       README.md — untouched by S3; not an S3 regression.)
- Prerequisite note:   @yelli/db typecheck still requires `prisma generate` first on a fresh clone (re-run this session
                       after `pnpm install` altered node_modules — standard Prisma practice; S5 CI wires it).
- Errors encountered:  1 (self-caught, non-blocking) — initial typecheck failed in tailwind-preset.ts: a JSDoc comment
                       contained the literal `--duration-*/--ease-*`, whose `*/` prematurely CLOSED the comment block
                       (TS1109/TS1161 cascade). Reworded the comment to remove the `*/` sequence; typecheck green.
- Errors resolved:     the above.
- Execution note (Rule 15 / V32.1): swarm worker ran headless as a single executor and wrote files inline
                       (sub-agent dispatch not used in this harness — standing V32.1 env-structural fallback).
- Hand-off:            Next swarm session S4 — apps/yelli (Next.js + shadcn init + Auth.js v5 + tRPC skeleton; AT_RISK).
                       Human reviews branch `swarm/rebuild` and pushes; the worker never pushes.
- Commit:              feat(phase-4-S3): Scaffold Part 4 — packages/ui + packages/jobs

## 2026-06-12 — Phase 4 · Swarm Session S4a-1: Scaffold Part 5 (app foundation) — apps/yelli
- Agent:               CLAUDE_CODE (swarm worker, headless `claude -p`; Opus-inline per V32.1 fallback)
- Why:                 S4 (apps/yelli: Next.js 16 + shadcn + Auth.js v5 + tRPC skeleton) is the largest,
                       AT_RISK Phase-4 session. Filesystem-grounded re-scope (LOCKED token architecture +
                       17 shadcn primitives + Auth.js + 7 tRPC routers + 5 middleware + proxy.ts) is ~30+
                       files / >1000 lines — far over the ≤12-file / ≤500-line single-session budget. The
                       Brain-approved S4a/S4b split (q-S4-01) is directionally right, but even S4a ALONE
                       overflows once the token plumbing + tokens.ts mirror + Vitest parity test + 17 CLI
                       primitives are counted. Per pre-flight rule 3 / memory-governance §1 (AT_RISK + >500L
                       ⇒ do not force), this session ships ONLY the safe, within-budget app FOUNDATION
                       (S4a-1) and escalates the remainder (S4a-2 primitives, S4b auth+tRPC).
- Scope (S4a-1):       apps/yelli Next.js 16 (App Router) app shell + LOCKED Clay design-token plumbing,
                       reproduced VERBATIM from the Phase 3.3 signed-off prototype (Output Equivalence).
                       NO shadcn primitives, NO Auth.js, NO tRPC, NO env.ts/proxy.ts (those are S4a-2/S4b).
- Files added (12):    apps/yelli/{package.json, next.config.ts, tsconfig.json, eslint.config.mjs,
                       postcss.config.mjs, tailwind.config.ts, components.json}, src/styles/tokens.css,
                       src/app/{globals.css, layout.tsx, page.tsx}, src/lib/utils.ts.
- Files modified:      .gitignore (+next-env.d.ts), pnpm-lock.yaml (+next 16.2.9, react/react-dom 19,
                       tailwindcss 3.4.x, postcss, autoprefixer, @types/react|react-dom 19). docs/DECISIONS_LOG.md
                       carries the Brain's pre-existing q-S4-01/02 answer log (committed to preserve the trail).
- Design tokens:       tokens.css = the LOCKED single token source (DECISIONS_LOG "Design Tokens"), Clay
                       palette carried forward verbatim (canvas #fffaf0, navy primary #0a0a0a, 6 brand
                       accents, semantics, motion). globals.css maps shadcn --background/--foreground/
                       --primary/--border/--ring/etc FROM those Clay vars. tailwind.config consumes the
                       @yelli/ui yelliTailwindPreset (S3) + adds shadcn semantic color names. Output
                       Equivalence with the GREEN design-review baseline preserved.
- Stack locks honored: Next.js 16.2.9 + React 19; Tailwind v3 (^3.4.10, NOT v4); ESLint 9 flat — app lints
                       via direct `eslint` (Next 16 removed `next lint`, DL:209); apps/yelli tsconfig
                       exactOptionalPropertyTypes:false (DL:176 — Radix v1); transpilePackages:['@yelli/ui']
                       (source-exported); output:'standalone' (Docker). Font: CSS @import Inter kept verbatim
                       (next/font = deferred W7). Permissions-Policy ALLOWS self camera+microphone (Yelli is
                       a WebRTC calling app — blocking would break getUserMedia).
- Validation:          pnpm install ✓; `next build` ✓ (Next 16.2.9 Turbopack, TS pass, 3 static pages);
                       pnpm --filter @yelli/web typecheck ✓ (0 errors); lint ✓ (0 problems); prettier
                       --check ✓ on all authored app files. (Pre-existing repo-wide format drift on
                       docs/inputs.yml unchanged — not an S4 regression.)
- Deviations/notes:    (1) Package name @yelli/web (worker discretion; matches @yelli/* scope; dir apps/yelli
                       per inputs.yml app name "yelli"). (2) next-env.d.ts gitignored (auto-generated). (3)
                       PostToolUse hook flagged next.config `async headers()` as needing await — FALSE
                       POSITIVE: it confused the next.config response-header CONFIG fn (returns Promise<array>,
                       no await) with the next/headers REQUEST API (async-only in 16). Code correct per
                       context7 v16.1.6 docs.
- Remainder (BLOCKED): S4 NOT complete. Verified remainder needs TWO further within-budget sessions:
                       S4a-2 = 17 shadcn primitives (button…form per q-S4-02) + src/lib/tokens.ts mirror +
                       Vitest token-parity test (DL "Design Tokens"); S4b = Auth.js v5 Credentials/JWT
                       (User.securityVersion in session callback, no PrismaAdapter per DL:172) + tRPC v11
                       (7 routers incl. `calls` key + 5 middleware) + src/proxy.ts (V25, DL:179) + src/env.ts.
                       DECISION NEEDED (S4a-2): shadcn CLI is v4.11.0 (Tailwind-v4-first) but stack is LOCKED
                       Tailwind v3 — components.json is pre-staged in v3 mode (`tailwind.config` path) to
                       steer the CLI to v3; confirm `shadcn add` honors v3 OR pin a v3 CLI / hand-author.
- Execution note (Rule 15 / V32.1): headless single-executor, inline writes (standing env-structural fallback).
- Hand-off:            Dispatch S4a-2 (primitives) then S4b (auth+tRPC) as separate workers. Human reviews
                       branch `swarm/rebuild` and pushes; the worker never pushes.
- Commit:              feat(phase-4-S4a): Scaffold Part 5 (app foundation) — apps/yelli Next.js 16 shell + design tokens

## 2026-06-12 — Phase 4 · Swarm Session S4a-2: Scaffold Part 5 (shadcn primitives + token parity) — apps/yelli
- Agent:               CLAUDE_CODE (swarm worker, headless `claude -p`; Opus-inline per V32.1 fallback)
- Why:                 Second of the three within-budget S4 sub-sessions (S4a-1 done @ 1eb2ae4; S4b = auth+tRPC
                       still pending). Generates the 17 LOCKED shadcn primitives the production screens use, plus
                       a hand-maintained TS mirror of the Clay tokens and a Vitest drift guard — completing the
                       UI primitive + design-token surface so S4b can wire auth/tRPC against real components.
- Scope (S4a-2):       17 shadcn/ui primitives (q-S4-02) into apps/yelli/src/components/ui/ + src/lib/tokens.ts
                       (Clay mirror) + src/lib/tokens.parity.test.ts (Vitest) + vitest.config.ts. NO auth, NO
                       tRPC, NO proxy.ts/env.ts (S4b).
- Files added (21):    apps/yelli/src/components/ui/{button, card, input, label, dialog, badge, avatar,
                       separator, scroll-area, tabs, select, switch, sonner, skeleton, tooltip, dropdown-menu,
                       form}.tsx (17, CLI-generated via shadcn@2, then Prettier-normalized to repo style),
                       src/lib/tokens.ts (hand-maintained Clay mirror), src/lib/tokens.parity.test.ts,
                       vitest.config.ts.
- Files modified:      apps/yelli/package.json (+17 deps: 11 @radix-ui/* + @hookform/resolvers + react-hook-form
                       + sonner + next-themes + zod[catalog] from the CLI; +class-variance-authority ^0.7.1 and
                       lucide-react ^1.17.0 added manually — primitives import them but the S4a-1 manual init
                       had no primitives so they were never installed; +vitest devDep; +"test":"vitest run"
                       script). pnpm-lock.yaml. pnpm-workspace.yaml (catalog zod ^3.23.8 → ^3.25.76 — pnpm floor
                       raise forced by @hookform/resolvers@5 peer zod≥3.24; caret-range bump within zod 3.x, the
                       resolved version was already 3.25.76, @yelli/shared re-typechecked clean). docs/STATE.md,
                       docs/CHANGELOG_AI.md, docs/DECISIONS_LOG.md (Brain q-S4-03/q-S4-04 answer log).
- shadcn CLI decision: q-S4-04 [A] — used `npx shadcn@2 add …` (locked major) against the pre-staged v3-mode
                       components.json. shadcn@latest (4.x, Tailwind-v4-first) was REJECTED to protect the Phase
                       3.3 GREEN v3 token plumbing; hand-authoring REJECTED per ui-rules.md (shadcn is the only
                       permitted primitive source). POST-ADD DRIFT GATE PASSED: tailwind.config.ts + globals.css
                       byte-identical pre/post add; tailwindcss stayed ^3.4.10; no @tailwindcss/postcss or any v4
                       package introduced.
- Token parity:        src/lib/tokens.ts is a verbatim TS mirror of the LOCKED src/styles/tokens.css :root (25
                       Clay tokens, keyed by exact `--name`). tokens.parity.test.ts parses the CSS :root block
                       and asserts an exact sorted-key match against the TS object — any drift in either file
                       fails the test (DL "Design Tokens": one source of truth, drift-guarded). 2/2 tests pass.
- Validation:          pnpm install ✓ (incl. --frozen-lockfile catalog↔lock consistency ✓); root `pnpm test`
                       (turbo) ✓ — @yelli/web 2/2, siblings no-op; pnpm --filter @yelli/web typecheck ✓ (0);
                       lint ✓ (0); `next build` ✓ (Next 16.2.9 Turbopack, TS pass, 3 static pages); @yelli/shared
                       typecheck ✓ under bumped zod; prettier --check ✓ on all 17 primitives + 3 authored files
                       + package.json.
- Deviations/notes:    (1) class-variance-authority + lucide-react added manually (see Files modified) — required
                       direct deps the CLI omitted. (2) lucide-react ^1.17.0 is a post-cutoff major; its named
                       icon imports type-resolve clean. (3) 17 generated primitives Prettier-normalized to the
                       repo .prettierrc (singleQuote) — cosmetic, no behavior change; keeps format:check clean.
                       (4) catalog zod floor bump (see Files modified) — benign, required, Output Equivalence
                       preserved.
- Remainder (BLOCKED): S4 still NOT complete. S4b (Auth.js v5 Credentials/JWT + User.securityVersion session
                       callback, no PrismaAdapter per DL:172; tRPC v11 — 7 routers incl. `calls` key + 5
                       middleware; src/proxy.ts V25 per DL:179; src/env.ts) is the final S4 sub-session —
                       dispatch as a separate dependent worker. AT_RISK; split further if >500L.
- Execution note (Rule 15 / V32.1): headless single-executor, inline writes (standing env-structural fallback;
                       dispatch_ratio sonnet_writes=0 / opus_writes=N → FAIL by R9, standing acceptance per Wave 7).
- Hand-off:            Dispatch S4b (auth+tRPC). Human reviews branch `swarm/rebuild` and pushes; worker never pushes.
- Commit:              feat(phase-4-S4a2): Scaffold Part 5 (shadcn primitives + token parity) — apps/yelli

## 2026-06-12 — Phase 4 · Session S4b (Scaffold Part 5 remainder — Auth.js v5 + tRPC v11 skeleton)
- Agent:               CLAUDE_CODE (headless swarm worker, run-15-S4b)
- Why:                 Final S4 sub-session. S4a (foundation + 17 primitives) left the auth + tRPC backend
                       surface unbuilt; W1 (Wire A) halted on its absence (DL answer-log q-W1-02/03/04). This
                       session scaffolds that surface so W1-W8 can wire the validated prototype flows to it.
- Scope (SKELETONS):   Auth.js v5 Credentials+JWT (no PrismaAdapter, DL); tRPC v11 init + 7 router skeletons
                       (devices/users/calls/tenants/invitations/audit/brand) + 5 middleware (auth/tenant-scope/
                       audit/rate-limit/error); V25 proxy.ts; env.ts; LAN-admin hook; api route handlers.
                       Real procedure logic deferred to the W-series.
- Files added (24):
                       apps/yelli/src/server/trpc/: trpc.ts (initTRPC + superjson transformer), context.ts
                       (auth() → session), procedures.ts (public + protected = LOCKED 5-step chain), root.ts
                       (AppRouter; `calls` merge key per DL), middleware/{auth,tenant-scope,audit,rate-limit,
                       error}.ts, routers/{devices,users,call,tenants,invitations,audit,brand}.ts.
                       apps/yelli/src/server/auth/: config.ts (NextAuth Credentials+JWT; jwt callback DB-validates
                       User.securityVersion + isSuspended every call → returns null on mismatch, V28 guarantee;
                       session callback surfaces identity), lan-admin.ts (yelli_admin_session cookie hook).
                       apps/yelli/src/types/next-auth.d.ts (Session/User/JWT augmentation; role=Prisma Role).
                       apps/yelli/src/app/api/trpc/[trpc]/route.ts (fetch adapter), api/auth/[...nextauth]/route.ts.
                       apps/yelli/src/proxy.ts (Next 16 proxy()/proxyConfig, V25, edge-safe getToken — DL).
                       apps/yelli/src/env.ts (Zod env, SKIP_ENV_VALIDATION build guard).
                       apps/yelli/src/lib/trpc/react.ts (createTRPCReact<AppRouter> client hook handle).
- Files modified:      apps/yelli/package.json (+@trpc/{server,client,react-query}@^11, @tanstack/react-query
                       @^5.62, next-auth@5.0.0-beta.22, superjson@^2.2.1, @yelli/db + @yelli/shared workspace
                       deps); apps/yelli/next.config.ts (transpilePackages += @yelli/db, @yelli/shared);
                       pnpm-lock.yaml; docs/STATE.md; docs/CHANGELOG_AI.md (this entry). docs/DECISIONS_LOG.md
                       carries the pre-existing Brain answer-log appends from the blocked W1 sessions (committed
                       here for hygiene — stranded uncommitted by those status=blocked runs).
- Schema/migrations:   none (consumes the S2 schema; no Prisma changes).
- Decisions honored:   DL Auth.js-without-PrismaAdapter (Credentials+JWT); DL proxy.ts convention; DL `calls`
                       AppRouter key; DL tRPC 5-step middleware chain; DL Webmaster bcrypt / LAN argon2 split
                       (authorize + lan-admin TODOs reference the correct algorithms); inputs.yml rate-limiting
                       tiers documented in the rate-limit middleware. No NEW decision locked.
- Validation:          prisma generate ✓; typecheck ✓ (0 errors); lint ✓ (0 errors / 0 warnings); test ✓ (2/2,
                       token-parity); `next build` ✓ — proxy.ts recognized as `ƒ Proxy (Middleware)`, both api
                       routes `ƒ` dynamic, TypeScript pass, 3 static pages.
- Errors encountered/resolved: (1) env.ts shipped an unused eslint-disable directive → removed (lint warning
                       cleared). No other issues; no thrash.
- Deviations/notes:    (1) Peer warnings only (non-fatal): @trpc/* want TS ≥5.7.2 (catalog 5.5.4) — typecheck
                       + build pass regardless, so the catalog TS was NOT bumped (avoids a workspace-wide churn);
                       next-auth beta.22 lists next ^14/^15 (found 16) — accepted per the DL lock, build clean.
                       (2) Non-fatal Turbopack warning: `export *` from the CommonJS @prisma/client re-export in
                       packages/db/src/index.ts (S2) — surfaced now because the app first imports @yelli/db; build
                       succeeds. Left to a packages/db follow-up (out of S4b scope). (3) Routers carry one
                       `_placeholder` NOT_IMPLEMENTED procedure each to keep the protectedProcedure wiring used
                       (tsconfig noUnusedLocals); the W-series replaces them with real procedures.
- Execution note (Rule 15 / V32.1): headless single-executor, inline writes (standing env-structural fallback;
                       sub-agent dispatch unavailable in `claude -p`; dispatch_ratio metric N/A for the swarm
                       worker model — not a discretionary R1 bypass).
- Hand-off:            S4 COMPLETE (S4a-1 + S4a-2 + S4b). Backend surface on disk for W1-W8. Human reviews branch
                       `swarm/rebuild` and pushes; worker never pushes.
- Commit:              feat(phase-4-S4b): Scaffold Part 5b — Auth.js v5 + tRPC router skeletons (deferred S4 tail)
