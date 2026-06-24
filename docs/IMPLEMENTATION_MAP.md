# Implementation Map — Yelli

## Feature Update — V-3way: 3-way calling + desktop screen share (2026-06-24)

Branch `feat/three-way-call-screenshare` · PR #5 (stacked on #4) · dev-verified · HOLD (not merged/deployed).
Spec: `docs/superpowers/specs/2026-06-24-three-way-call-screenshare-design.md`. PRODUCT.md scope updated first (Rule 1).

- ✅ **Signal layer** — `packages/shared/src/realtime.ts`: new `present` kind + `presentSignalSchema`/`PresentSignal`
  (screen-share stream-id announce). Relay forwards via existing `canRelay` (no server logic added). +6 schema tests.
- ✅ **Data + API** — `CallSession.thirdDeviceId` (nullable) + migration `0004_add_third_device`; `calls.start`
  optional 2nd callee; new `calls.add` (`call_full` → TRPCError CONFLICT); `calls.byId` returns thirdDeviceId.
  Same role-guard + same-tenant (no new RBAC). +8 router tests.
- ✅ **Engine** — `apps/yelli/src/components/call/call-mesh.ts` (NEW, React-free): one RTCPeerConnection per
  (session,peer), lexicographic glare rule, present-signal screen/cam classification (race-safe), guarded
  `onnegotiationneeded`, per-peer + full teardown. `CallEngineProvider.tsx` = thin shell exposing full
  `CallEngineApi`. `useSignaling.sendPresent` added. +13 engine/signaling tests.
- ✅ **UI** — `ScreenActiveCall.tsx`: N-tile face grid + screen panels + Present(desktop-only) + Add-person
  (shadcn Dialog); `PeerDirectory.tsx`: multi-select up to 2 for group start. 375px-first responsive, WCAG 2.2
  AA, 0 raw hex, design-auditor ~96, react-best-practices clean.
- ✅ **CSP fix** — `next.config.ts` `connect-src 'self'` → `'self' ws: wss:` (dev signaling WS was a separate
  origin → blocked → no call connected; verified opening end-to-end after fix).
- **Verify:** typecheck 7/7 · 211/211 tests · migration applied · 9/9 dev containers healthy · all routes load ·
  signaling WS confirmed (CDP 101→hello→ready). Commits: 53c75b2 16c4ae0 a49d911 12bf773 a7a14ce ba82046.
