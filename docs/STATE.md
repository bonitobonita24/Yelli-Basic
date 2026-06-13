# Project State — Yelli
# Auto-generated. Never edit manually.

## Current State — Clean-Slate Scaffold-then-Wire (swarm/rebuild · B2 W5c email worker body DONE → W5b/W5d/W5e queue bodies / ScreenTenantSettings NEXT, 2026-06-13)

> **B2 DONE (this session, 2026-06-13).** W5c — the email-worker BODY (nodemailer/SMTP), Flow F.
> The S3 throwing stub in `packages/jobs/src/workers/email.ts` is now a real send path; the live W3
> producer (`enqueueInvitationEmail`) finally delivers mail instead of failing into the DLQ. 1 file
> rewritten + 1 package.json (2 deps), all green.
> • **SMTP transport from provisioned env (W5c brief).** Lazy `nodemailer` transporter singleton:
>   `SMTP_HOST` / `SMTP_PORT` / `SMTP_FROM` ALWAYS; auth `{user,pass}` applied ONLY when both
>   `SMTP_USER` and `SMTP_PASS` are present (schema key `SMTP_PASS`, with legacy `SMTP_PASSWORD`
>   fallback) — dev runs against MailHog (localhost:46843, no auth, plaintext); staging/prod carry real
>   creds. `secure:true` only on port 465 (implicit TLS), STARTTLS/plaintext otherwise. Reads
>   `process.env` directly (jobs has no env.ts — same posture as `connection.ts`).
> • **Invitation template + LOCKED accept link (Flow F).** Builds
>   `${APP_URL ?? NEXTAUTH_URL}/invite?token=…` — the token-gated accept route LOCKED in PRODUCT.md's
>   route table (`/invite?token=...`). Renders both a plaintext part and an inline-styled HTML part
>   (transactional email needs literal hex inline — ui-rules Rule 3 governs app components, not email
>   bodies; brand teal `#1a3a3a` matches chrome). Token is `encodeURIComponent`'d, never persisted,
>   never logged.
> • **kind gate (S3-stub posture).** Only `kind:'invitation'` is implemented (the sole producer).
>   `verify`/`reset` (no producer yet) throw → fail fast into the failed set (DLQ), surfacing the gap
>   rather than fabricating their copy — Brain q-80-S2-01 posture, consistent with the other unfilled
>   workers.
> • **Audit policy (W5c brief, device-archive precedent).** Structured-JSON completion + failure logs
>   ONLY (via the shared `_validate.log` helper) — NO AuditLog row, NO AUDIT_ACTIONS vocab change. The
>   `invitation.create` domain audit row is already written at enqueue time by the invitations router;
>   the worker is delivery infrastructure. Logs carry counts + `messageId` only — NEVER token/recipient
>   PII. On any send failure: emit the error log (message only) then rethrow → BullMQ `attempts:3` +
>   exponential backoff → DLQ. `info.accepted.length === 0` is treated as failure (retry/DLQ).
> • **Deps:** `nodemailer ^6.9.16` (dep) + `@types/nodemailer ^6.4.17` (devDep) — MIT/OSS (Rule 14).
>   No credential added; transport wired from already-provisioned env. `queues.ts` / `_validate.ts` /
>   `processors.ts` / `worker-host.ts` UNTOUCHED (the worker was already registered against the stub in
>   S2 — only its body changed).
> Validation all green: `pnpm install` ✓ (+nodemailer +types, 4 packages), jobs typecheck 0 / lint 0 /
> prettier ✓, turbo typecheck+lint 14/14, test 21/21 (web 11 + signaling 10), `next build` ✓ (route
> table unchanged — the worker runs in the @yelli/jobs host process, not a web route).
> **Dispatch note (Rule 15): authored Opus-inline — standing V32.1 env-structural swarm fallback
> (headless `claude -p`, sub-agent dispatch unreliable per lessons.md). The worker body [transport +
> invitation template + send] is a single cohesive file = one indivisible unit, no fan-out boundary ⇒
> no parallel fan-out warranted regardless; R1 deviation accepted per the standing pattern.**
> **NEXT: W5b (tenant-export body — S3/MinIO bundle + signed-URL email) · W5d (logo-image resize) ·
> W5e (backup pg_dump) queue bodies → deferred ScreenTenantSettings (Phase-3.3 prototype +
> `tenants.update`) → re-dispatch S6 as the real W8 end-to-end validation.**

## Prior State — Clean-Slate Scaffold-then-Wire (swarm/rebuild · B1 device-home call-engine DONE → W5b-e queue bodies / ScreenTenantSettings NEXT, 2026-06-13)