- **Dispatch (Rule 15):** multi-agent fan-out — P1+P2 parallel, P3→P4→P5 sequential (R7).
- **Open:** human 2-browser 3-way + screen-share gate; merge #4 then #5; staging/prod owner-gated. Pre-existing
  (not this change): `/settings` 500 — `data_subject_requests` migration missing (drift from d639a5b).

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
- 🚧 Phase 3.3 — IN PROGRESS (Wave 9/N complete, 7 Core User Flows walkable + audit-emit vocabulary §11-canonical + LAN admin gate live + invite flow live + manage-devices live, 2026-06-09)
  - Wave 2A — Scaffold: Next.js 14 App Router under prototype/ (10 files, 315L). Dev port 4838. Tailwind theme wired to CSS-var tokens from DESIGN.md (colors, radius, shadow).
  - Wave 2B — Simulated data layer: prototype/src/lib/sim/ (6 files, 821L) — single swap boundary. 6 entity repos (devices/callSessions/users/tenants/invitations/auditLog) mirror inputs.schema.json shapes. localStorage persistence with cross-tab + same-tab pub/sub. Clock helper for 90d archive time-travel. ⚠ Dispatch overshot V32 R2 500L gate (repo.ts alone 448L) — accepted once for foundational wave; logged in lessons.md.
  - Wave 2 — Design EXPAND: docs/DESIGN.md +37L (motion + shadows + z-index) per V32.5 INHERIT-not-REPLACE contract. No existing tokens modified.
  - ✅ Wave 3 — Calling flow walkable (PRODUCT.md §3 Flow A) 2026-06-08: 11 files, ~570L net new. (3A) shared layout chrome ported VERBATIM from MOCKUP.jsx lines 21-280: T color constant + TENANT/ME placeholders + 5 components (Pill, CallRoleLabel, AppFooter, TenantTopBar "use client", BottomNav). (3B) Calling flow VERBATIM from MOCKUP.jsx lines 529-720: page.tsx screen router (useState<"app"|"call">) + ScreenApp (Directory + Demo-view-as role toggle + CALL placement wired to sim.callSessions.create + auditLog.append) + ScreenActiveCall (in-call view + END wired to sim.callSessions.end + auditLog.append). (3C) 2 typecheck fix dispatches (~10L combined): import default-vs-named alignment + nullable guard + strictFunctionTypes contravariance. Final `cd prototype && npx tsc --noEmit` exits 0. Sim methods exercised: seedDefaults / tenants.list / devices.list / devices.setRole / devices.byId / callSessions.create / callSessions.byId / callSessions.end / auditLog.append. Stubbed for Wave 4: 4 overlays (incomingCall/namePicker/pwa/offline) render null; mute/camera/speaker/swap controls no-op; 02:14 timer hardcoded. Each Sonnet dispatch ≤500L per V32 R2 (improvement vs Wave 2B).
  - 1 decision locked in DECISIONS_LOG.md: simulation technique (in-memory + localStorage + 6-namespace barrel; Phase 4 swaps exactly those 6 namespaces for real tRPC calls).
  - Dispatch ratio Wave 3: 4 sonnet_writes / 3 opus_writes = 1.33 (WARN — within tolerance; three governance docs in one checkpoint inflate opus side this wave).
  - Walkable now: directory renders seeded devices → tap CALL on a row OR tap big CALL hero → routes to ScreenActiveCall → tap red phone → routes back. "Demo: view as caller/receiver/both" toggles CALL button visibility per role-hide rule.
  - ✅ Wave 4 — Flows B (Receive) + C (Admin-Assigns-Role) walkable (PRODUCT.md §3 Flow B + Flow C) 2026-06-08: 3 created + 5 modified, ~430L net new. Two PARALLEL Sonnet executor dispatches per V32 R7 from two parallel Scouts (R6). (4A — Flow B Receive, ~150L net) CREATED `prototype/src/components/OverlayIncomingCall.tsx` (59L, default export) ported VERBATIM from MOCKUP.jsx §1112-1130 with inline modal shell (no ModalShell dep), ✕ red Reject + 📞 green Accept, caller initials avatar, in-app vs native-push explanatory copy. MODIFIED `ScreenApp.tsx`: overlay slot at line 214 wired (looks up active session via `sim.callSessions.byId` → caller device via `sim.devices.byId` → passes props); demo trigger now synthesizes a real incoming session via `callSessions.create(peer, me)`; accept → `setOverlay(null) + go('call')`; reject → `callSessions.end(id, 'declined') + clear`. MODIFIED `ScreenActiveCall.tsx` + `page.tsx` to wire activeCallId prop. AUDIT RECONCILIATION: DROPPED explicit `call.placed`/`call.ended` audit emits in screens AND internal `call.start`/`call.end` emits in `sim/repo.ts` — PRODUCT.md §11 enum does NOT contain any `call.*` actions; calls live in CallSession entity via `endReason`. Grep verification: zero matches for `call.placed|call.ended|call.start|call.end` across screens + sim repo. (4B — Flow C Admin-Assigns-Role, ~280L net) CREATED `ScreenAdminMembers.tsx` (187L, named export) narrowed to Flow C call-role-assign scope (member promote/demote/suspend/remove deferred); responsive mobile-cards + desktop-table; filter pills + search input visual-only; refreshKey state forces re-render after `sim.devices.setRole`. CREATED `OverlayCallRoleAssign.tsx` (88L, default export) — 3 radio-style buttons Both/Caller only/Receiver only with live `device.role.assign` audit-preview block (per §11 canonical action with `{from, to}` payload); Save disabled when unchanged. MODIFIED `page.tsx` Screen union to include 'admin-members' + render branch; `BottomNav.tsx` Members tab key rerouted from 'members' → 'admin-members'. Combined `cd prototype && npx tsc --noEmit` exits 0. Each Sonnet dispatch ≤500L per V32 R2.
  - Dispatch ratio Wave 4: 3 sonnet_writes (4A + 4B + R9 lessons.md drift entry) / 3 opus_writes (STATE.md + CHANGELOG_AI.md + IMPLEMENTATION_MAP.md) = 1.0 (WARN boundary; not FAIL). Code work was 100% Sonnet; ratio inflated by three governance docs landing per checkpoint. lessons.md drift review entry added per R9.
  - Walkable now: Flow A (Calling, Wave 3) + Flow B (Receive — incoming-call overlay reachable via aside Demo button, accept → ScreenActiveCall, reject → ends session with `declined` reason) + Flow C (Admin-Assigns-Role — BottomNav Members tab → per-row Change role → overlay radio → Save persists via `devices.setRole` and emits §11-conformant `device.role.assign` audit; returning to Directory in ScreenApp reflects new role via CALL-button hide/show per Step 3 defense-in-depth enforcement).
  - Sim semantics gap (deferred to Phase 4 backend swap): `sim.devices.setRole` already audits with `{deviceId, role}` but lacks `from` field §11 mandates; Wave 4B layered a second fully-specified entry rather than refactor mid-wave. RESOLVED in Wave 6 housekeeping.
  - ✅ Wave 5 — Flow D Register Device walkable (PRODUCT.md §3 Flow D, embedded in §3 Calling Model + Device entity defs since no formal "Flow D" heading exists) 2026-06-08: 1 created + 2 modified (+1 TODO), ~112L net new. CREATED `OverlayNamePicker.tsx` (64L) inline modal shell matching `OverlayIncomingCall.tsx` pattern (no ModalShell dep) — controlled `<input>` with live `{trimmed}/24 characters` counter, Cancel blocked when initial name empty (mandatory first-join), props `{initialName; onSave; onClose?}`. MODIFIED `ScreenApp.tsx` (+53/-5 = 48L net): `useEffect` auto-trigger when `myDevice.displayName.trim() === ''` AND no overlay open; `saveMyName` handler with UI-side `device.first_join` audit emit on first-set (layered atop sim's trailing `device.rename` — Wave 4B-style double-emit, RESOLVED in Wave 6); conditional render branches on displayName presence to satisfy `exactOptionalPropertyTypes: true`. `cd prototype && npx tsc --noEmit` exits 0. ⚠ DISPATCH-LAYER REGRESSION discovered mid-wave: 4 Sonnet executor dispatches REJECTED "Prompt is too long" at prompt sizes 600–1500 tokens; Sonnet Scouts via `Agent(subagent_type:"Explore")` continued to work. Wave 5 executor fell back to Opus inline (R1 deviation documented).
  - ✅ Wave 6 — Housekeeping: sim audit emits §11-canonical (PRODUCT.md §11 audit-action conformance) 2026-06-09: 2 modified, ~40L gross / -3L net. `sim.devices.setDisplayName` (+19/-12) now captures prior row before mutation, branches on `prior.displayName.trim() === ''` to emit `device.first_join {deviceId, name}` (first set) vs `device.rename {deviceId, from, to}` (subsequent). `sim.devices.setRole` emits `device.role.assign {deviceId, from, to}` (was non-canonical `{deviceId, role}`). `ScreenApp.saveMyName` collapsed from 19L → 5L by removing UI-side conditional `device.first_join` emit (sim is now sole emission point); dropped unused `auditLog` import. Collapses Wave 4B `device.role.assign` payload gap + Wave 5 `device.first_join` double-emit pair into single §11-canonical emits. `cd prototype && npx tsc --noEmit` exits 0 first try (mechanical refactor preserved all signatures). Commit `b64b251`. ⚠ DISPATCH-LAYER REGRESSION PERSISTED: 2 attempts both REJECTED (code-simplifier subagent_type at ~1500-token prompt; general-purpose at ~30-token scratch-file pointer prompt). 6 total session dispatch failures across two subagent_types confirms V32.1 baseline-overhead diagnosis; per V32 R4 fallback to Opus inline was correct, documented in commit + CHANGELOG. Remaining gap: `sim.devices.create` still emits non-canonical `device.create` (vs §11's `device.first_join` on Device row creation) — preserved this wave to keep scope bounded; Phase 4 backend collapses Device-row-insert + first-rename into single `device.first_join` audit.
  - Dispatch ratio Wave 5: 0 sonnet_writes / ~8 opus_writes = 0 (FAIL — dispatch-layer-blocked, not Opus drift; R9 lessons.md entry written).
  - Dispatch ratio Wave 6: 0 sonnet_writes / ~6 opus_writes = 0 (FAIL — same root cause as Wave 5; no new R9 lessons.md entry, redundant).
  - Walkable now: Flow A (Calling) + Flow B (Receive) + Flow C (Admin-Assigns-Role with §11-canonical `device.role.assign {from,to}` audit) + Flow D (Register Device — auto-opening name picker on first-join with §11-canonical `device.first_join {name}` audit, subsequent renames emit §11-canonical `device.rename {from,to}` audit). 4 of 9 §3 Core User Flows walkable.
  - ✅ Wave 7 — Flow E LAN-anonymous-admin Login walkable (PRODUCT.md §3 Flow 18) 2026-06-09: 5 modified + 1 created, ~145L gross / ~55L net. types.ts (+6L) new `AdminSession` type + `TABLES.adminSession`. repo.ts (+48L append-only) new `adminSession` module — `current()`/`login(tenantId, passphrase)`/`logout()` with §11-canonical `lan.admin.login.success`/`lan.admin.login.fail` audit emits; SIM stub passphrase `'yelli-admin'` (plaintext) with inline marker comment pointing Phase 4 swap at Argon2id + `Tenant.adminPassphraseHash` + HttpOnly `yelli_admin_session` cookie per Step 6 lock. index.ts barrel exports adminSession. seed.ts LAN-anon branch calls `tenants.setAdminPassphrase(tenant.id, 'yelli-admin')` so first-run-wizard signature is present from boot. ScreenAdminLogin.tsx NEW (79L) controlled passphrase form with PRODUCT.md §3-verbatim generic error "Couldn't sign in" on fail. page.tsx (+10L) gates `'admin-members'` behind `adminSession.current()` — single-source routing gate, no per-screen check spread. `cd prototype && npx tsc --noEmit` exits 0 first try. Commit `ee4c90c`. ⚠ DISPATCH-LAYER REGRESSION — FRESH-SESSION HYPOTHESIS FALSIFIED: Wave 7 opened in fresh Claude Code session per Wave 6 STATE.md recommendation. Two dispatch attempts: (1) general-purpose @ ~3K tokens REJECTED "Prompt is too long"; (2) general-purpose @ literal 1-word `pwd` ALSO REJECTED. 1-word rejection proves regression is environment-structural Sonnet baseline inheritance, NOT session-accumulated overhead. Cumulative: 8 dispatches, 3 subagent_types, 0 successes across Waves 5+6+7. Per V32 R4 fallback to Opus inline (THIRD consecutive wave R1-deviation). No new lessons.md entry — same root cause + same mitigation as Wave 5's already-logged entry.
  - ✅ Wave 9 — Flow G Manage Devices walkable (PRODUCT.md §3 Flow G) 2026-06-09: 2 modified, ~75L gross / ~75L net. MODIFIED `prototype/src/lib/sim/repo.ts` (+17L) — new `devices.archiveOne(id, adminUserId?)` single-device manual archive; emits §11-canonical singular `device.archive` audit row distinct from batch `device.archive.batch` (admin-initiated archives now traceable). MODIFIED `prototype/src/screens/ScreenAdminMembers.tsx` (187L → ~245L, ~+58L net) — clickable All/Online/Archived filter pills (single-source `filter` state); per-row action set splits by archive state (active: Change role / Rename / Archive; archived: Unarchive / Remove); empty-state card; mobile card reflow. Rename via `window.prompt`, Archive/Remove via `window.confirm` — prototype-tier UX consistent with Wave 5 name-picker pattern. `cd prototype && npx tsc --noEmit` exits 0 first try. Existing sim methods reused: `setDisplayName` (emits `device.rename`), `unarchive` (emits `device.unarchive`), `remove` (emits `device.delete`). ⚠ Standing Opus-inline R1 deviation — fifth consecutive wave; no Sonnet dispatch attempted per Wave 7 falsification (environment-structural).
  - ✅ Wave 8 — Flow F Invite walkable (PRODUCT.md §3 Flow F — cloud + LAN-account-mode admin invites a member by email) 2026-06-09: 2 created + 2 modified, ~313L gross / ~313L net (no deletions). CREATED `prototype/src/screens/ScreenAdminInvitations.tsx` (~150L) admin-gated screen — pending/accepted/expired list, email-input create form (7-day TTL handled by `sim.invitations.create` Wave-2B baseline), "Open link" deep-routes to ScreenJoinByInvite via `go('join-invite:<id>')` protocol, "Revoke" calls `sim.invitations.expire`. On-demand `ensureAdminUser(tenantId)` synthesizes a stub admin User when seed is LAN-anonymous so `invitations.create(tenantId, email, invitedByUserId)` has a valid actor without changing the global seed mode (preserves Wave 7 admin-login walkability). CREATED `prototype/src/screens/ScreenJoinByInvite.tsx` (~120L) 3-phase state machine (`review` → `accepted` | `invalid`) — validates tenant scope, expiry, and already-accepted in one initial-state useMemo; on accept provisions the member User via `sim.users.create` if missing, then calls `sim.invitations.accept` (sim repo emits §11-canonical `invitation.accept` audit row). MODIFIED `prototype/src/app/page.tsx` (+33L): Screen union extends to `'admin-invitations'`+`'join-invite'`; new `joinInviteId` state; `go()` parses the `'join-invite:<id>'` protocol and pre-fills state; `'admin-invitations'` admin-gated via `adminSession.current()` mirroring Wave 7's single-source routing gate. MODIFIED `prototype/src/components/TenantTopBar.tsx` (-1L net): nav items swap stub `'members'`/`'orgSettings'` for real routes `'admin-members'`+new `'admin-invitations'`. Sim audit emits unchanged — `invitation.create` / `invitation.accept` already present in Wave 2B baseline. `cd prototype && npx tsc --noEmit` exits 0 first try. Commit `ac1a003`. ⚠ DISPATCH-LAYER REGRESSION — accepted Opus-inline R1 deviation per STATE.md NEXT-field standing recommendation "do NOT try fresh-session reset again" (falsified Wave 7). FOURTH consecutive wave R1 deviation. No new lessons.md entry — same root cause + same mitigation.
- ⏳ Waves 9–11 — Remaining 3 §3 Core User Flows (G Manage Devices full + H Audit View + I Tenant Export): PENDING (one per wave, strict R2)
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

**packages/jobs — BullMQ queue infrastructure (scaffold snapshot; worker bodies since filled — see UPDATE below)**

> **UPDATE (post-scaffold, W5a–W5e + soft-delete-cron landed):** every worker body is now a real
> implementation — files are `{tenant-export,device-archive,soft-delete-cron,backup,email,logo-image}.ts`
> (the `.worker.ts` names and "stubs / TODO Phase 5 marker" notes below are the as-scaffolded snapshot,
> superseded). Two paths fail fast by design rather than fabricating behaviour: `backup` throws when
> `BACKUP_S3` is unconfigured (owner-deferred per DECISIONS_LOG), and `email` throws for the `verify`/`reset`
> kinds that have no producer yet (Phase-7 magic-link / email-link providers — DECISIONS_LOG line 204).
> The `invitation` email path and all other workers run for real. Registry: `src/runtime/processors.ts`.

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

## Phase 3.3 — Interactive Prototype & Simulation (V32.6.1 canary)
- ✅ Wave 2 (2026-06-08): scaffold + simulated backend layer (commit `a6ee171`)
- ✅ Wave 3 (2026-06-08): Flow A Calling walkable (commit `d48418f`)
- ✅ Wave 4 (2026-06-08): Flow B Receive + Flow C Admin-Assigns-Role walkable + audit vocabulary reconciled to §11 (commit `f17e7ab`)
- ✅ Wave 5 (2026-06-09): Flow D Register-Device walkable — `OverlayNamePicker.tsx` (64L) + `ScreenApp.tsx` wiring (auto-trigger when displayName empty + `device.first_join` UI emit on first-set + double-emit accepted, flagged for housekeeping) (commit `989f893`)
- ✅ Wave 6 (2026-06-09): Housekeeping — sim audit emits §11-canonical. `sim.devices.setDisplayName` routes first-set→`device.first_join {name}` vs subsequent→`device.rename {from,to}`; `sim.devices.setRole` emits `device.role.assign {from,to}` (was `{deviceId, role}`); `ScreenApp.saveMyName` drops UI-duplicate emit (sim is sole emission point). Collapses Wave 4B + Wave 5 double-emit pairs. -3L net across 2 files; TypeScript 0 errors. Dispatch-layer regression persisted: 2 attempts both rejected → Opus inline R1 deviation (commit `b64b251`).
- ✅ Wave 7 (2026-06-09): Flow E LAN-Admin-Login walkable — `prototype/src/lib/sim/types.ts` +AdminSession + TABLES.adminSession; `prototype/src/lib/sim/repo.ts` +48L adminSession module (current/login/logout) with §11-canonical `lan.admin.login.success`/`lan.admin.login.fail` audits + SIM stub passphrase; `prototype/src/lib/sim/seed.ts` LAN-anon calls setAdminPassphrase; new `prototype/src/screens/ScreenAdminLogin.tsx` (79L) passphrase form with generic "Couldn't sign in" error; `prototype/src/app/page.tsx` gates 'admin-members' behind adminSession.current(). TypeScript 0 errors. Commit `ee4c90c`. Dispatch-layer regression FRESH-SESSION HYPOTHESIS FALSIFIED — 1-word prompt rejection proves environment-structural Sonnet baseline overhead; third consecutive R1 deviation.
- ✅ Wave 8 (2026-06-09): Flow F Invite walkable — new `prototype/src/screens/ScreenAdminInvitations.tsx` (admin-gated list/create/revoke; on-demand admin-User synth for LAN-anon seed); new `prototype/src/screens/ScreenJoinByInvite.tsx` (3-phase review/accepted/invalid; provisions member User on accept); `prototype/src/app/page.tsx` extends Screen union + `go('join-invite:<id>')` deep-link protocol + admin gate for invitations; `prototype/src/components/TenantTopBar.tsx` nav swaps stubs for `'admin-members'`+`'admin-invitations'`. Sim audit emits `invitation.create`/`invitation.accept` unchanged (Wave 2B baseline). TypeScript 0 errors first try. Commit `ac1a003`. Dispatch-layer regression — accepted Opus-inline R1 deviation per STATE.md standing recommendation (Wave 7 falsification result); fourth consecutive R1 deviation, no new lessons.md entry.
- ✅ Wave 9 (2026-06-09): Flow G Manage Devices walkable — `prototype/src/lib/sim/repo.ts` +17L (new `devices.archiveOne(id, adminUserId?)` emitting §11-canonical singular `device.archive` audit, sibling to existing batch `device.archive.batch`); `prototype/src/screens/ScreenAdminMembers.tsx` (187L → ~245L, +58L net) — clickable All/Online/Archived filter pills (single-source filter state); per-row actions split by archive state (active: Change role/Rename/Archive; archived: Unarchive/Remove); empty-state card; mobile card reflow. Existing `setDisplayName`/`unarchive`/`remove` sim methods reused (all already §11-canonical from Waves 5–6). TypeScript 0 errors first try. Commit pending. Dispatch-layer regression — accepted Opus-inline R1 deviation; fifth consecutive R1 deviation; no new lessons.md entry.
- 7 of 9 §3 Core User Flows now walkable: A Calling + B Receive + C Admin-Assigns-Role + D Register-Device + E LAN-Admin-Login + F Invite + G Manage-Devices
- Pending flows: G Manage Devices (full) · H Audit View · I Tenant Export
- Gate-closure blockers: 5 remaining flows + `docs/PROTOTYPE.md` + `/design-review` green + client sign-off in `docs/DECISIONS_LOG.md`