> **B1 DONE (this session, 2026-06-13).** Device-home call-engine — Flow A real WebRTC wiring on the
> production backend. 3 NEW files (CallEngineProvider + PeerDirectory + `/api/auth/ws-token`
> route) + 5 EDITS + 1 DELETE (SessionKillListener folded), all green, **zero new deps**.
> • **Single useSignaling instance app-wide (q-B1 contract).** `<CallEngineProvider>` mounts ONE
>   `useSignaling` for the entire (app) tree and owns: the WS lifecycle (sendOffer/Answer/ICE/Hangup),
>   the RTCPeerConnection lifecycle per CallSession (offer→answer→ICE drain, getUserMedia capture +
>   `pc.ontrack` → `<video data-remote-stream-target>` attach), the §20 `?incoming=` deep-link
>   consumer (URL param → `trpc.calls.byId` → `OverlayIncomingCall` → connect/sendAnswer on Accept,
>   end+sendHangup on Reject), and the Step 6 session-kill PUSH path that previously lived in
>   `SessionKillListener` (deleted). `peerOfSessionRef` + `pendingIceRef` + `pendingOffersRef` handle
>   the offer-arrives-before-Accept and ICE-arrives-before-remoteDescription races verbatim.
> • **`useCallEngine().placeCall(peerDeviceId)` API.** PeerDirectory tiles call this; the orchestrator
>   runs `trpc.calls.start` (server-side role guard returns the session already-ended with
>   `endReason: 'forbidden-by-role'` for blocked attempts — the engine surfaces ScreenActiveCall's
>   terminal state for those), then creates the PC, captures media, sendOffer. `busy` exposes mid-call
>   state to the tiles (CALL disabled while a call is in flight).
> • **`PeerDirectory`** (`src/components/call/PeerDirectory.tsx`, NEW): `trpc.devices.list`-driven
>   tile grid with the LOCKED Step 3 "hide-CALL" rule client-side (peer.callRole ∈ `receiver`/`both`
>   AND self.callRole ∈ `caller`/`both`) — the second half (server-reject) is `calls.start`'s
>   forbidden-by-role. Online presence dot from `lastSeenAt < 5 min` (PRODUCT.md presence rule);
>   offline tiles disabled. Skeleton-shaped pending-state via lightweight `animate-pulse` `<Card>`
>   placeholders (ui-rules Rule 11 PATH A — shadcn-composed surface, no phantom-ui needed).
> • **`/api/auth/ws-token`** (`src/app/api/auth/ws-token/route.ts`, NEW): server-side route reads the
>   Auth.js HttpOnly session JWE cookie (the same JWE the signaling server decodes via
>   `@auth/core/jwt` with shared `AUTH_SECRET`) and returns it to `useSignaling.getToken`. Gates on
>   `auth()` (401 for unauthenticated incl. LAN-anonymous admins — they aren't WS push targets). Tries
>   both `__Secure-authjs.session-token` (TLS) and the bare dev name. This unblocks the WS handshake
>   the q-W2b-04 follow-up deferred (no fresh signing, no parallel auth system — same token, surfaced
>   for the WS `hello` frame).
> • **§20 URL contract reconciliation.** S5/W6b SW bridge + `public/sw.js` pushed to `/app?incoming=…`
>   but no `/app` route exists in this app (the `(app)` group resolves to `/`, not `/app` — pre-S5 bug
>   surfaced only when the deep link was first walked end-to-end). Both updated to `/?incoming=…`. The
>   LOCKED §20 BRIDGE PROTOCOL (`{type:'incoming-call', callSessionId}` postMessage) is unchanged —
>   only the incidental URL slug changes; semantic preserved (B1 brief: "consumes the LOCKED §20
>   deep link").
> • **Mounts.** `(app)/layout.tsx` now wraps `{children}` in `<CallEngineProvider>`; AppShell drops
>   its `<SessionKillListener />` mount (the listener is deleted — its `onSessionKill` handler folded
>   into CallEngineProvider's `useSignaling` callbacks to satisfy the single-instance rule).
> • **Audit policy (B1 brief).** Structured pino-shaped JSON `console.{info,warn,error}` logs only —
>   no AuditLog rows, no AUDIT_ACTIONS vocab change. The CallSession lifecycle is already the
>   server-side audit record (W2a `calls.start/connect/end` rows).
> • **Loading states (ui-rules Rule 11).** Overlays are short-lived imperative dialogs;
>   ScreenActiveCall owns its own terminal states; PeerDirectory uses shadcn Card pulse placeholders
>   for the brief tRPC pending — neither phantom-ui nor `<Skeleton>` upgrade warranted (matches W6b
>   classification posture).
> Validation all green: prettier ✓, web typecheck 0 errors, web lint 0/0, web test 11/11 (unchanged,
> existing PWA suites — no new tests added for the call engine; the RTCPeerConnection lifecycle is an
> integration-only surface that needs a headed browser + getUserMedia mock — flagged for W8/S6
> end-to-end validation), turbo typecheck+lint 14/14, `next build` ✓ (route table now includes
> `/api/auth/ws-token`; only the pre-existing non-fatal @prisma/client `export *` Turbopack warning).
> **Dispatch note (Rule 15): authored Opus-inline — standing V32.1 env-structural swarm fallback
> (headless `claude -p`, sub-agent dispatch unreliable per lessons.md). The CallEngineProvider +
> PeerDirectory + ws-token route share the single-`useSignaling`-instance contract + the §20 deep-link
> contract + the RTCPeerConnection lifecycle = one cohesive call-engine unit, no independent fan-out
> boundary ⇒ no parallel fan-out warranted regardless; R1 deviation accepted per the standing pattern.**
> **NEXT: W5b-e BullMQ queue bodies (tenant-export / email / logo-image / backup) → deferred
> ScreenTenantSettings (Phase-3.3 prototype + new `trpc.tenants.update` mutation) → re-dispatch S6 as
> the real W8 end-to-end validation.**

## Prior State — Clean-Slate Scaffold-then-Wire (swarm/rebuild · S5 W6b PWA UX DONE → device-home call-engine / W5b-e / deferred ScreenTenantSettings NEXT, 2026-06-13)

> **S5 DONE (this session, 2026-06-13).** W6b — the PWA client UX the W6a split deferred
> (q-W6-01 [A]): install banner + cached-shell offline/Reconnecting banner + SW→client incoming-call
> tap-through bridge + the UUIDv7/IndexedDB offline mutation replay queue. 8 NEW files (4 lib + 2 test +
> 5 components, minus overlap) + 3 edits, all green, **zero new deps**.
> • **SCOPE (Brain-resolved, no escalation):** the S5 scope sheet's `coturn` service + `release.yml` +
>   Windows PowerShell scripts are out-of-scope template carryover per q-run9-S5-02 [A] / q-run9-S5-03
>   [A] — S5 ships ONLY the W6b client PWA surface. W6a already shipped the SW (cached-shell + push +
>   `notificationclick`) + `push` router + the Valkey 24h-dedup `reserveIdempotencyKey` primitive; S5
>   wires the CLIENT halves and corrects the SW tap-through to the LOCKED §20 contract — it does NOT
>   recreate W6a.
> • **uuidv7 + replay queue** (`src/lib/pwa/uuidv7.ts`, `…/replay-queue.ts` + 2 test files, NEW): RFC-9562
>   v7 generator (time-ordered idempotency key, dependency-free) + an IDB-backed FIFO `ReplayQueue`
>   (`idbStore`/`memoryStore`, fail-safe to memory without IndexedDB). 🟡 **FIFO bug caught by the unit
>   test:** `Date.now()` repeats within a ms and UUIDv7 intra-ms order is random, so same-ms enqueues
>   scrambled → fixed with a monotonic enqueue clock (`monotonicNow`); FIFO is now deterministic +
>   reload-safe. stop-on-throw replay preserves order across reconnects (server dedupes
>   `(actorId, idempotencyKey)` 24h). 9 unit tests added (2/2 → 11/11).
> • **ReplayQueueProvider** (`src/components/pwa/replay-queue-provider.tsx`, NEW): root context owning the
>   queue + reconnect-flush (`online` event) + a per-`type` executor REGISTRY (decoupled from any router —
>   the enqueuing screen also registers its replay executor). `pendingCount` drives the offline banner. No
>   live producer yet (the enqueuing mutations live in the deferred settings/call screens) — ships as a
>   complete, tested primitive (the `useSignaling` S1 precedent: full transport before its screens).
> • **OfflineBanner** (`…/pwa/offline-banner.tsx`, NEW): `navigator.onLine`-driven cached-shell offline /
>   "Reconnecting…" banner with queued-action count (Clay tokens, `role=status`). **Boundary:** the
>   WebSocket-specific Reconnecting/backoff/Retry-now/CALL-disable/directory-resync half of flow #21 stays
>   with the single `useSignaling` instance the device-home call-engine owns — only the network-level
>   banner + replay queue ship here.
> • **InstallBanner** (`…/pwa/install-banner.tsx`, NEW): flow #19 verbatim — `beforeinstallprompt`
>   intercept, 2nd-visit gate (`localStorage.yelli_visited`), 30-day snooze
>   (`localStorage.yelli_install_snoozed_until`), standalone suppression, Cloud-only `push.recordInstall`
>   audit on accept (gated on an authenticated session; LAN skips — `pwa.install` is Cloud-only).
>   **iOS reconciliation:** the spec routes the iOS hint to a "Settings → Install on iOS" page (the
>   deferred ScreenTenantSettings) — surfaced INLINE as the same Share-sheet → Add-to-Home-Screen
>   walkthrough (no routing dependency, same UX intent). Mounted in `(app)` layout (idle-directory scope).
> • **ServiceWorkerBridge + sw.js §20 fix** (`…/pwa/service-worker-bridge.tsx`, NEW; `public/sw.js`, EDIT):
>   `notificationclick` now POSTs a focused client `{ type:'incoming-call', callSessionId }` (was
>   `client.navigate` — a deviation from the LOCKED §20 contract); the client bridge listens and
>   soft-`router.push('/app?incoming=…')`. Consuming the `?incoming=` param + `call.pending` modal stays
>   with the call-engine.
> • **Mounts:** root `layout.tsx` wraps the tree in `ReplayQueueProvider` + mounts `PwaGlobalChrome`
>   (OfflineBanner + bridge) inside `Providers`; `(app)/layout.tsx` mounts `InstallBanner` above the shell.
> • **Toast reconciliation:** no `<Toaster>` is mounted app-wide, so the spec's "Will retry when
>   reconnected" toast is surfaced as inline offline-banner text (same intent, no sonner dependency).
> • **Loading states (ui-rules Rule 11):** banners have no async data load on mount ⇒ neither Skeleton nor
>   phantom-ui applies; all-Clay-token surfaces, zero raw hex (Rule 3).
> Validation all green: prettier ✓, web typecheck 0, web lint 0/0, web test 11/11 (was 2/2 — +9 PWA
> tests), `next build` ✓ (route table unchanged — components are mounted not routed; only the
> pre-existing non-fatal @prisma/client `export *` Turbopack warning, S2), turbo typecheck+lint 14/14.
> **Dispatch note (Rule 15): authored Opus-inline — standing V32.1 env-structural swarm fallback
> (headless `claude -p`, sub-agent dispatch unreliable per lessons.md). The install/offline banners +
> SW bridge + replay queue/provider share the W6a SW/idempotency contracts + the Clay token surface +
> one ReplayQueue type surface = one cohesive PWA-chrome unit, no independent fan-out boundary ⇒ no
> parallel fan-out warranted regardless; R1 deviation accepted per the standing pattern.**
> **NEXT: device-home call-engine (peer directory + RTCPeerConnection + the single `useSignaling`
> instance; consumes the §20 `?incoming=` deep link + registers replay executors) → W5b-e queue bodies →
> deferred ScreenTenantSettings (needs a Phase-3.3 prototype pass + `tenants.update` backend).**

> **S4 DONE (this session, 2026-06-13).** W1b app-shell — the chrome + role-aware
> landing + role-aware nav + footer that the S3a–S3d ports deferred ("W1b mounts chrome"),
> the gated mounting of the 3 admin screens as real routes, and the root session-kill PUSH
> listener (Step 6, 30s SLO). 10 files (8 NEW + delete old `app/page.tsx` + edit), all green,
> zero new deps.
> • **SCOPE RECONCILIATION (resolved from authoritative artifacts — no escalation):** the brief
>   named `trpc.brand.get` (does not exist — the `brand` router only has `update`; the brand lives
>   on `Tenant`, exposed by `tenants.get`) and "tenant resolver in `middleware.ts`" (Next 16 renamed
>   it `proxy.ts`, ALREADY built in W3 — the `ƒ Proxy (Middleware)` in every build). Both resolved
>   by precedent (S3c-class brief-vs-reality): the brand is resolved **server-side** and passed as a
>   prop (see below) and the resolver is NOT recreated. The stale q-S4-01/03 S4a/S4b answers describe
>   the original scaffold (committed 1eb2ae4 / S0–S4b) and are already built — this session is the
>   W1b app-shell the brief TITLE names.
> • **AppShell** (`apps/yelli/src/components/shell/AppShell.tsx`, NEW): the Clay-token chrome —
>   tenant top bar (brand + slug host + lucide/logo), role-aware top nav (md+) + mobile bottom nav,
>   user `DropdownMenu` with Sign out, footer (Powerbyte credit, MOCKUP verbatim). Pure
>   presentational client component; role + brand arrive as a `ctx` prop. Zero raw hex — every
>   MOCKUP hex mapped to a Clay semantic token (ui-rules Rule 3): `#fffaf0`→`bg-canvas`,
>   `#1a3a3a`→`bg-brand-teal`, `#e5e5e5`→`border-border`, `#0a0a0a`→`text-text-primary`,
>   `#6a6a6a`→`text-text-muted`, `#b8a4ed`→`bg-brand-lavender`. Nav links DERIVED from `isAdmin`
>   (Directory always; Members/Invitations/Audit admin-only) → mounts the existing S3 routes.
> • **`resolveAppShellContext`** (`src/lib/server/app-context.ts`, NEW): server-side resolver of
>   `{ isAdmin, tenantId, userLabel, brand }`. **Why server-side (the brand reconciliation):**
>   `tenants.get` is a `protectedProcedure` → throws UNAUTHORIZED for LAN-anonymous admins (cookie,
>   no Auth.js user), and `useSession()` is blind to LAN admins entirely. So role is resolved from
>   BOTH `auth()` (Cloud `role:'admin'`) AND `getLanAdminSession()` (LAN cookie), and the brand from
>   a base-client `tenant.findUnique` self-lookup by id (no cross-tenant exposure). Works in both
>   editions, no client flash.
> • **`(app)` route group** (`app/(app)/layout.tsx` + `app/(app)/page.tsx`, NEW; old `app/page.tsx`
>   deleted): the layout wraps the Directory landing in `AppShell`; the page is the role-aware shared
>   home (PROTOTYPE.md §3 "same screen serves LAN/Cloud/account") — idle CALL hero for all + admin
>   quick-link cards when `isAdmin`. The live peer directory + RTCPeerConnection CALL action are the
>   **device-home call-engine session** (the broader W1b engine, out of this app-shell title's scope).
> • **Gated admin area** (`app/admin/layout.tsx` + `members|invitations|audit/page.tsx`, NEW): server
>   gate (`!isAdmin → redirect('/admin/login')`) + `AppShell`; the 3 pages are trivial wrappers of the
>   S3c/S3d-ported `ScreenAdmin{Members,Invitations,Audit}`. **This resolves the live S3a gap** — the
>   Flow E login pushed to `/admin/members`, which 404'd until now. `/admin/login` stays in `(public)`
>   (outside this subtree) → ungated. No route collision (build route table confirms distinct paths).
> • **SessionKillListener** (`src/components/shell/SessionKillListener.tsx`, NEW) + **`useDeviceId`**
>   (`src/lib/device-id.ts`, NEW): root-mounted Step 6 PUSH listener — `useSignaling` `onSessionKill`
>   → `signOut`. **Idle-until-ready posture (S1/W6a precedent):** the socket only connects with a
>   configured `NEXT_PUBLIC_SIGNALING_URL` (absent in LAN/dev) + a resolved localStorage deviceId;
>   `getToken` fetches `/api/auth/ws-token` which **lands with the device-session model (q-W2b-04)**,
>   so until then it returns null and the PUSH path stays dormant — the already-live PULL path (jwt/
>   session DB-revalidate, config.ts) keeps covering the 30s SLO. No crash, no behaviour change.
> • **Loading states (ui-rules Rule 11):** chrome brand is a server prop (no client fetch) ⇒ no
>   Skeleton/phantom needed; the mounted S3 screens carry their own PATH-A skeletons.
> Validation all green: prettier ✓, prisma generate ✓, web typecheck 0, web lint 0/0, web test 2/2,
> `next build` ✓ (route table now lists `ƒ /`, `ƒ /admin/{members,invitations,audit}`, `ƒ /admin/login`,
> `ƒ Proxy (Middleware)` — no collision), turbo typecheck+lint 14/14. Only the pre-existing non-fatal
> @prisma/client `export *` Turbopack warning (S2).
> **DEFERRED (documented, non-blocking):** device-home call-engine (peer directory + RTCPeerConnection +
> CALL); `/api/auth/ws-token` + device↔user binding (q-W2b-04, lights up the session-kill PUSH);
> LAN-admin sign-out route (`/api/admin/logout` — Cloud signOut works; LAN cookie clear is a small
> follow-up); ScreenTenantSettings (branding/org — still awaits a Phase-3.3 prototype pass).
> **Dispatch note (Rule 15): authored Opus-inline — standing V32.1 env-structural swarm fallback
> (headless `claude -p`, subagent dispatch unreliable per lessons.md). The shell chrome + the two
> layouts + the session-kill listener + the gated screen mounts share the `ctx` prop contract + the
> Clay token surface = one cohesive interdependent app-shell unit ⇒ no fan-out warranted regardless;
> R1 deviation accepted per the standing pattern.**
> **NEXT: device-home call-engine (wire the Directory peer list to `devices.list` + the
> RTCPeerConnection media engine, driving OverlayIncomingCall/ScreenActiveCall via the single
> `useSignaling` instance) → W5b-e queue bodies → W6b PWA UI.**

> **S3d DONE (this session, 2026-06-13).** Flow H audit-view UI port — ScreenAdminAudit from
> the Phase 3.3 signed-off prototype (INHERIT-not-REPLACE), wired to the real `audit` router.
> 1 NEW file, all green, zero new deps. **SCOPE SPLIT per Brain q-87-S3d-01/02:** the brief paired
> ScreenAuditView + ScreenTenantSettings, but ScreenTenantSettings has NO signed-off Phase 3.3
> prototype and the brief's `trpc.tenants.update` does not exist → DEFERRED to its own future
> session after a Phase-3.3 prototype + client sign-off (branding-only → existing `trpc.brand.update`;
> the Org-settings page #18 additionally needs a NEW backend session to author `tenants.update`
> first — slug immutable, LOCKED Step 7). This session builds ONLY ScreenAdminAudit.
> • **ScreenAdminAudit** (`apps/yelli/src/components/screens/ScreenAdminAudit.tsx`, NEW): Flow H.
>   SWAP BOUNDARY — `trpc.audit.list` via `useInfiniteQuery` (cursor pagination, default 50) + a
>   "Load more" button (= the brief's "paginated audit log"; the sim returned a flat latest-200).
>   Client search filters loaded pages over action + payload (faithful to the sim). **WAVE-11 HARD
>   CONTRACT:** filter chips are DERIVED from the LOCKED §11 vocabulary (`@yelli/shared`
>   AUDIT_ACTIONS top-level namespaces) so they match verbatim and can't drift — the prototype's
>   5-chip subset (all/device/invitation/lan/user) predated the `call.*`/`tenant.*`/`pwa.*` additions;
>   deriving from the single source of truth is the production-correct realization. `actionPrefix`
>   (`${ns}.`) maps onto the router's `startsWith`. **ACTOR reconciliation** (S3a/S3c class — wire
>   governs): the audit wire returns only `actorUserId` (no name join; tenantId stripped #13), so
>   actor renders "System" (null → cron / LAN-anonymous) or the short id; no name lookup invented.
>   Naming: brief's "ScreenAuditView" → canonical ScreenAdminAudit (prototype source + sibling
>   `ScreenAdmin*` + W4 router doc; same as S3c's ScreenAdminMembers). Chrome dropped (W1b mounts
>   behind the admin gate); Clay tokens only, zero raw hex (Rule 3); loading = shadcn `<Skeleton>`
>   (Rule 11 PATH A); on-dark payload block uses `white` keyword (no on-dark token — W7/S3b posture).
> Validation all green: prettier ✓, web typecheck 0, web lint 0/0, web test 2/2, prisma generate ✓,
> `next build` ✓ (`ƒ Proxy (Middleware)`; route table unchanged — the screen is W1b-mounted, not
> routed, so it is absent from the build route table by design, per S3a/S3b/S3c).
> **Dispatch note (Rule 15): authored Opus-inline — standing V32.1 env-structural swarm fallback
> (headless `claude -p`); scope is a single indivisible screen wired to one router ⇒ no fan-out
> warranted regardless; R1 deviation accepted per the standing pattern.**
> **NEXT: W1b app-shell — mounts ScreenAdminAudit (+ S3a/S3b/S3c screens) behind the admin gate +
> owns nav + the single useSignaling instance. DEFERRED: ScreenTenantSettings (branding-only) after
> a Phase-3.3 prototype pass; W5b-e queue bodies; W6b PWA UI.**

> **S3c DONE (this session, 2026-06-13).** Admin-surface UI port — the device directory
> (Flow G) + the invitations screen (Flow F) from the Phase 3.3 signed-off prototype
> (INHERIT-not-REPLACE), wired to the real `devices`/`invitations` routers. 4 files (2 NEW
> screens + 1 NEW shadcn primitive + 1 type-helper edit), all green, zero new deps.
> • **SCOPE RECONCILIATION (resolved from authoritative artifacts — no escalation):** the
>   brief listed "ScreenAdminMembers + ScreenAdminDevices + ScreenAdminInvitations (Flows
>   F/G/H), wired to trpc.members.*/users.*/invitations.*". Reality (signed-off prototype +
>   real routers): there is **no `ScreenAdminDevices`** and **no `members` router** — in Yelli
>   a "member" IS a device, so `ScreenAdminMembers` IS the device directory (Flow G) and it
>   consumes `trpc.devices.*`. So S3c ports the **2 screens that exist**; "ScreenAdminDevices"
>   is the same surface (not a 3rd screen to invent — Rule 29/INHERIT). `users.*` isn't needed
>   (the prototype's `ensureAdminUser` is a sim-only hack; in prod `invitedBy` = the session user).
> • **ScreenAdminMembers** (`apps/yelli/src/components/screens/ScreenAdminMembers.tsx`, NEW): the
>   device directory. SWAP BOUNDARY wired — `trpc.devices.list` (status derived client-side: 5-min
>   online window / 15-min idle), filters (all/online/archived) + client name search, status +
>   call-role Badges. Actions: Change role → ported **OverlayCallRoleAssign** (S3b, self-wires
>   `devices.setRole`); Rename → ported **OverlayNamePicker** (S3a, parent wires `devices.setDisplayName`,
>   replacing the prototype's `window.prompt`); Archive/Remove → inline shadcn `Dialog` confirm
>   (no `window.confirm`) → `devices.archive`/`devices.delete`; Unarchive → `devices.unarchive`.
>   **Wave 9 split honored:** the screen calls `devices.archive` (singular admin → server emits
>   `device.archive`); the mass `device.archive.batch` stays cron-only (packages/jobs) — Audit View
>   pills intact. NO client-side audit writes (server emits §11 vocab). Hand-rolled prototype `<table>`
>   recomposed with the shadcn `Table` primitive + responsive mobile-card split; loading = shadcn
>   `<Skeleton>` (ui-rules Rule 11 PATH A); all Clay semantic tokens, zero raw hex (ui-rules Rule 3).
> • **ScreenAdminInvitations** (`.../screens/ScreenAdminInvitations.tsx`, NEW): Flow F. SWAP BOUNDARY —
>   `trpc.invitations.list`/`create`/`revoke`/`resend`. **Prototype-affordance reconciliation:** the
>   prototype's "Open link" can't exist in prod (raw token never client-returned — INVITATION_SELECT
>   omits tokenHash; token travels only in the queued email), so pending invites expose **Resend**
>   (router re-delivery) + **Revoke** — same intent, same substitution class as S3a's Flow E gate fix.
>   Status Badges reproduce the signed-off Pill tones verbatim (pending=green, accepted+expired=ink).
> • **shadcn `Table` primitive** (`.../components/ui/table.tsx`, NEW): the canonical MIT copy-in (exactly
>   what `shadcn add table` writes; `table` was absent from the S4a-2 set). Hand-authored to satisfy
>   the brief's "shadcn DataTable" intent without network/CLI. Full TanStack `data-table` NOT warranted
>   (the directory is a simple filtered list — no column engine/sort/pagination; it would add a dep +
>   change the signed-off design).
> • **`src/lib/trpc/react.ts`** (EDIT): added `RouterOutputs`/`RouterInputs` (`inferRouterOutputs`/
>   `inferRouterInputs<AppRouter>`) so client screens type rows as the exact wire shape
>   (`RouterOutputs['devices']['list'][number]`).
> • **Placement/precedent:** screens → `components/screens` (W1b mounts them behind the admin gate +
>   owns nav). Chrome (TenantTopBar/BottomNav/AppFooter) dropped (S3a/S3b precedent). Fully Client
>   Components (tRPC-react hooks + filter state can't run in a Server Component — ScreenActiveCall
>   precedent; the brief's "Server Component for list views" yields to that established pattern).
>   New components are imported by W1b, NOT routed ⇒ absent from the `next build` route table (expected).
> Validation all green: prisma generate ✓, web typecheck 0, web lint 0/0, web test 2/2, `next build` ✓
> (`ƒ Proxy (Middleware)`; route table unchanged — components are W1b-mounted, not routes), prettier ✓.
> **Dispatch note (Rule 15): authored Opus-inline — standing V32.1 env-structural swarm fallback
> (headless `claude -p`, subagent dispatch unreliable per lessons.md). The 2 screens + the Table
> primitive + the type-helper share the Clay token surface + the devices/invitations contracts =
> one cohesive UI-port unit; R1 deviation accepted per the standing pattern.**
> **NEXT: W1b app-shell — mounts ScreenAdminMembers + ScreenAdminInvitations (+ S3a/S3b screens) behind
> the admin gate, builds the device/idle screens, owns navigation + the single useSignaling instance.**

> **S3b DONE (this session, 2026-06-13).** Flow A core UI port — the 3 calling-flow
> components from the Phase 3.3 signed-off prototype (INHERIT-not-REPLACE), wired to the real
> tRPC routers + the S1 `useSignaling` contract. 3 NEW files, all green, zero new deps.
> • **OverlayIncomingCall** (`apps/yelli/src/components/overlays/OverlayIncomingCall.tsx`, NEW):
>   pure controlled (callerName/callerDeviceName/onAccept/onReject/busy) — same controlled boundary as
>   `OverlayNamePicker` (S3a). No sim/tRPC in-file (prototype had none). W1b app-shell wires
>   onAccept→`calls.connect`+`sendAnswer`, onReject→`calls.end({reason:'declined'})`+`sendHangup`.
>   Recomposed from shadcn `Dialog`/`Button` + lucide (Phone/X) + Clay tokens; non-cancellable
>   (outside/Esc/X suppressed — you answer the phone). Wave 7 refine #2 satisfied (eyebrow → DialogTitle `<h2>`).
> • **OverlayCallRoleAssign** (`.../overlays/OverlayCallRoleAssign.tsx`, NEW): self-wired to
>   `trpc.devices.setRole` (faithful — prototype self-called `devices.setRole`). The prototype's
>   hand-appended `{from,to}` audit hack is DROPPED: the server's `setRole` already emits the
>   §11-canonical `device.role.assign { deviceId, from, to }` (W1a) — client neither can nor should
>   write AuditLog; the "Audit log will record" preview is display-only and mirrors that emit. Loading =
>   `mutation.isPending` (Save → "Saving…"). a11y: `radiogroup`/`radio` on the 3 role options.
> • **ScreenActiveCall** (`.../components/screens/ScreenActiveCall.tsx`, NEW): immersive in-call view.
>   SWAP BOUNDARY wired — `trpc.calls.byId` (session + `endReason`) + `trpc.devices.byId` (peer name) +
>   `trpc.calls.end({reason:'completed'})` + `useSignaling.sendHangup`. Consumes only the `sendHangup`
>   slice of the `SignalingHandle` via prop: **single-socket ownership** — the parent W1b owns the ONE
>   `useSignaling` instance + the RTCPeerConnection media engine (getUserMedia / offer-answer-ICE /
>   remote-stream attach); the media controls (mute/camera/speaker/swap) are presentational until that
>   call-engine lands. **forbidden-by-role (Step 4):** `calls.start` server-rejects a role-blocked attempt
>   by creating the session already-ended with `endReason:'forbidden-by-role'` → this screen renders a
>   distinct "Call not allowed" terminal (vs generic "Call ended"/"not found"). Live elapsed timer from
>   `connectedAt` (ringing → "Ringing…"). Clay-token gradient + lucide icons; on-dark text uses Tailwind
>   `white` keyword utilities (no on-dark token exists — W7 deferral #4 posture; tokens.css NOT edited).
> • **Placement decision:** overlays→`components/overlays`, screen→`components/screens` (the prototype is
>   a state-machine SPA, not URL-routed; W1b owns navigation + the PWA `/app?incoming=` entry). No new
>   `app/` route added (avoids inventing routing W1b owns). New components are imported by W1b (not routed)
>   ⇒ they do NOT appear in the `next build` route table — expected.
> Validation all green: prisma generate ✓, web typecheck 0, web lint 0/0, web test 2/2, `next build` ✓
> (`ƒ Proxy (Middleware)`; only the pre-existing non-fatal @prisma `export *` Turbopack warning).
> **Dispatch note (Rule 15): authored Opus-inline — standing V32.1 env-structural swarm fallback; the 3
> components share the Clay token surface + the calls/devices/useSignaling contracts = one cohesive
> UI-port unit ⇒ no fan-out warranted regardless; R1 deviation accepted per the standing pattern.**
> **NEXT: W1b app-shell — mounts these 3 (inbound-ring trigger + single useSignaling instance +
> RTCPeerConnection media engine + navigation) + OverlayCallRoleAssign into the admin device directory.**

> **S3a DONE (this session, 2026-06-13).** First production UI port of the Phase 3.3
> signed-off prototype (INHERIT-not-REPLACE) — Flow E LAN admin login PAGE + Flow D device
> name-picker overlay. Resolves the S0 route/page collision per Brain q-S3a-01 [A].
> • **Login page** (`apps/yelli/src/app/(public)/admin/login/page.tsx`, NEW): client component;
>   shadcn `Card`/`Label`/`Input`(password)/`Button` on Clay semantic tokens (no raw hex — ui-rules
>   Rule 3). Per q-S3a-01 [A] it does NOT call next-auth `signIn()` — client-POSTs `{passphrase}` to
>   the relocated `/api/admin/login` handler (LOCKED Step 6 `signInLanAdmin` → `yelli_admin_session`
>   cookie), then on `{ok:true}` `router.push('/admin/members')` + `router.refresh()`. Generic
>   "Couldn't sign in" on every failure (security.md AUTH rule). Demo-passphrase hint + prototype
>   chrome (TenantTopBar/AppFooter/BottomNav) intentionally dropped (security + chrome = app-shell port).
> • **Name-picker overlay** (`apps/yelli/src/components/overlays/OverlayNamePicker.tsx`, NEW): bespoke
>   prototype overlay recomposed from shadcn `Dialog` primitives + Clay tokens; controlled-component
>   contract preserved verbatim (`initialName`/`onSave`/`onClose` + optional `saving`). First-join mode
>   (empty `initialName`) non-cancellable: Cancel hidden, built-in X suppressed via `[&>button]:hidden`,
>   outside-click + Esc `preventDefault`'d. Pure controlled — **W1b app-shell wires the `device.first_join`
>   trigger + `onSave` → `trpc.devices.setDisplayName`** (the trigger mount is NOT in this scope).
> • **Route relocation (path-only, verbatim — q-S3a-01 [A]):** `git mv
>   apps/yelli/src/app/admin/login/route.ts → apps/yelli/src/app/api/admin/login/route.ts`. Resolves the
>   Next.js route.js/page.js collision at `/admin/login`; the `(public)` route group keeps the page URL at
>   `/admin/login`, the handler moves to `/api/admin/login`. No logic change; import unchanged.
> • **Flow E gate re-render fix (DECISIONS_LOG Phase 3.3 deferral #1):** the prototype's `go('admin-members')`
>   setState no-op can't occur under real URL navigation; the production fix is structurally different (as the
>   deferral mandated) — navigate for real + `router.refresh()` to invalidate the RSC Router Cache so the
>   server-side admin gate re-reads the freshly-set cookie (App Router analog of "react-query invalidation").
>   The deferral's *suggested* mechanism ("tRPC session query") is superseded by the newer session-specific
>   q-S3a-01 [A] (no-tRPC wiring) per H1; its *intent* (real fix, not a prototype patch) is honored.
> • **Loading states (ui-rules Rule 11):** no async data load on mount ⇒ neither shadcn `<Skeleton>` nor
>   `<phantom-ui>` applies; submit-in-flight is a disabled-button state. • **Build gotcha (🔴 lessons):** a
>   `git mv` of an App Router `route.ts` leaves a stale `.next/types/validator.ts` referencing the old path →
>   `rm -rf apps/yelli/.next` before typecheck. Validation all green: prisma generate ✓, web typecheck 0,
>   web lint 0, web test 2/2, `next build` ✓ (route table: `ƒ /admin/login` [page] + `ƒ /api/admin/login`
>   [handler], no collision; `ƒ Proxy (Middleware)`). **Dispatch note (Rule 15): authored Opus-inline —
>   headless `claude -p` swarm worker, sub-agent dispatch unreliable (standing V32.1 env-structural fallback);
>   the 3 units share the token surface + LOCKED routing decision = one cohesive UI-port unit ⇒ no fan-out
>   warranted regardless; R1 deviation accepted per the standing pattern.** **NEXT: W1b app-shell (mounts the
>   name-picker on `device.first_join`, builds the device/idle screens) + the admin-area pages behind the gate.**

> **S2 DONE (this session, 2026-06-13).** W5-runtime — BullMQ worker HOST process +
> device-archive 03:00 UTC cron + container image + compose service. The 6 queue
> DEFINITIONS (S3) + the device-archive PROCESSOR (W5a) finally have a runtime to execute in.
> RE-SCOPED to W5-runtime only per Brain q-80-S2-01 (tenant-export/email/logo-image/backup
> BODIES = separate ordered sub-sessions W5b→W5e; soft-delete-cron stays a throwing stub
> behind the deferred schema session per q-80-S2-02 — NO schema column added here).
> • **Runtime layer (NEW `packages/jobs/src/runtime/`):** `processors.ts` (typed `PROCESSORS`
>   registry — device-archive real, 5 stubs) · `scheduler.ts` (`startDeviceArchiveCron` — a
>   `device-archive-dispatch` infra queue carries the daily tick via BullMQ `upsertJobScheduler`
>   `{ pattern:'0 0 3 * * *', tz:'UTC' }`; its dispatcher worker reads non-suspended tenants and
>   `addBulk`s ONE `{tenantId,userId:'system'}` device-archive job per tenant — security.md cron
>   rule 7, since the W5a processor is per-tenant) · `worker-host.ts` (`startWorkerHost` — 6 typed
>   Workers + the cron dispatcher, shared ioredis connection, default opts `attempts:3 +
>   exponential backoff`, `removeOnFail` keeps 1000 = the DLQ, `failed`/`error` structured-JSON
>   listeners, `stop()` drains→closes→quits) · `main.ts` (entrypoint `tsx src/runtime/main.ts`,
>   SIGTERM/SIGINT graceful shutdown).
> • **ONLY device-archive is cron-scheduled** (03:00 UTC). `backup` (02:00, Step 7) +
>   `soft-delete-cron` stay UNSCHEDULED — registering their crons would fail daily against stubs;
>   their schedulers land in W5e / the schema session.
> • **DLQ note (🟤 lessons):** `email` + `logo-image` HAVE live producers (W3 invitations / W4
>   branding). With stub Workers now registered, real jobs fail fast → 3 retries → failed set (DLQ)
>   instead of silent pile-up — the Brain-chosen behavior. W5c/W5d fill the bodies. Branding still
>   works (the original logo is live from W4); invitation emails won't send until W5c.
> • **Container:** `packages/jobs/Dockerfile.workers` — 3-stage. Can't esbuild-bundle (Prisma engine
>   must live in node_modules), so it keeps the workspace install, `prisma generate`s in-image, runs
>   the TS entrypoint with `tsx` (NEW devDep `tsx ^4.19.2`). Non-root + tini, no port.
> • **Compose:** `deploy/compose/{dev,stage,prod}/docker-compose.worker.yml` — dev builds; stage/prod
>   pull `${DOCKERHUB_USERNAME}/${WORKER_IMAGE_NAME:-yelli-worker}` (NO build:). No host port / no
>   Traefik (background). `start.sh` wires it in (after app); `push.sh` builds/promotes the separate
>   `yelli-worker` image alongside the app.
> • **`packages/jobs/package.json`** +`"start":"tsx src/runtime/main.ts"`; **`index.ts`** exports
>   `startWorkerHost`/`WorkerHost`/`PROCESSORS`. LOCKED `queues.ts` + the 6 worker files UNTOUCHED.
> Validation all green: pnpm install ✓ (tsx relinked), prisma generate ✓, turbo typecheck 7/7, lint
> 7/7, test 2/2 (web) + signaling, `next build` ✓ (2/2). **Dispatch note (Rule 15): authored
> Opus-inline — standing V32.1 env-structural swarm fallback; the runtime layer (processors→scheduler
> →host→entrypoint) shares types + the Redis connection + shutdown path, and the Docker/compose files
> must match the entrypoint path/script verbatim = single indivisible unit ⇒ no fan-out warranted
> regardless; R1 deviation accepted per the standing pattern.**
> **W5-runtime is the host; the queue BODIES remain: W5b (tenant-export) → W5c (email) → W5d
> (logo-image) → W5e (backup), dispatched IN ORDER. soft-delete-cron stays deferred behind the schema session.**

> **S1 DONE (this session, 2026-06-13).** W2b-2 — `useSignaling` client transport
> hook (`apps/yelli/src/hooks/useSignaling.ts` + `env.NEXT_PUBLIC_SIGNALING_URL`).
> Pure-transport React hook ('use client'): owns the WebSocket lifecycle against
> `apps/signaling`, sends the `hello` handshake with an Auth.js v5 JWT supplied by
> a caller-injected `getToken()` async, exposes typed senders for the 4 LOCKED
> signal op-codes (`offer`/`answer`/`ice`/`hangup` — scope's "bye" maps to the
> locked `hangup` vocab matching `signalMessageSchema`), surfaces inbound
> `signal`/`call-signal`/`peer-offline`/`error`/`pong` frames via stable
> ref-stored callbacks (parent re-renders never tear down the socket — only
> `enabled`/`deviceId`/`url` reconnect), and runs a 25s keepalive ping inside the
> server's 30s window. Reconnect uses an exponential-backoff schedule
> (1s→2s→4s→8s→16s→30s capped, ±20% jitter) that resets to 0 after a successful
> `ready`. Step 6 LOCKED session-kill push: server pairs `unauthorized` +
> "Session ended." then closes with `CLOSE_POLICY_VIOLATION` — the hook
> recognises both signals, fires `onSessionKill` once, flips to terminal `failed`
> state, and stays down (no reconnect; consumer is expected to `signOut` and
> route to /login). Status machine: `idle → connecting → authenticating → open →
> reconnecting → closed | failed`. Step 5 LOCKED role-broadcast (Valkey pub/sub)
> explicitly stays OUT of this hook — the client-facing `ServerMessage` union has
> no `role-change` variant and `apps/signaling/src/server.ts` doesn't relay it;
> when/if a `role-change` ServerMessage lands the hook extends without an API
> break (callback shape designed for it). Env: `NEXT_PUBLIC_SIGNALING_URL`
> (optional URL) added to `apps/yelli/src/env.ts` — absent ⇒ hook stays idle, so
> W1b can ship without it. Validation all green: web typecheck 0, web lint 0,
> web test 2/2. **Dispatch note (Rule 15):** authored Opus-inline — standing
> V32.1 env-structural swarm fallback (per lessons.md); the hook is a single
> indivisible unit (lifecycle + senders + handlers share refs/state) so no
> fan-out warranted regardless; R1 deviation accepted per the standing pattern.

> **S0 DONE (this session, 2026-06-13).** Accounts-auth Wire — Auth.js v5 `authorize()`,
> LAN Anonymous Admin verify/issue, and tRPC `invitation.accept`. The three inert skeletons
> across `apps/yelli/src/server/auth/` + `routers/invitations.ts` are now real.
> • **Cloud sign-in (`config.ts`):** `authorize({email,password,tenantSlug})` resolves the
>   tenant by slug → looks up `User` by `tenantId_email` → `bcrypt.compare` against
>   `User.passwordHash` at 12 rounds (**LOCKED Webmaster password hash algorithm** wins over
>   the session scope's "Argon2id verify against User" — DECISIONS_LOG priority 5 > session
>   message priority 8 per H1; Argon2id stays reserved for `Tenant.adminPassphraseHash`).
>   Returns the augmented user shape `{id,email,name,role,tenantId,tenantSlug,securityVersion}`
>   matching the `next-auth.d.ts` augmentation; null on any failure (suspended tenant/user,
>   bad password, bad slug) per security.md AUTH error-message rule. Best-effort
>   `lastLoginAt` stamp on success (non-blocking). Existing jwt+session callbacks
>   (DB-validate `securityVersion`+`isSuspended` per call — V28) ALREADY honor this shape
>   verbatim; ZERO touch to the callbacks.
> • **LAN Anonymous Admin (`lan-admin.ts`):** real `verifyAndIssueLanAdminSession(passphrase)`
>   — resolves the implicit LAN tenant (earliest-created tenant carrying a non-null
>   `adminPassphraseHash`) → `@node-rs/argon2` `verify` against
>   `Tenant.adminPassphraseHash` → on success issues a 30-day signed HMAC-SHA256 cookie
>   (`${tenantId}.${issuedAtMs}.${hmac}` keyed with `AUTH_SECRET`; constant-time hex compare
>   via `timingSafeEqual`) with `HttpOnly` + `SameSite=Lax` + `Secure` in prod (LOCKED
>   Step 6). Emits §11-canonical **`lan.admin.login.success`** / **`lan.admin.login.fail`**
>   (HARD CONSTRAINT). `getLanAdminSession()` now verifies signature + 30-day TTL (was
>   presence-only); new `clearLanAdminSession()` deletes the cookie + emits
>   **`lan.admin.logout`**. Cloud tenants have `adminPassphraseHash: null` ⇒ resolver
>   returns null ⇒ verify always fails (correct: Cloud uses Auth.js, not this path).
> • **`invitation.accept` (`routers/invitations.ts`, NEW `publicProcedure`):** unauthenticated
>   acceptance flow — `sha256(rawToken)` lookup against `Invitation.tokenHash` (@unique) →
>   not-expired + not-already-accepted gate (NOT_FOUND on any miss per security.md AUTH
>   error rule) → `bcrypt.hash(password,12)` OUTSIDE the tx (no write-lock held during
>   hash) → `prisma.$transaction`: re-reads invitation inside tx for double-accept race
>   defense → `tx.user.create` with `role: 'member'` (DECISIONS Step 1 default) +
>   `emailVerifiedAt: new Date()` (the invite link IS the verification) + `securityVersion: 0`
>   → `tx.invitation.update` `acceptedAt` stamp → §11-canonical **`invitation.accept`**
>   AuditLog row with `actorUserId: created.id` (the user just provisioned themselves;
>   AuditLog is L6-excluded so `tenantId` is passed explicitly per security.md #10). P2002
>   `(tenantId,email)` unique violation → CONFLICT (account exists). Returns client-safe
>   `{id,email,role}` only — never the `passwordHash`.
> • **HASH ALGO CONFLICT NOTED + RESOLVED PER H1.** Session scope said "Argon2id verify
>   against User" but `docs/DECISIONS_LOG.md` LOCKED entry `"Webmaster password hash
>   algorithm"` mandates `bcryptjs at 12 rounds` for `User.passwordHash`. Followed the
>   higher-priority source (DECISIONS_LOG > session message) — User uses bcryptjs;
>   Argon2id remains exclusive to `Tenant.adminPassphraseHash` (LAN admin). Logged here
>   per Rule 28 / H1 priority-order resolution rule.
> • **3 deps added** to `apps/yelli/package.json` (auth surface needs real verifiers):
>   `bcryptjs ^2.4.3` (pure JS, OSS — Rule 14) + `@types/bcryptjs ^2.4.6` + `@node-rs/argon2
>   ^2.0.2` (pure-Rust Argon2id, MIT, no native build — superior to native `argon2`).
> • **5/min/IP rate-limit on LAN login (LOCKED Step 6) DEFERRED** to the future
>   `/admin/login` Route Handler that will wire `verifyAndIssueLanAdminSession` — it
>   needs the request IP, unreachable from a pure backend helper. Non-blocking; the audit
>   pair (`lan.admin.login.success`/`fail`) is already live for observability.
> • **`invitation.create/resend/revoke` UNCHANGED** — W3's existing bodies stand; only
>   the previously-DEFERRED `accept` lands.
> Validation all green: `pnpm install` ✓ (4 packages added: @node-rs/argon2 + bcryptjs +
> @types/bcryptjs + transitives), prisma generate (no schema change), web typecheck 0,
> web lint 0, `next build` ✓ (`ƒ Proxy (Middleware)`; only the pre-existing non-fatal
> @prisma/client `export *` Turbopack warning), web test 2/2. **Dispatch note (Rule 15):
> authored Opus-inline — standing V32.1 env-structural swarm fallback (see lessons.md);
> 3 files form one cohesive auth pipeline (Cloud authorize ↔ invitation.accept share the
> bcryptjs decision; LAN admin shares the audit-vocab + AUTH_SECRET surface) = single
> indivisible unit ⇒ no fan-out warranted regardless; R1 deviation accepted per the
> standing pattern.**

> **W7 DONE (2026-06-13).** Design system finalization — Phase 3.3 deferral #3
> (font loading) + `/design-review` regression. Inter is now self-hosted via `next/font/google`
> (replacing the runtime Google Fonts `@import`): `layout.tsx` configures `Inter({ subsets:['latin'],
> display:'swap', variable:'--font-inter' })` (variable font ⇒ no weights) + `inter.variable` on
> `<html>`; `globals.css` drops the `@import` and leads `font-family` with `var(--font-inter)`
> (letter-spacing preserved); `next.config.ts` CSP tightened — dropped `fonts.googleapis.com`
> (style-src) + `fonts.gstatic.com` (font-src), now self-hosted from `'self'` (security win).
> Verified vs Next 16 `next/font` docs (context7). `/design-review` regression GREEN (INHERIT-not-
> REPLACE): MOCKUP.jsx/DESIGN.md baseline body face = Inter → preserved; LOCKED tokens untouched
> (parity 2/2); DESIGN.md/MOCKUP.jsx NOT regenerated.
> • **#2 (overlay eyebrow `<div>`→`<h2>`) RE-DEFERRED — no production target:** `OverlayIncomingCall`/
>   `OverlayCallRoleAssign` exist ONLY in `prototype/`; the production UI port (W1b / calling-UI port
>   per q-W2b-03) hasn't run. The heading-semantics fix applies DURING that port (Phase 4 Parts 5-6
>   MODEL HOOK). Not applied to the signed-off prototype (Phase 3.3 CLOSED; INHERIT-not-REPLACE; it
>   carries no `eyebrow` markup anyway). → schedule on the overlay UI-port session.
> • **#4 (hex→CSS var / token consumption) RE-DEFERRED — no clean target without unlocking tokens.css:**
>   shadcn primitives already consume CSS vars (S4a-*). Residual production hex are not tokenizable —
>   `themeColor:'#1a3a3a'` is `viewport` metadata (no var allowed); `--primary/--destructive-foreground:
>   #ffffff` are on-dark whites with no dedicated token; `--border`/`--input:#e5e5e5` have NO matching
>   LOCKED token (adding one = editing the LOCKED `tokens.css`, forbidden unilaterally). → DECISIONS_LOG-
>   authorized token-vocabulary session (or finalize during the overlay port alongside #2). tokens.css/
>   tokens.ts UNTOUCHED.
> Validation all green: prisma generate ✓, web typecheck 0, web lint 0, prettier ✓ (3 files), web test
> 2/2, `next build` ✓ (`ƒ Proxy (Middleware)`; only the pre-existing non-fatal @prisma `export *` S2
> warning). 3 production files (+17/-7) + 2 governance docs; 1 atomic commit. **Dispatch note (Rule 15):
> authored Opus-inline — standing V32.1 env-structural swarm fallback; the font migration spans 3
> interdependent files (layout+globals+CSP) = a single indivisible unit ⇒ no fan-out warranted
> regardless; R1 deviation accepted per the standing pattern.**

> **W6a DONE (this session, 2026-06-13).** Wire W6a — PWA backend surface (Service Worker
> + manifest + push tRPC + Valkey dedup; zero UI deps). The Brain-approved W6 split (q-W6-01 [A])
> ships W6a now (validates green standalone); **W6b** (install banner + offline/Reconnecting banner
> + client UUIDv7 replay queue) is dispatched with-or-after W1b once the idle-screen app-shell exists.
> • **push router** (`apps/yelli/src/server/trpc/routers/push.ts`, NEW, merge key `push`): 3
>   protectedProcedures (q-W6-04 — tenantId+userId bound from the Auth.js v5 session; LAN-anonymous
>   device-only path DEFERRED to the q-W2b-04 device-session follow-up, NOT a publicProcedure shortcut).
>   `subscribe` (client-supplied deviceId VERIFIED in-tenant via L6 `ctx.db.device.findUnique` →
>   NOT_FOUND on cross-tenant; upsert-by-`endpoint` done as explicit find→update/create because the L6
>   guard injects tenantId into `data` only, NOT into `upsert.create` — 🔴 lessons). `unsubscribe`
>   (deleteMany by endpoint, idempotent). `recordInstall` emits **`pwa.install`** (§11 VERBATIM) via
>   the L5 `ctx.recordAudit` recorder, target `{Device, deviceId}`, **deduped by deviceId** (existing
>   `pwa.install` AuditLog row for the device → no second row; AuditLog is L6-excluded so the dedup read
>   scopes `tenantId` explicitly per security.md #10). Registered in `root.ts` as `appRouter.push`.
> • **AUDIT VOCAB (q-W6-03 ritual):** `pwa.install` appended to the LOCKED `@yelli/shared` AUDIT_ACTIONS
>   (new `pwa.*` namespace) + `docs/PROTOTYPE.md` §3 amended (Cloud-only; payload `{platform?}`; deduped
>   by deviceId) + a LOCKED DECISIONS_LOG entry citing the PRODUCT.md §11 L204+L390 mandate. HARD
>   CONSTRAINT satisfied — `push.recordInstall` emits the string verbatim.
> • **Service Worker** (`apps/yelli/public/sw.js`, NEW, vanilla — q-W6-02): Workbox-EQUIVALENT, no
>   Workbox dep (next-pwa/Workbox plugin is Turbopack-incompatible; the Workbox CDN runtime violates the
>   LAN offline-by-design lock §21). cache-first `/_next/static/*` · network-first navigation w/ cached
>   app-shell fallback (flow #21) · `push` → ONE notification, no action buttons (§20) · `notificationclick`
>   → focus existing client else `openWindow('/app?incoming={callSessionId}')` (flow #20). DECISIONS_LOG
>   L28 `Workbox + Web Push` → `Workbox-equivalent vanilla SW + Web Push`.
> • **manifest.json + icon.svg** (NEW, public/): standalone display, start_url `/app`, brand-teal
>   `#1a3a3a` theme + canvas `#fffaf0` bg (LOCKED Clay tokens), single maskable SVG icon. **SW registration**
>   (`src/components/pwa/service-worker-register.tsx`, 'use client') mounted from `layout.tsx`; manifest +
>   `viewport.themeColor` (Next 16 moved themeColor out of `metadata`) + appleWebApp meta added.
> • **Valkey idempotency dedup helper** (`apps/yelli/src/server/idempotency.ts`, NEW): `reserveIdempotencyKey
>   (actorUserId, key)` → `SET yelli:idem:<uid>:<key> 1 NX EX 86400` (LOCKED 24h window §21). Returns
>   `{duplicate}`; fail-open no-op without REDIS_URL (best-effort, mirrors realtime-bus). The primitive
>   only — the client replay queue + per-mutation wrapping land in W6b.
> • **ZERO new external npm deps** — sending push (web-push + VAPID) is a worker concern (deferred); uuid
>   generation is client-side (W6b). ioredis (5.10.1 pin) already present. No SOPS/secret provisioning needed.
> Validation all green: prisma generate ✓, turbo typecheck 7/7, lint 7/7, `next build` ✓ (`ƒ Proxy
> (Middleware)`; `push` router compiled), test (web 2/2), prettier ✓ on all touched files. Only the
> pre-existing non-fatal @prisma/client `export *` Turbopack warning (S2). **Dispatch note (Rule 15):
> authored Opus-inline — standing V32.1 env-structural swarm fallback; W6a is a small cohesive
> already-split unit ⇒ no fan-out warranted; R1 deviation accepted per the standing pattern.**

> **W5a DONE (this session, 2026-06-13).** BullMQ **device-archive** worker — 1st slice of the
> Brain-approved W5 split (q-W5-03 [A]: "dispatch W5a first as a clean DB-only session, zero new
> external deps"). The `packages/jobs/src/workers/device-archive.ts` STUB (S3 `throw NotImplemented`)
> is replaced with the real daily-03:00-UTC cron processor (Phase 3.3 `sim.repo.archive(olderThanDays)`
> SWAP BOUNDARY, PROTOTYPE.md Flow G): `device.updateMany` where `{ tenantId, archivedAt: null,
> lastSeenAt < now-90d }` → set `archivedAt`; iff `count>0`, write ONE **`device.archive.batch`** AuditLog
> row (Wave-9 mass-cron action, distinct from singular admin `device.archive`) — payload `{ count,
> olderThanDays: 90 }` VERBATIM from the sim (Audit View fidelity / HARD CONSTRAINT), `actorUserId: null`
> (system cron), `targetType: 'Device'`, `targetId: null` — atomic in `prisma.$transaction`. Tenant-scoped
> per security.md cron rule (one job/tenant; every query scoped to `job.data.tenantId` explicitly on the
> base/unguarded client). Auto-unarchive-on-reconnect stays in the devices-router path (NOT here).
> • **Only dep added: `@yelli/db` (workspace)** to `packages/jobs/package.json` — an INTERNAL link (not a
>   new external npm package; "zero new deps" targets external pkgs). No cycle (`@yelli/db` → `@prisma/client`
>   only). pnpm-lock relinked. • **No new test harness** added to `packages/jobs` — matches the backend-package
>   convention (W1a–W4 shipped bodies validated by typecheck+lint+build; tests live in `@yelli/web`) + the
>   q-W5-03 zero-deps constraint. Validation all green: `pnpm install` ✓ (8 projects), prisma generate ✓,
>   turbo typecheck 7/7, lint 7/7, test (web 2/2), `next build` ✓ (`ƒ Proxy (Middleware)`), prettier ✓.
> **Dispatch note (Rule 15): authored Opus-inline — standing V32.1 env-structural swarm fallback; scope is
> a single indivisible file ⇒ no fan-out warranted regardless; R1 deviation accepted per the standing pattern.**
> **W5 is NOT fully complete.** Remaining sub-sessions (Brain-approved, dispatch IN ORDER per q-W5-03 — NOT
> blockers): **W5-runtime** (BullMQ `Worker` process + repeatable-cron bootstrap + worker entrypoint; infra,
> no new external deps — processors need a host) → **W5b** tenant-export (+`@aws-sdk/s3-request-presigner` +
> `putObject`/`getObject`/`presignGet` on `@yelli/storage`) → **W5c** email (+`nodemailer` — SMTP not Resend,
> q-W5-02) → **W5d** logo-image resize (+`sharp` + root `onlyBuiltDependencies`) → **W5e** backup (pg_dump +
> env-gated `BACKUP_S3_*`; bucket + worker Dockerfile = Phase 6 infra). **soft-delete-cron** is separately
> deferred behind a SCHEMA session (q-W5-01: add `User.removedAt` + wire `removeMember`, THEN the 7-day sweep).

> **W4 DONE (2026-06-13).** Wire D — Audit + Branding. The last two `_placeholder`
> routers (`audit` + `brand`) now carry real bodies, the L5 audit-middleware recorder is live, and the
> new `@yelli/storage` package + `logo-image` queue trigger land. (This session verified-and-committed a
> prior in-session W4 draft that was written but never validated/committed — reviewed against scope + the
> HARD CONSTRAINT, ran full validation clean, committed.)
> • **audit** (`list`, admin-gated, read-only): cursor-paginated AuditLog view for ScreenAdminAudit (Phase
>   3.3 `sim.auditLog.recent` SWAP BOUNDARY), `createdAt desc`, optional `actionPrefix` §11-namespace filter.
>   AuditLog is L6-guard-EXCLUDED → the read scopes `tenantId: ctx.tenantId` EXPLICITLY (security.md #10);
>   tenantId omitted from rows (#13). Read-only ⇒ emits no audit action.
> • **brand** (`update`, admin-gated): `tenant.branding.update` production wiring of `sim.tenants.updateBranding`.
>   Optional `displayName` rename + optional `logo` ({base64,mime} to set / `null` to clear). Logo flow:
>   decode → `validateBrandingUpload` (magic-byte PNG/JPEG + declared-vs-sniffed match + 2 MiB; SVG/HTML
>   rejected — XSS) → `putBrandingLogo` (tenant-prefixed randomized key) → set `Tenant.logoUrl` → emit
>   **`tenant.branding.update`** (§11 VERBATIM, HARD CONSTRAINT) via `ctx.recordAudit` → best-effort
>   `enqueueLogoImage`. Tenant is L6-excluded → direct by-id `ctx.db.tenant.update`.
> • **audit middleware** (L5, real): `protectedProcedure` now `.use(auditMiddleware)` (LOCKED 5-step chain
>   fully live: error→rate-limit→auth→tenant-scope→audit). INJECTS a tenant+actor-bound
>   `recordAudit(action, target, payload?)` onto ctx for every protected call — the sanctioned write path
>   (binds tenantId+actorUserId from the session so call-sites can't get them wrong). `brand.update` is the
>   first adopter; the W1a/W3 per-procedure inline-write pattern coexists.
> • **@yelli/storage** (NEW workspace package, source-exported): `validate.ts` (LOCKED PNG/JPEG magic-byte
>   whitelist + 2 MiB) + `client.ts` (`putBrandingLogo` lazy S3/MinIO PUT, `forcePathStyle`, env-driven,
>   side-effect-free import). `apps/yelli/src/server/jobs/logo-queue.ts` = `logo-image` queue PRODUCER
>   (best-effort, no-op without REDIS_URL; W3 email-queue pattern). next.config: +`@yelli/storage`
>   transpiled, +`@aws-sdk/client-s3` serverExternal. The resize CONSUMER worker is DEFERRED (BullMQ-wiring
>   session) — the original logo is already live so branding works end-to-end without it.
> • **AUDIT VOCAB:** `tenant.branding.update` is entry #46 in the LOCKED `@yelli/shared` AUDIT_ACTIONS
>   (PROTOTYPE.md §3 contract) — emitted verbatim. HARD CONSTRAINT satisfied. DEFERRED emits (documented,
>   non-blocking): `tenant.admin.passphrase.set` → W6 LAN-admin (Argon2id); `tenant.export.*` → tenant-export
>   BullMQ session.
> Validation all green: `pnpm install --frozen-lockfile` ✓ (8 workspace projects), prisma generate ✓,
> turbo typecheck 7/7, lint 7/7, test (web 2/2), `next build` ✓ (proxy = `ƒ Proxy (Middleware)`;
> `@yelli/storage` transpiled + `@aws-sdk/client-s3` external resolved). Only the pre-existing non-fatal
> @prisma/client `export *` Turbopack warning (S2). **Dispatch note (Rule 15): authored Opus-inline —
> standing V32.1 env-structural swarm fallback; R1 deviation accepted per the standing pattern.**
> **ALL 7 routers now carry real bodies. W1b (Wire A UI port) and W2b-2 (client `useSignaling` hook)
> remain the open backend→UI wire deps; W5-W8 (UI/PWA/validation) follow.**

> **W3 DONE (2026-06-13).** Wire C — Tenancy + Members + Invitations. The `tenants` +
> `invitations` routers replace their S4b `_placeholder`s with real procedures, and the V25 proxy
> subdomain cross-check is filled in.
> • **invitations** (`list`/`create`/`revoke`/`resend`, admin-gated): create+resend mint a single-use
>   token (randomBytes→base64url), store ONLY its SHA-256 hash on `Invitation.tokenHash` (@unique), and
>   enqueue the RAW token to the `email` BullMQ queue post-commit via the NEW
>   `apps/yelli/src/server/jobs/email-queue.ts` producer (lazy singleton, best-effort, no-op without
>   REDIS_URL — the "invitation email queue trigger"; the SMTP worker stays a stub). `revoke` = immediate
>   expire (keeps the row for admin history). §11 audit verbatim (invitation.create/revoke/resend).
> • **tenants** (`get` + member admin `promote`/`demote`/`suspend`/`unsuspend`/`transferAdmin`): last-admin
>   guard (CONFLICT) on demote/suspend of the sole effective admin; transferAdmin = atomic promote+demote tx
>   (DL Step 6). Every role/status change bumps `User.securityVersion` (V28) AND fires
>   `publishSessionInvalidate` (the W2a bus call-site that W2a DEFERRED to "the W3 user routers" — now
>   landed; 30s SLO). §11 audit verbatim (user.role.promote/demote, user.suspend; un-suspend emits none —
>   W1a precedent). tenantId stripped from member rows (security.md #13).
> • **proxy.ts** — V25: parse the leftmost host label against `APP_BASE_DOMAIN`; bypass apex / reserved
>   (`isReservedSlug`) / non-Cloud hosts; redirect to the user's own tenant host on `token.tenantSlug`
>   mismatch. LAN (EDITION≠cloud or no base) disables the subdomain router (DL Step 1). +`EDITION` +
>   `APP_BASE_DOMAIN` (optional) to env.ts; proxy reads them off process.env (edge-light). +`@yelli/jobs`
>   dep + `bullmq` (serverExternalPackages) + transpilePackages.
> • **AUDIT VOCAB resolution:** used the LOCKED `@yelli/shared` AUDIT_ACTIONS verbatim (`user.role.*` /
>   `user.suspend`), NOT DECISIONS_LOG line-42's illustrative `member.role.*` / `lan.tenant.export` — the
>   `audit.ts` header marks the signed-off PROTOTYPE.md §3 list authoritative over PRODUCT.md's illustrative
>   enum. DEFERRED (documented, non-blocking): `invitation.accept` → accounts-auth; `tenant.export.*` →
>   BullMQ-wiring/storage session; `removeMember` (hard User delete) → needs a schema decision (no
>   soft-delete column; FK `Invitation.invitedByUserId` NOT NULL + AuditLog-immutability) — non-blocking
>   question raised; suspend is the MVP deactivation path.
> Validation all green: typecheck 7/7, lint 7/7, test (web 2/2), `next build` ✓ (proxy = `ƒ Proxy
> (Middleware)`), root turbo typecheck+lint+test 14/14. Only the pre-existing non-fatal @prisma/client
> `export *` Turbopack warning (S2). **Dispatch note (Rule 15): authored Opus-inline — standing V32.1
> env-structural swarm fallback; R1 deviation accepted per the standing pattern.** **W1b (Wire A UI port)
> and W2b-2 (client `useSignaling` hook) remain the open wire deps; W4-W8 follow.**

> **W2b-1 DONE (2026-06-12).** Wire B2 — standalone WebSocket signaling SERVER + deploy.
> Per the resolved split (q-W2b-02), W2b was divided into **W2b-1 (server + deploy, this session)** and
> **W2b-2 (client `useSignaling` transport hook, NEXT — depends on this commit)**; the calling-UI port is
> a later, separate session (q-W2b-03). New workspace package **`apps/signaling`** (`@yelli/signaling`):
> a `ws` server (`src/server.ts`) — handshake auth, per-tenant `PeerRegistry`, WebRTC SDP/ICE relay with a
> bus-driven defense-in-depth call-guard (`CallAuthorizer`, emits `forbidden_by_role` on unauthorized
> `offer`), Valkey bus subscription for cross-instance call-signal fan-out + `session-invalidate`
> force-close (security.md REALTIME #3), and a short-TTL Valkey heartbeat. Topology (q-W2b-01): **own
> container, Traefik `PathPrefix(/ws)` higher-priority router on `${APP_DOMAIN}`** (dev/stage/prod compose
> added), built as a self-contained esbuild CJS bundle (zero runtime node_modules). The bus contract +
> NEW signaling wire-protocol (zod-validated) were **promoted to `@yelli/shared` (`realtime.ts`)** as the
> single source of truth; `apps/yelli/src/server/realtime/bus.ts` now re-imports + re-exports them (public
> API unchanged). `GET /_pwbt/health` route added (`{ok,db,valkey,signaling}` — signaling field driven by
> the heartbeat; `%5F` folder escape so Next routes `_pwbt`). WS handshake auth verifies the Auth.js v5
> session JWT via `@auth/core/jwt` (LOCKED jwt strategy + shared AUTH_SECRET) — **surfaced NON-BLOCKING
> q-W2b-04**: it carries User.role not Device.callRole (call-role guard delegated to the authoritative bus
> `start`), and deviceId↔user binding is a follow-up tied to the unbuilt device-session model. Validation
> all green: typecheck 6/6, lint 6/6, build 2/2 (`/_pwbt/health` routes; signaling bundle 642.7KB), test 12/12
> (signaling 10 + web 2). **Post-review hardening:** an automated security review flagged (HIGH) the
> device-impersonation gap pre-surfaced as q-W2b-04 → mitigated in-scope by making `PeerRegistry.add` refuse
> to displace a deviceId held by a DIFFERENT same-tenant user (closes the live-hijack vector; full
> deviceId↔user binding remains q-W2b-04, residual = pre-claiming an offline device id).
> **Dispatch note (Rule 15): authored Opus-inline — the V32.1 swarm subagent-dispatch
> regression (environment-structural; see memory) makes parallel Sonnet fan-out unreliable here; R1
> deviation accepted per the standing pattern.** **W2b-2 (client useSignaling hook) is the next session.**

> **W2a DONE (2026-06-12).** Wire B1 — calling DATA + REALTIME-fan-out plane. The `calls`
> router (merge key `calls`, LOCKED) replaces its S4b `_placeholder` with the real CallSession lifecycle
> (Phase 3.3 `sim.callSessions` SWAP BOUNDARY, PROTOTYPE.md §3 Flow A/B): `list` / `byId` / `start`
> (role-snapshot + server-side role-guard auto-reject → `endReason: forbidden-by-role`) / `connect` /
> `end` (durationSec, idempotent). A new `apps/yelli/src/server/realtime/bus.ts` adds the Valkey (ioredis
> 5.10.1) pub/sub bus: tenant-scoped channels + best-effort publishers + **hybrid push+pull session-kill at
> the LOCKED 30s SLO** + `createBusSubscriber()` for W2b. `call-signal` producers are LIVE in the router;
> `publishRoleChange`/`publishSessionInvalidate` are ready API whose call-sites (devices.setRole = W1a's
> file; W3 user routers = placeholders) are deferred to keep W2a self-contained. **DECISION (🔴 lessons):
> calls are NOT AuditLog'd — recorded in the CallSession entity (PRODUCT.md §11); sim + schema
> (no `CallSession` AuditTargetType) + Wave-4 reconciliation all agree; PROTOTYPE.md §3 audit prose is
> stale → surfaced as NON-blocking q-W2a-01.** Validation all green (typecheck/lint/build, test 2/2).
> **W2b (WebSocket signaling server, subscribes to the bus) is the next session and depends on this commit.**

> **W1a DONE (2026-06-12).** Wire A backend HALF (per the resolved q-W1-05 split): the
> `devices` router (10 real Prisma-backed procedures, L1+L6 tenant-guard + L5 inline AuditLog + RBAC
> admin-gating + §11-canonical audit vocab VERBATIM) and the `users` ownership router (`me` / `list` /
> self-`setDisplayName`) now replace their S4b `_placeholder`s; the client provider stack
> (`apps/yelli/src/lib/providers.tsx` — SessionProvider seeded with the server-resolved session +
> tRPC `httpBatchLink`/superjson + react-query) is mounted from the now-async `layout.tsx`. One build
> fix landed in scope: `@yelli/shared`'s `.js` import specifiers were stripped to extensionless so the
> barrel resolves under Turbopack (see lessons.md 🔴). Validation all green (typecheck/lint/test/build,
> 5/5 turbo). **W1b (device + auth UI port) is the next session and depends on this commit.**


PHASE:        **Phase 4 — Clean-Slate Scaffold-then-Wire rebuild** (driven by the swarm session plan
              on branch `swarm/rebuild`). S0 (re-baseline) + S1 (Parts 1–2 scaffold) + S2 (Part 3:
              packages/db Prisma schema + L2/L5/L6 + migration 0001) + S3 (Part 4: packages/ui +
              packages/jobs) + S4a-1 (Part 5, app FOUNDATION) + **S4a-2 (Part 5, 17 shadcn primitives
              + src/lib/tokens.ts Clay mirror + Vitest token-parity drift guard)** are complete.

              ✅ S4 IS NOW COMPLETE — all three sub-sessions shipped: S4a-1 (app foundation), S4a-2 (17
              shadcn primitives + tokens.ts mirror + Vitest token-parity test), and S4b (Auth.js v5
              Credentials/JWT + tRPC v11 skeleton: 7 routers + 5 middleware + proxy.ts + env.ts + LAN-admin
              hook + api handlers — DONE this session). The 3-way split kept every sub-session within the
              ≤12-file / ≤500-line budget (Output Equivalence). W1-W8 are now UNBLOCKED. See NEXT.

              ⚠ PLAN CORRECTION (S0): The prior STATE.md falsely claimed "Phase 3.5 COMPLETE · Parts 1–8
              already BUILT in May 2026 V31 adoption — actual remaining work is the prototype→production
              wiring." That premise was INVALID. The V32.6.1 clean-slate wipe (2026-06-07, commit `0a94f48`)
              removed `apps/` and `packages/` from the filesystem. They do NOT exist on `swarm/rebuild`
              or `main` (the old scaffold survives only in git history on `scaffold/part-3`).
              IMPLEMENTATION_MAP.md is authoritative: "Filesystem: clean-slate. No apps/, packages/."
              The Phase 3.5 execution plan (`.cline/tasks/execution-plan.md`) was written against the
              false brownfield assumption and is therefore SUPERSEDED by the swarm scaffold-then-wire plan.

FILESYSTEM REALITY (verified this session):
  PRESENT:  docs/ (PRODUCT.md + 9 governance docs), prototype/ (Phase 3.3 sim layer, 9/9 flows signed off),
            deploy/, mockup-server/, inputs.yml, inputs.schema.json, 4 env files, CREDENTIALS.md,
            .gitignore, .mcp.json, .vscode/mcp.json, .cline/ (memory + tasks), scripts/, CLAUDE.md.
            NEW (S1): package.json + pnpm-workspace.yaml (catalog) + turbo.json + tsconfig.base.json +
            eslint.config.mjs + .prettierrc/.prettierignore/.editorconfig + .nvmrc + pnpm-lock.yaml +
            node_modules/ + packages/shared/ (@yelli/shared — types + Zod + reserved-slugs + audit vocab).
            ⇒ `pnpm install|typecheck|lint` now run green. `pnpm build|test` are no-ops until a package
              defines those tasks (shared is source-exported; tests land later).
            NEW (S2): packages/db/ (@yelli/db) — Prisma schema (8 domain + 3 Auth.js models, 5 enums),
            migration 0001_init (DDL + L2 RLS), L5 writeAuditLog, L6 $allOperations tenant-guard, L2
            withTenant/setTenantContext, base PrismaClient singleton. pnpm-lock.yaml +prisma 5.22.0.
            ⇒ `prisma generate` (pnpm --filter @yelli/db db:generate) MUST precede typecheck on a fresh clone.
            NEW (S3): packages/ui/ (@yelli/ui) — `cn()` (clsx + tailwind-merge) + `yelliTailwindPreset`
            (reproduces the Phase 3.3 signed-off design tokens from prototype/tailwind.config.ts; no shadcn
            primitives yet — those land with the app in S4). packages/jobs/ (@yelli/jobs) — 6 BullMQ queue
            DEFINITIONS (QUEUE_NAMES + typed payloads + JobDataMap + createQueue factory) + ioredis
            connection factory + workers/_validate.ts (assertTenantUser / assertSystemJob / log — LOCKED
            guard convention) + 6 worker STUBS (guard-wired, body = TODO + throw NotImplemented). Root
            package.json gains `pnpm.overrides.ioredis = "5.10.1"` (LOCKED pin; verified single-instance).
            ⇒ `pnpm typecheck|lint` run green (4/4 pkgs). Worker bodies + Queue/Worker/cron bootstrap land
              in the BullMQ-wiring session. ExportJob export_jobs table from S2 was KEPT (durable row needed
              for the 1/tenant/24h rate-limit + AuditLog correlation — S2 REVIEW NOTE resolved).
            NEW (S4a-1): apps/yelli/ (@yelli/web) — Next.js 16 App Router FOUNDATION only. 12 files:
            package.json (next ^16, react 19, tailwind ^3.4.10, dev/start on :46848), next.config.ts
            (6 security headers — Permissions-Policy ALLOWS self camera+mic for WebRTC + standalone +
            transpilePackages ['@yelli/ui']), tsconfig.json (exactOptionalPropertyTypes:false per DL:176),
            eslint.config.mjs (re-exports root; direct `eslint`), postcss.config.mjs, tailwind.config.ts
            (yelliTailwindPreset + shadcn semantic colors), components.json (v3-mode for shadcn CLI),
            src/styles/tokens.css (LOCKED Clay token source, verbatim from prototype), src/app/globals.css
            (shadcn vars mapped FROM Clay tokens), src/lib/utils.ts (re-export cn), src/app/layout.tsx +
            page.tsx (placeholder). ⇒ `next build` ✓ (Next 16.2.9 Turbopack, TS pass, 3 static pages);
            typecheck/lint/prettier ✓. next-env.d.ts gitignored (auto-generated).
            NEW (S4a-2): apps/yelli/src/components/ui/ — 17 shadcn primitives (button, card, input, label,
            dialog, badge, avatar, separator, scroll-area, tabs, select, switch, sonner, skeleton, tooltip,
            dropdown-menu, form) via shadcn@2 (v3-mode components.json; NO Tailwind-v4 drift — config/globals
            byte-identical pre/post add, tailwindcss stays ^3.4.10). src/lib/tokens.ts (hand-maintained Clay
            mirror) + src/lib/tokens.parity.test.ts + vitest.config.ts (drift guard; 2/2 pass). package.json
            gains 11 @radix-ui/* + @hookform/resolvers + react-hook-form + sonner + next-themes + zod[catalog]
            + class-variance-authority + lucide-react + vitest; +"test":"vitest run". Catalog zod floored to
            ^3.25.76 (pnpm, @hookform/resolvers@5 peer). ⇒ `next build` + typecheck + lint + `pnpm test` ✓.
            NEW (S5): deploy/ + CI (Scaffold Part 6). 3-env Docker Compose set mirrored from the
            pre-clean-slate BUILT state (tag pre-clean-slate-20260607-134026): dev (postgres+pgbouncer,
            valkey, minio, pgadmin, mailhog/infra, app) · stage (same minus mailhog, Docker Hub pull +
            Traefik) · prod (same + cloudflared sidecar). start.sh + push.sh. NO coturn (q-run9-S5-02 —
            WebRTC uses external Open Relay TURN). apps/yelli/Dockerfile (3-stage standalone; fixed to
            @yelli/web + clean-slate package set: shared/db/ui/jobs) + .dockerignore. tools/ (4 governance
            validators) + 4 root `tools:*` scripts. .github/workflows/ci.yml (governance gates + turbo
            matrix, `prisma generate` wired before typecheck) + docker-publish.yml. MANIFEST.txt +
            .socraticodecontextartifacts.json (gitignored, machine-local). Root package.json gains
            `pnpm.onlyBuiltDependencies = [argon2, esbuild, @prisma/client, prisma]`.
            ⇒ `pnpm lint|test|build` green; `pnpm tools:validate-inputs|check-env|check-product-sync` all ✓.
            NEW (S4b): apps/yelli auth + tRPC backend SURFACE (skeletons). 24 files. Auth.js v5
            (src/server/auth/config.ts — Credentials provider + `session.strategy='jwt'`, NO PrismaAdapter
            per DL; jwt callback DB-validates User.securityVersion + isSuspended every call → returns null on
            mismatch [V28 guarantee]; session callback surfaces tenant identity) + lan-admin.ts (yelli_admin_
            session cookie hook). src/types/next-auth.d.ts (Session/User/JWT augmentation; role=Prisma Role).
            tRPC v11: src/server/trpc/{trpc.ts (initTRPC+superjson), context.ts (auth()→session), procedures.ts
            (public + protected = LOCKED 5-step chain), root.ts (AppRouter; `calls` merge key per DL)} +
            middleware/{auth,tenant-scope[L1+L6],audit[L5],rate-limit,error}.ts + routers/{devices,users,call
            (callRouter→`calls`),tenants,invitations,audit,brand}.ts (each one `_placeholder` NOT_IMPLEMENTED).
            src/proxy.ts (Next 16 proxy()/proxyConfig, V25, edge-safe getToken — DL) + api/{trpc/[trpc],
            auth/[...nextauth]}/route.ts. src/env.ts (Zod + SKIP_ENV_VALIDATION guard). src/lib/trpc/react.ts
            (createTRPCReact<AppRouter>). Deps +@trpc/{server,client,react-query}@11, @tanstack/react-query@5,
            next-auth@5.0.0-beta.22, superjson@2, @yelli/db + @yelli/shared. next.config transpilePackages +=
            @yelli/db,@yelli/shared. ⇒ typecheck ✓; lint ✓ (0/0); test ✓ (2/2); `next build` ✓ (proxy.ts =
            `ƒ Proxy (Middleware)`; both api routes dynamic). Real procedure bodies land in W1-W8.
  ABSENT:   packages/storage (branding-upload MIME validate.ts — LOCKED PNG/JPEG whitelist) lands later.
            Real tRPC procedure bodies + auth authorize() + LAN-admin verify + proxy redirect logic are
            SKELETONS (NOT_IMPLEMENTED placeholders / TODOs) by design — the W1-W8 wire sessions fill them.
            DEFERRED out of S5 (q-run9-S5-03): .github/workflows/release.yml (semver :vX.Y.Z + floating
            :prod) + deploy/windows/*.ps1 (5 LAN-installer scripts) — restore in a future LAN-Windows session.

LAST_DONE (W1a — Wire A: Devices + Auth surface backend + provider plumbing: apps/yelli):
  - **devices router** (apps/yelli/src/server/trpc/routers/devices.ts) — replaced the `_placeholder` with
    10 real procedures wiring the Phase 3.3 `sim.devices` SWAP BOUNDARY: list, listOnline (5-min presence),
    byId, register (Flow D; displayName optional→'' for auto-join+first_join, callRole default `receiver`
    overriding schema default `both`), setDisplayName (first_join vs rename branch — mirrors sim exactly),
    setRole (Flow C, admin-only), touch (heartbeat, no audit), archive (Flow G, admin), unarchive (admin),
    delete (admin). Cron `device.archive.batch` deliberately NOT a router procedure (packages/jobs path).
    Each mutation writes ONE L5 AuditLog row INLINE on the L6-guarded tx (`tx.auditLog.create`) — §11
    vocab VERBATIM (device.create/first_join/rename/role.assign/archive/unarchive/delete) + sim payload
    shapes (Audit View fidelity). tenantId stripped from every client row via `DEVICE_SELECT` (security.md #13).
  - **users router** (routers/users.ts) — `me` (self profile), `list` (tenant member directory for
    ScreenAdminMembers), `setDisplayName` (self-rename, ownership-bound to ctx.user.id). `USER_SELECT`
    strips passwordHash + securityVersion + tenantId (security.md #4/#13). No §11 action for user
    display-name change ⇒ no audit emitted (locked-vocab fidelity; sim's off-spec `user.unsuspend` NOT
    reproduced). Admin member mutations (suspend/promote/demote) deferred to W2 (tenancy-members).
  - **Provider plumbing** — apps/yelli/src/lib/providers.tsx (NEW, 'use client'): SessionProvider (seeded
    with server `auth()` session) + trpc.Provider over httpBatchLink({ transformer: superjson }) +
    QueryClientProvider. layout.tsx → async server component: `await auth()` → `<Providers session>`;
    route `/` now `ƒ Dynamic` (shell reads session — expected).
  - **Security hardening (automated review, 2 HIGH closed):** register binds device owner + audit actor to
    ctx.user.id (no client `userId` — closes ownership/actor spoofing); setDisplayName gates owner-or-admin
    (closes cross-member rename IDOR) + audit actor = ctx.user.id. setRole/archive/unarchive/delete were
    already admin-gated with ctx.user.id actor.
  - **In-scope build fix** — packages/shared/src/{index,entities,validators}.ts: stripped 10 `.js` import
    specifiers → extensionless (W1a is the first code to pull the @yelli/shared barrel into the Next build
    graph; Turbopack can't map `.js`→`.ts` under `moduleResolution: Bundler`; @yelli/db extensionless pattern
    is the proven fix). `tsc` still green. Logged as 🔴 lessons.md.
  - **Errors resolved (2 in-code + 1 build):** `omit` arg absent on L6-extended delegates → switched to
    reusable `select` consts; L6-extended interactive-tx not assignable to writeAuditLog's param → inlined
    `tx.auditLog.create` on the guarded tx (AuditLog guard-excluded, explicit tenantId, atomic);
    🔴 Turbopack `.js` barrel resolution (above).
  - **Validation green** — prisma generate ✓; web typecheck ✓ (0); web lint ✓ (0); web build ✓
    (ƒ Proxy Middleware; `/` + api routes dynamic; non-fatal pre-existing @prisma CJS `export *` warning);
    root turbo typecheck ✓ (5/5), lint ✓ (5/5), test ✓ (@yelli/web 2/2).
  - **CHANGELOG_AI.md appended** — full W1a entry (Rule 15). DECISIONS_LOG.md carries the pre-existing
    Brain q-W1-05 split answer-log append (swept in for hygiene). No NEW decision locked.

CHECKPOINT TYPE (W1a): full — 4 apps/yelli files (devices router, users router, providers.tsx [new],
  layout.tsx) + 3 shared build-fix files + 3 governance docs (STATE.md, CHANGELOG_AI.md, lessons.md) +
  DECISIONS_LOG.md (pre-existing Brain append) ; 1 atomic commit.
LINES_TOUCHED (W1a): ~300 authored (devices ~230, users ~50, providers ~45, layout +6, shared -10 `.js`).
  Within the ≤500-authored-line budget. Single-executor Opus-inline; no thrash.
TIER_CLASSIFICATION (W1a): Tier 1 — lightweight. Parent W1 = Tier 3 → split W1a (done) / W1b (next).
dispatch_ratio (W1a):
  sonnet_writes: 0
  opus_writes: 1
  ratio: 0.0
  target: ">= 3.0"
  status: N/A — headless swarm worker (`claude -p`); sub-agent dispatch unavailable (standing V32.1
          env-structural fallback). Ratio metric does not apply to the swarm-worker execution model.

LAST_DONE (S4b — Scaffold Part 5 remainder: Auth.js v5 + tRPC v11 skeleton: apps/yelli):
  - **Auth.js v5** (src/server/auth/config.ts) — Credentials provider + `session.strategy='jwt'`, NO
    PrismaAdapter (LOCKED). authorize() is an inert skeleton (returns null; TODO accounts-auth wire: resolve
    tenant by slug + bcrypt.compare at 12 rounds). jwt callback DB-validates User.securityVersion +
    isSuspended on every call → returns null on mismatch (V28 session-invalidation under stateless JWT);
    session callback surfaces id/role/tenantId/tenantSlug/securityVersion. lan-admin.ts = yelli_admin_session
    cookie hook skeleton (TODO argon2 verify). src/types/next-auth.d.ts augments Session/User/JWT (role=Role).
  - **tRPC v11** — trpc.ts (initTRPC + superjson transformer), context.ts (auth()→session), procedures.ts
    (publicProcedure = error+rate-limit; protectedProcedure = +auth+tenant-scope+audit = LOCKED 5-step chain),
    root.ts (AppRouter merge; call procedures under `calls` key per DL). 5 middleware: auth (requireSession),
    tenant-scope (L1 tenantId + L6 prisma.$extends(tenantGuardExtension)), audit (L5 stub), rate-limit (tier
    stub), error (envelope stub). 7 routers each with a single `_placeholder` NOT_IMPLEMENTED procedure
    (keeps protectedProcedure used under noUnusedLocals; W-series replaces).
  - **proxy.ts** (src/proxy.ts) — Next 16 proxy()/proxyConfig (V25 anti-tenant-switching, DL); edge-safe
    getToken read (no DB); matcher excludes _next/static/image/favicon/api-auth/files. Redirect logic = TODO.
  - **env.ts** — Zod schema (AUTH_SECRET/DATABASE_URL/REDIS_URL required; NEXTAUTH_URL + NEXT_PUBLIC_* opt)
    with SKIP_ENV_VALIDATION build guard. **api handlers** — fetch adapter (/api/trpc) + Auth.js (/api/auth).
    **client** — src/lib/trpc/react.ts (createTRPCReact<AppRouter>; type-only AppRouter import).
  - **Deps** — apps/yelli/package.json +@trpc/{server,client,react-query}@^11 + @tanstack/react-query@^5.62
    + next-auth@5.0.0-beta.22 + superjson@^2.2.1 + @yelli/db + @yelli/shared (workspace). next.config.ts
    transpilePackages += @yelli/db, @yelli/shared.
  - **Validation green** — prisma generate ✓; typecheck ✓ (0); lint ✓ (0/0; one stray eslint-disable removed);
    test ✓ (2/2 token-parity); `next build` ✓ (proxy = `ƒ Proxy (Middleware)`; api routes `ƒ` dynamic; 3
    static pages). Non-fatal: @trpc peer wants TS≥5.7.2 (catalog 5.5.4 — NOT bumped, passes anyway);
    next-auth beta.22 peer next^14/15 vs 16 (accepted per DL); Turbopack `export *` warning from the
    @prisma/client CJS re-export in @yelli/db (S2 — out of scope, build succeeds).
  - **CHANGELOG_AI.md appended** — full S4b entry (Rule 15). DECISIONS_LOG.md carries pre-existing Brain
    answer-log appends from the blocked W1 sessions (committed here for hygiene). No NEW decision locked.

LAST_DONE (S5 — Scaffold Part 6: deploy/ + CI):
  - **deploy/compose/** — restored the proven 3-env Compose tree from tag pre-clean-slate-20260607-134026
    (mirror, per scope). Services per q-run9-S5-02: postgres+pgbouncer (db.yml) · valkey (cache.yml) ·
    minio (storage.yml) · pgadmin (pgadmin.yml + pgadmin-servers.json) · app (app.yml); dev adds
    mailhog (infra.yml); prod adds cloudflared sidecar (cloudflared.yml). stage/prod app = Docker Hub
    pull + Traefik labels (no build:). NO self-hosted coturn (scope-sheet template error; no backing).
    start.sh (one-project multi-file; dev --build) + push.sh (manual dev→stage→prod promotion).
  - **apps/yelli/Dockerfile + .dockerignore** — restored + adapted to clean-slate reality: removed the
    api-client + storage COPY lines (those packages don't exist yet), fixed build filter `@yelli/yelli`
    → `@yelli/web`. 3-stage standalone (deps→builder→runner; `prisma generate` inside builder).
  - **tools/** — restored 4 governance validators (validate-inputs, check-env, check-product-sync,
    hydration-lint) + 4 root `tools:*` scripts. Confirmed converging signals: framework Part 7 bundles
    tools/ with deploy; in-scope ci.yml governance job depends on them; STATE.md NEXT said "tools/ lands
    in S5"; tag has them. js-yaml + ajv already in lockfile → dependency-clean. All 3 run ✓ on current config.
  - **CI** — .github/workflows/ci.yml (governance gates + turbo lint/typecheck/test/build matrix +
    pnpm audit) with `pnpm --filter @yelli/db run db:generate` wired before the matrix (plan item).
    docker-publish.yml restored (Docker Hub build & push on main → powerbyteit/yelli).
  - **Root package.json** — +4 `tools:*` scripts; +`pnpm.onlyBuiltDependencies = [argon2, esbuild,
    @prisma/client, prisma]` (plan item — exact proven value mirrored from tag). ioredis override kept.
  - **MANIFEST.txt** (fresh, current scaffold reality) + **.socraticodecontextartifacts.json** (6 artifacts;
    gitignored machine-local — exists on disk for SocratiCode, intentionally uncommitted).
  - **Validation green** — frozen install ✓; prisma generate ✓; lint ✓ (5/5); test ✓ (@yelli/web 2/2);
    build ✓ (static); tools:validate-inputs ✓; tools:check-env ✓; tools:check-product-sync ✓.
  - **DEFERRED (q-run9-S5-03):** release.yml + deploy/windows/*.ps1 — future LAN-Windows-installer session.

LAST_DONE (S4a-2 — Scaffold Part 5, shadcn primitives + token parity: apps/yelli):
  - **17 shadcn primitives** generated via `npx shadcn@2 add …` (q-S4-04: locked major against the v3-mode
    components.json) into apps/yelli/src/components/ui/ — button, card, input, label, dialog, badge, avatar,
    separator, scroll-area, tabs, select, switch, sonner, skeleton, tooltip, dropdown-menu, form. Prettier-
    normalized to the repo .prettierrc (cosmetic). q-S4-02 set.
  - **POST-ADD DRIFT GATE PASSED** — tailwind.config.ts + globals.css byte-identical pre/post add; tailwindcss
    stays ^3.4.10; no @tailwindcss/postcss or any v4 package introduced. Phase 3.3 GREEN v3 token plumbing intact.
  - **Token parity drift guard** — src/lib/tokens.ts = verbatim TS mirror of LOCKED src/styles/tokens.css :root
    (25 Clay tokens). src/lib/tokens.parity.test.ts (Vitest) parses the CSS :root and asserts exact match vs the
    TS object — any drift in either file fails (DL "Design Tokens"). 2/2 pass.
  - **Deps** — package.json +11 @radix-ui/* + @hookform/resolvers + react-hook-form + sonner + next-themes +
    zod[catalog] (CLI) + class-variance-authority ^0.7.1 + lucide-react ^1.17.0 (added manually — primitives
    import them; S4a-1's empty init never installed them) + vitest (dev). Catalog zod ^3.23.8 → ^3.25.76 (pnpm
    floor raise, @hookform/resolvers@5 peer zod≥3.24; resolved version was already 3.25.76; @yelli/shared re-
    typechecked clean; --frozen-lockfile consistent).
  - **Validation green** — `next build` ✓ (Next 16.2.9 Turbopack, 3 static pages); typecheck ✓ (0); lint ✓ (0);
    root `pnpm test` (turbo) ✓ (@yelli/web 2/2, siblings no-op); prettier --check ✓ on all 17 primitives + 3
    authored files + package.json.
  - **CHANGELOG_AI.md appended** — full S4a-2 entry (Rule 15; CLI decision + drift gate + catalog bump documented).
  - **Remainder:** S4b (auth + tRPC + proxy.ts + env.ts) is the final S4 sub-session — dispatch as a separate
    dependent worker. See NEXT.

LAST_DONE (S4a-1 — Scaffold Part 5, app FOUNDATION: apps/yelli Next.js 16 shell + design tokens):
  - **apps/yelli (@yelli/web)** — Next.js 16 App Router foundation, 12 files, NO primitives/auth/tRPC.
    Stack locks honored: Next 16.2.9 + React 19; Tailwind v3 (^3.4.10, NOT v4); ESLint 9 flat (direct
    `eslint`, Next 16 removed `next lint`); tsconfig exactOptionalPropertyTypes:false (DL:176, Radix v1);
    transpilePackages ['@yelli/ui']; output 'standalone' (Docker). next.config Permissions-Policy ALLOWS
    self camera+microphone (WebRTC calling app — blocking breaks getUserMedia).
  - **LOCKED design-token plumbing reproduced (Output Equivalence)** — src/styles/tokens.css = the single
    Clay token source (DL "Design Tokens"), carried forward VERBATIM from the Phase 3.3 signed-off
    prototype. globals.css maps shadcn --background/--foreground/--primary/--border/--ring/etc FROM those
    Clay vars. tailwind.config consumes @yelli/ui `yelliTailwindPreset` (S3) + adds shadcn semantic colors.
  - **Validation green** — `next build` ✓ (Turbopack, TS pass, 3 static pages); typecheck ✓ (0 errors);
    lint ✓ (0 problems); prettier --check ✓ on authored app files. next-env.d.ts gitignored.
  - **CHANGELOG_AI.md appended** — full S4a-1 entry (Rule 15; remainder + shadcn-v3 decision documented).
  - **Why partial:** S4 is AT_RISK and >2× the per-session budget; per pre-flight rule 3 / memory-governance
    §1 this session ships only the within-budget foundation. Remainder escalated (status=blocked) →
    dispatch S4a-2 (primitives) then S4b (auth+tRPC) as separate workers. See NEXT + BLOCKERS.

LAST_DONE (S3 — Scaffold Part 4: packages/ui + packages/jobs):
  - **packages/ui (@yelli/ui)** — shared UI utility layer (NO shadcn primitives — those land with the app S4):
      • src/lib/cn.ts — canonical shadcn `cn()` (clsx + tailwind-merge).
      • src/tailwind-preset.ts — `yelliTailwindPreset` (`satisfies Partial<Config>`) reproducing the Phase 3.3
        signed-off design tokens VERBATIM from prototype/tailwind.config.ts (colors→CSS vars, borderRadius,
        boxShadow, transition duration/timing). No `content` (app owns globs). Output Equivalence: reproduced,
        keeps design-review GREEN. Deps: clsx + tailwind-merge + tailwindcss ^3.4.10 (dev; v3 line, not v4).
  - **packages/jobs (@yelli/jobs)** — BullMQ job DEFINITIONS layer (definitions + stubs; no running Workers):
      • src/queues.ts — 6 queue DEFINITIONS (QUEUE_NAMES verbatim from inputs.yml: device-archive, tenant-export,
        soft-delete-cron, backup, email, logo-image) + typed payloads (BaseJobData + 6 specializations) + static
        JobDataMap + `createQueue<N>(name, connection, opts)` factory (connection INJECTED — no eager Redis).
      • src/connection.ts — `createRedisConnection()` (ioredis; defaults BullMQ `maxRetriesPerRequest: null`).
      • src/workers/_validate.ts — LOCKED guard convention: `assertTenantUser` (top of every processor),
        `assertSystemJob` (LOCKED backup exception: '_pwbt'/'system'), shared structured-JSON `log()`.
      • 6 worker STUBS — guard-wired + log + `throw NotImplemented` + TODO(wiring session) per LOCKED behavior.
      • Deps: bullmq ^5.77.7 + ioredis 5.10.1 (EXACT — LOCKED pin). Root package.json + `pnpm.overrides.ioredis`.
  - **ExportJob REVIEW NOTE (from S2) resolved** — KEPT the export_jobs table (durable row required for the
    1/tenant/24h rate-limit + tenant.export.* AuditLog correlation; BullMQ state is ephemeral). Not dropped.
  - **Validation green** — typecheck ✓ (4/4, 0 errors); lint ✓ (4/4, 0 problems); build/test no-op exit 0;
    prettier --check ✓ on all S3 files; ioredis verified single-instance 5.10.1. 1 self-caught JSDoc `*/` bug fixed.
  - **CHANGELOG_AI.md appended** — full S3 entry (Rule 15 attribution; ExportJob resolution + deviations documented).

LAST_DONE (S2 — Scaffold Part 3: packages/db — Prisma schema + L2/L5/L6 + migration 0001):
  - **packages/db (@yelli/db)** — reproduced the LOCKED Phase-4-Part-3 contract from the wiped scaffold
    (git `96920d0`), adapted to S1's `@yelli/shared` barrel:
      • prisma/schema.prisma — 8 domain models (Tenant, User, Device, Invitation, AuditLog, CallSession,
        WebPushSubscription, ExportJob) + 3 Auth.js (Account, Session, VerificationToken) + 5 enums
        (Role, CallRole, AuditTargetType, EndReason, ExportJobStatus). 1:1 with @yelli/shared entities.ts.
      • prisma/migrations/0001_init — migration.sql (full DDL + L2 RLS ENABLE + tenant_isolation policies)
        + down.sql + migration_lock.toml.
      • src/audit.ts (L5 writeAuditLog), src/rls.ts (L2 withTenant/setTenantContext), src/middleware/
        tenant-guard.ts (L6 $allOperations extension; excludes Tenant/AuditLog/Account/Session/
        VerificationToken), src/index.ts (base unguarded PrismaClient singleton).
  - **Scope additions / rule-backed deviations** (Output Equivalence preserved, all documented in CHANGELOG):
      • +User.securityVersion Int @default(0) (LOCKED decision + security.md §AUTH #6 — folded into 0001).
      • CallSession.endedAt + endReason → nullable to match S1 entities.ts (LOCKED "Part-2 TS is source of
        truth; fix the schema").
      • +ExportJob model/enum/table (the wiped scaffold never materialized it; added to satisfy the explicit
        "8 domain models" scope + entities.ts. REVIEW NOTE: if export state is BullMQ/Valkey-only, S3 may drop
        the table — additive + isolated.).
      • entities.ts synced (2 edits: +User.securityVersion, AuditLog.targetId → string|null).
  - **Validation green** — typecheck ✓ (2/2 pkgs, 0 errors); lint ✓ (2/2, 0 problems); build/test no-op exit 0;
    prisma validate ✓; prisma generate ✓ (client v5.22.0); prettier --check ✓ on all S2 code files.
    (Repo-wide format:check fails on 44 PRE-EXISTING files — docs/, inputs.yml, README.md — untouched by S2.)
  - **CHANGELOG_AI.md appended** — full S2 entry (Rule 15 attribution; deviations + deferrals documented).
  - **Deferred (not in S2 literal scope):** prisma/seed.ts (needs CREDENTIALS + live DB + argon2 native build).

LAST_DONE (S1 — Scaffold Parts 1–2: root config + packages/shared):
  - **Root monorepo config** — package.json (pnpm@10.33.2, turbo-delegating scripts), pnpm-workspace.yaml
    (apps/* + packages/* + pnpm `catalog:` — phantom-ui 0.10.1 EXACT [Loading Library Lock], zod, typescript),
    turbo.json (turbo 2.x `tasks`), tsconfig.base.json (strict + noUncheckedIndexedAccess +
    exactOptionalPropertyTypes — Rule 12), eslint.config.mjs (ESLint 9 flat; no-explicit-any: error),
    .prettierrc/.prettierignore/.editorconfig, .nvmrc=22.
  - **packages/shared (@yelli/shared)** — source-exported type + validation contract for all downstream sessions:
      • enums.ts (Edition, CallRole, UserRole, CallEndReason, ExportJobStatus, AuditTargetType — tuple+union).
      • audit.ts — AUDIT_ACTIONS (§11-canonical, 29 actions) verbatim from docs/PROTOTYPE.md §3 (the signed-off
        lock; NOT PRODUCT.md's illustrative line-204 enum). HARD CONSTRAINT inherited by S2 + W4 + W1/W2/W3.
      • entities.ts — 8 domain interfaces (Date timestamps = Prisma runtime shape).
      • config/reserved-slugs.ts — RESERVED_SLUGS (18, verbatim) + isReservedSlug().
      • validators.ts — Zod (tenantSlug 3–30/regex/no-`--`/reserved → generic "slug unavailable" per V25;
        display-name caps 40/24/24; email; fingerprint; UUID idempotency key; enum schemas).
  - **Validation green** — pnpm install ✓; typecheck ✓ (0 errors); lint ✓ (0 problems); build/test no-op exit 0;
    prettier --check ✓. 465 lines total (within the 500-line dispatch budget). 1 self-caught import typo fixed inline.
  - **CHANGELOG_AI.md appended** — full S1 entry (Rule 15 attribution; audit-vocabulary divergence resolved).

LAST_DONE (S0 — Re-baseline + inputs.yml regen):
  - **docs/STATE.md rewritten** (this file) — reconciled to the real clean-slate state; corrected the
    false Phase 3.5 brownfield-complete claim per authoritative IMPLEMENTATION_MAP.md.
  - **inputs.yml regenerated** from docs/PRODUCT.md — drift corrected and validated against inputs.schema.json:
      • entities: replaced fabricated `BrandAsset / CallSnapshot / SessionInvalidation` (not in PRODUCT.md)
        with the 8 PRODUCT.md domain models — Tenant, User, Device, Invitation, AuditLog, CallSession,
        WebPushSubscription, ExportJob (Auth.js owns Session/VerificationToken/Account separately).
      • modules: 6 → 8 faithful (calling, directory, device-identity, accounts-auth, tenancy-members,
        branding, admin-console, pwa).
      • jobs.queues: 2 → 6 (device-archive, tenant-export, soft-delete-cron, backup, email, logo-image) —
        grounded in DECISIONS_LOG.md "LOCKED: Jobs + Queues" (Step 5) + "LOCKED: Database Backup" (Step 7).
      • tenancy.notes: clarified hybrid LAN+Cloud one-codebase model.
      • security.audit_events: aligned to the PRODUCT.md AuditLog action prefixes
        (member.* / device.* / tenant.* / auth.* / superadmin.* / lan.* / pwa.*).
      • inputs.yml VALID against inputs.schema.json (jsonschema check passed in sandbox).
  - **Phase 0 skeleton verified intact** — governance docs, .gitignore (comprehensive), and MCP wiring
    (.mcp.json + .vscode/mcp.json: socraticode + context7 + shadcn) all present and correct. No repair needed.
  - **CHANGELOG_AI.md appended** — clean-slate re-baseline + plan-correction entry (Rule 15 attribution).

NEXT:
  1. ✅ S4b (auth + tRPC skeleton) — DONE this session. Auth.js v5 Credentials/JWT (no PrismaAdapter, DL);
     tRPC v11 + 7 routers (`calls` merge key, DL) + 5 middleware (LOCKED 5-step chain) + proxy.ts (V25, DL)
     + env.ts + LAN-admin hook + api handlers. typecheck/lint/test/build all green; proxy recognized by
     Next 16 as `ƒ Proxy (Middleware)`. **S4 is now COMPLETE.**
  2. ✅ S5 (deploy + CI) — DONE. Scaffold Parts 1-8 (minus packages/storage) are on disk.
  3. ✅ **W1a (Wire A backend + providers)** — DONE this session. Real `devices` (10 procs) + `users`
     (3 ownership procs) routers replace their `_placeholder`s; provider stack mounted from layout.
     Validation all green. See the W1a LAST_DONE block above.
  4. **W1b (Wire A UI port)** — NEXT. Dispatch the W1b worker: port the validated prototype device +
     auth UI onto the W1a tRPC hooks + mounted providers — ScreenAdminLogin (Flow E + Phase 3.3 deferral
     #1 re-render fix via the real session), OverlayNamePicker (Flow D), ScreenAdminMembers devices-list
     (Flow G), OverlayCallRoleAssign (Flow C), TenantTopBar/Pill/BottomNav + app-shell routes. Split
     W1b-1/W1b-2 only if pre-flight measures >12 files / >500L. W1b depends on this W1a commit.
  5. ✅ **W3 (Wire C — Tenancy + Members + Invitations + V25 proxy)** — DONE this session. tenants +
     invitations routers LIVE; proxy V25 subdomain cross-check filled; invitation email queue trigger +
     W2a session-kill call-sites landed. See the W3 block at the top.
  6. ✅ **W4 (Wire D — Audit + Branding)** — DONE this session. `audit` + `brand` routers LIVE; L5
     audit-middleware recorder live; `@yelli/storage` (PNG/JPEG magic-byte whitelist + 2 MiB) + `logo-image`
     queue producer landed. ALL 7 routers now carry real bodies. See the W4 block at the top.
  7. ✅ **W5a (BullMQ device-archive worker)** — DONE this session. The device-archive STUB now carries the
     real daily-03:00-UTC cron processor (90-day offline sweep + `device.archive.batch` audit). See the W5a
     block at the top.
  8. **W5-runtime / W5b-e** — NEXT (Brain-approved W5 split, dispatch IN ORDER per q-W5-03): W5-runtime
     (BullMQ `Worker` + repeatable-cron bootstrap + entrypoint; processors need a host) → W5b tenant-export
     (+s3-request-presigner + `@yelli/storage` get/put/presign; 24h signed URL) → W5c email (+nodemailer SMTP,
     NOT Resend) → W5d logo-image resize (+sharp) → W5e backup (pg_dump + `BACKUP_S3_*`). **soft-delete-cron**
     is deferred behind a SCHEMA session (q-W5-01: add `User.removedAt` + wire `removeMember`, then the sweep).
  9. **W2b-2 / W1b / UI-PWA-validation** — remaining wire sessions (client `useSignaling` hook, calling/WebRTC
     UI port, device+auth UI port, PWA, pre-production validation). Each keeps the §11 audit vocab VERBATIM.
     invitation.accept + Auth.js authorize() land with accounts-auth; LAN-admin argon2 verify lands with W6.
     Final = 9 §3 flows end-to-end + Phase 5 re-run + Visual QA.
  Output Equivalence: the scaffold-then-wire rebuild must reproduce the proven decisions in DECISIONS_LOG.md
  and the 9 signed-off §3 flows in PROTOTYPE.md — nothing is re-decided, only re-built.

BLOCKERS:     None. W5a (device-archive worker) is COMPLETE and committed; the remaining W5 sub-sessions
              (W5-runtime → W5b–e) + the deferred soft-delete-cron schema session are Brain-APPROVED future
              runs (q-W5-01/03), NOT blockers. W3 (tenancy/members/invitations + V25 proxy) is COMPLETE and committed. Open wire deps:
              W1b (Wire A UI port — depends on W1a hooks/providers) and W2b-2 (client `useSignaling` hook —
              depends on W2b-1). Remaining skeleton TODOs are the later W-series' work, not blockers: Auth.js
              authorize() + invitation.accept (accounts-auth wire), LAN-admin argon2 verify (W6),
              tenant.export.* + removeMember (BullMQ-wiring / schema decision — see the W3 deferrals + the
              non-blocking question), the logo-image resize CONSUMER worker (BullMQ-wiring; W4 fires the
              producer only), and the 30s Valkey freshness cache. (audit + brand routers are now DONE — W4.)

GIT_BRANCH:   swarm/rebuild. W5a adds 1 atomic commit (device-archive.ts worker body + packages/jobs/
              package.json [+@yelli/db workspace dep] + pnpm-lock.yaml + 3 governance docs [STATE.md,
              CHANGELOG_AI.md, DECISIONS_LOG.md q-W5 answer-log swept in for hygiene]). The human reviews
              and pushes — the worker never pushes.
              Recent commits:
  - (this commit) feat(phase-4-W5): BullMQ workers (implement the 6 queues) — W5a device-archive slice
  - `b8c58d9` feat(phase-4-W4): Wire D — Audit + Branding
  - `9c8d356` feat(phase-4-W3): Wire C — Tenancy + Members + Invitations
  - `8a941bc` feat(phase-4-W2b): Wire B2 — WebSocket signaling server (Next 16 standalone)
  - `c82c16c` feat(phase-4-W2a): Wire B1 — Calling data+realtime (calls router, CallSession, Valkey bus)
  - `87c8fca` feat(phase-4-W1): Wire A — Devices + Auth surface
  - `b06e958` feat(phase-4-S4b): Scaffold Part 5b — Auth.js v5 + tRPC router skeletons (deferred S4 tail)
  - `04215f7` feat(phase-4-S5): Scaffold Part 6 — deploy/ + CI

PORTS:        Phase 4 app dev port = 46848 (inputs.yml ports.dev.app). prototype/ dev server on 4838
              (Phase 3.3 validated baseline, retained for Phase 4 spot-checks).

MODELS:
  planning:   claude-code (Opus — architect)
  execution:  claude-sonnet-4-6 via Claude Code
  governance: gemini-2.5-flash-lite

CHECKPOINT TYPE (S4b): full — apps/yelli auth + tRPC skeleton (Scaffold Part 5 remainder). 24 new src files
  + apps/yelli/package.json (deps) + apps/yelli/next.config.ts (transpilePackages) + pnpm-lock.yaml + 2
  governance docs (STATE.md, CHANGELOG_AI.md) + docs/DECISIONS_LOG.md (pre-existing Brain answer-log appends
  swept in for hygiene) ; 1 atomic commit.
LINES_TOUCHED (S4b): ~470 authored lines across 24 small skeleton files (7 routers ~10L ea, 5 middleware
  ~12L ea, trpc/context/procedures/root ~20L ea, auth config ~90L, lan-admin ~25L, next-auth.d.ts ~38L,
  proxy ~38L, env ~40L, 2 route handlers ~10L ea, client react ~12L) + package.json/next.config edits.
  Within the ≤500-authored-line budget. Single-executor Opus-inline; no thrash.
FILES_TOUCHED (S4b):
  - apps/yelli/src/server/trpc/: trpc.ts, context.ts, procedures.ts, root.ts; middleware/{auth,tenant-scope,
    audit,rate-limit,error}.ts; routers/{devices,users,call,tenants,invitations,audit,brand}.ts
  - apps/yelli/src/server/auth/{config,lan-admin}.ts; apps/yelli/src/types/next-auth.d.ts
  - apps/yelli/src/app/api/trpc/[trpc]/route.ts; apps/yelli/src/app/api/auth/[...nextauth]/route.ts
  - apps/yelli/src/proxy.ts; apps/yelli/src/env.ts; apps/yelli/src/lib/trpc/react.ts
  - apps/yelli/package.json, apps/yelli/next.config.ts, pnpm-lock.yaml
  - docs/STATE.md (this file), docs/CHANGELOG_AI.md (appended), docs/DECISIONS_LOG.md (pre-existing appends)
TIER_CLASSIFICATION (S4b): Tier 1 — lightweight (~470 authored lines of declarative skeleton wiring;
  executed headless Opus-inline per the standing V32.1 fallback; typecheck + lint + test + `next build` all
  green, no thrash). Parent S4 = Tier 3 (heavy) → split S4a-1 / S4a-2 / S4b, all DONE. S4 COMPLETE.
dispatch_ratio (S4b):
  sonnet_writes: 0
  opus_writes: 1
  ratio: 0.0
  target: ">= 3.0"
  status: N/A — single-executor headless swarm worker (`claude -p`); sub-agent dispatch is not available in
          this harness (standing V32.1 env-structural fallback). The ratio metric does not apply to the
          swarm-worker execution model; not a discretionary R1 bypass.

CHECKPOINT TYPE (S5): full — deploy/ + CI (Scaffold Part 6). 22 deploy/compose files + start.sh + push.sh
  (restored mirror) + 4 tools/*.mjs (restored) + ci.yml (edited) + docker-publish.yml (restored) +
  apps/yelli/Dockerfile (edited) + .dockerignore (restored) + root package.json (edited) + MANIFEST.txt
  (new) + .socraticodecontextartifacts.json (new, gitignored) + 3 governance docs (STATE.md,
  CHANGELOG_AI.md, DECISIONS_LOG.md S5 answer-log) ; 1 atomic commit.
LINES_TOUCHED (S5): ~30 hand-authored lines (Dockerfile 2 edits, ci.yml +2 lines, package.json +6) +
  MANIFEST.txt (~80) + .socraticodecontextartifacts.json (~38). Compose tree + tools/ + push/start.sh +
  docker-publish.yml are restored verbatim from tag (mirror, not counted as authored). Well within budget.
FILES_TOUCHED (S5): deploy/compose/{dev,stage,prod}/* (22), deploy/compose/start.sh, deploy/compose/push.sh,
  apps/yelli/Dockerfile, apps/yelli/.dockerignore, tools/{validate-inputs,check-env,check-product-sync,
  hydration-lint}.mjs, .github/workflows/ci.yml, .github/workflows/docker-publish.yml, package.json,
  MANIFEST.txt, .socraticodecontextartifacts.json (gitignored), docs/STATE.md, docs/CHANGELOG_AI.md,
  docs/DECISIONS_LOG.md.
TIER_CLASSIFICATION (S5): Tier 1 — lightweight (mostly faithful restore + small adaptations; executed
  headless Opus-inline per the standing V32.1 fallback; lint/test/build + 3 governance validators all
  green, no thrash).
dispatch_ratio (S5):
  sonnet_writes: 0
  opus_writes: 1
  ratio: 0.0
  target: ">= 3.0"
  status: N/A — single-executor headless swarm worker (`claude -p`); sub-agent dispatch is not available
          in this harness. Standing V32.1 env-structural fallback (documented in EXECUTION NOTE). Not a
          discretionary R1 bypass; the ratio metric does not apply to the swarm-worker execution model.

CHECKPOINT TYPE (S4a-2): full — apps/yelli: 17 shadcn primitives (CLI-generated) + 3 authored files
  (tokens.ts, tokens.parity.test.ts, vitest.config.ts) + package.json + pnpm-lock.yaml + pnpm-workspace.yaml
  + 3 governance docs (STATE.md, CHANGELOG_AI.md, DECISIONS_LOG.md answer-log) ; 1 atomic commit.
LINES_TOUCHED (S4a-2): ~95 authored lines (tokens.ts ~55 + parity test ~45 + vitest.config ~13 + package.json
  +2). 17 primitives are CLI-generated (not counted against the hand-authored line budget per the Phase 4
  Execution Plan note). Well within the ≤12-authored-file / ≤500-authored-line budget.
FILES_TOUCHED (S4a-2):
  - apps/yelli/src/components/ui/: button, card, input, label, dialog, badge, avatar, separator, scroll-area,
    tabs, select, switch, sonner, skeleton, tooltip, dropdown-menu, form .tsx (17, generated + prettier-normalized)
  - apps/yelli/src/lib/tokens.ts, apps/yelli/src/lib/tokens.parity.test.ts, apps/yelli/vitest.config.ts
  - apps/yelli/package.json (deps + test script), pnpm-lock.yaml, pnpm-workspace.yaml (catalog zod floor bump)
  - docs/STATE.md (this file), docs/CHANGELOG_AI.md (appended), docs/DECISIONS_LOG.md (Brain q-S4-03/04 answer-log)
TIER_CLASSIFICATION (S4a-2): Tier 1 — lightweight (~95 authored lines + CLI-generated primitives; executed
  headless Opus-inline per the standing V32.1 fallback; next build + typecheck + lint + vitest all green,
  no thrash). Parent S4 = Tier 3 (heavy) → split into S4a-1 (done) / S4a-2 (done) / S4b (remaining).

CHECKPOINT TYPE (S4a-1): full — apps/yelli: 12 foundation files created + .gitignore (+next-env.d.ts) +
  pnpm-lock.yaml + 3 governance docs (STATE.md, CHANGELOG_AI.md, DECISIONS_LOG.md answer-log) ; 1 atomic commit.
LINES_TOUCHED (S4a-1): ~430 lines authored (7 config files ~210 + tokens.css ~45 + globals.css ~65 +
  layout/page/utils ~30 + comments). Within the ≤500-line / ≤12-file budget. shadcn primitives + auth +
  tRPC deliberately NOT in this session (would push to ~30+ files / >1000L — over budget).
FILES_TOUCHED (S4a-1):
  - apps/yelli: package.json, next.config.ts, tsconfig.json, eslint.config.mjs, postcss.config.mjs,
    tailwind.config.ts, components.json, src/styles/tokens.css, src/app/globals.css, src/app/layout.tsx,
    src/app/page.tsx, src/lib/utils.ts
  - .gitignore (+next-env.d.ts), pnpm-lock.yaml (+next/react/react-dom/tailwind/postcss/autoprefixer)
  - docs/STATE.md (this file), docs/CHANGELOG_AI.md (appended), docs/DECISIONS_LOG.md (Brain q-S4 answer log)
TIER_CLASSIFICATION (S4a-1): Tier 1 — lightweight (~430 authored lines; mostly config + verbatim token
  carry-forward; executed headless Opus-inline per the standing V32.1 fallback; `next build` + typecheck +
  lint + prettier all green, no thrash). Parent S4 = Tier 3 (heavy) → split into S4a-1 (done) / S4a-2 / S4b.

CHECKPOINT TYPE: full (S3 scaffold session — packages/ui: 6 files + packages/jobs: 13 files created + root
  package.json modified + 2 governance docs updated; 1 atomic commit)
LINES_TOUCHED (S3): ~430 lines of new scaffold (ui src ~95 + 3 config ~30; jobs src ~270 + 3 config ~35) +
  root package.json (+5: ioredis override) + pnpm-lock.yaml + CHANGELOG_AI.md + this STATE.md.
FILES_TOUCHED (S3):
  - packages/ui: package.json, tsconfig.json, eslint.config.mjs, src/index.ts, src/lib/cn.ts, src/tailwind-preset.ts
  - packages/jobs: package.json, tsconfig.json, eslint.config.mjs, src/index.ts, src/connection.ts, src/queues.ts,
    src/workers/_validate.ts, src/workers/device-archive.ts, src/workers/tenant-export.ts,
    src/workers/soft-delete-cron.ts, src/workers/backup.ts, src/workers/email.ts, src/workers/logo-image.ts
  - package.json (root — modified: +pnpm.overrides.ioredis 5.10.1)
  - pnpm-lock.yaml (modified — +bullmq/ioredis/clsx/tailwind-merge/tailwindcss)
  - docs/STATE.md (this file), docs/CHANGELOG_AI.md (appended)
TIER_CLASSIFICATION: Tier 1 — lightweight (~430 lines, under the 500-line Sonnet-dispatch gate; mostly
  declarative definitions + small stubs; executed headless Opus-inline per the standing V32.1 fallback;
  validated clean with one self-caught JSDoc `*/` parse bug, no thrash).

EXECUTION NOTE (Rule 15 / V32.1): This swarm worker runs headless (`claude -p`) as a single executor agent
  and performs its own file writes inline — sub-agent dispatch is not used in this harness. This is the
  standing V32.1 Opus-inline fallback pattern (documented; env-structural, not a discretionary R1 bypass).

KNOWN STANDING ISSUES (carried into the scaffold/wire sessions):
  - V32.1 dispatch-layer regression (env-structural). Standing fallback: inline writes by the worker.
  - 4 Phase 3.3 deferrals carry into the wire sessions: (1) Flow E LAN-admin-login re-render no-op (W1);
    (2-4) overlay heading semantics + next/font/google migration + hex→CSS-var wiring (W7).
  - Old `.cline/tasks/execution-plan.md` (136L) reflects the superseded brownfield premise — retained
    for reference only; the swarm S0→S5→W1–W8 plan is authoritative for Phase 4.
