# Yelli

> **Spec status — V31 framework lock complete (2026-05-31).** All 9 planning steps closed. Phase 2 (architecture spec) may begin.
> **Phase 3.3 design gate — CLOSED (2026-06-17).** Owner approved ScreenTenantSettings (`/admin/settings`) design sign-off. Phase-4-complete tag authorised.

## Key Decisions Summary (Step 9 closeout — read this first)

- **Editions:** dual LAN (self-hosted, single implicit tenant) + Cloud (managed multi-tenant on `*.yelli-basic.powerbyte.app`); one codebase; feature parity is non-negotiable (`@dual-mode-exception` required for any exception)
- **Calling model:** 1-on-1 WebRTC peer-to-peer media; signaling-only server; default role = receiver; CALL action hidden + server-rejected for non-caller roles
- **Roles:** anonymous device (LAN default) / member / admin; peer admin promote/demote; last-admin guard; LAN anonymous admin gated by Argon2id passphrase + `yelli_admin_session` HttpOnly cookie
- **Tenancy (Cloud):** subdomain routing `<slug>.yelli-basic.powerbyte.app`; slug `^[a-z][a-z0-9-]*[a-z0-9]$`, immutable, 18 reserved names; tenant-scoped via `tenantId` on every entity; V25 cross-check `session.tenantId === resolved.slug.tenantId`
- **Deployment:** Komodo + Docker Compose; semver `:vX.Y.Z` immutable + floating `:prod` pointer; rollback = re-tag, no rebuild; daily 02:00 UTC `pg_dump` → S3 30d / Glacier IR 7d
- **Async infra:** WebSocket + Valkey pub/sub for role broadcast + session-kill (30s SLO); BullMQ for tenant export + device-archive cron (daily 03:00 UTC, 90-day offline threshold)
- **Mobile:** PWA only (no native); install banner on 2nd visit, 30d snooze; Web Push tap-to-open; cached shell + UUIDv7 replay queue (24h Valkey dedup); **mobile-first global contract** — every page (including admin) designed from 375px baseline up, never desktop-down (locked Step 10)
- **Design system:** Clay aesthetic; single `tokens.css` source for shadcn + Tailwind; Vitest token-parity test catches drift
- **Security:** 5-step tRPC middleware chain (session → freshness → tenant-match → role → procedure guard); Super-Admin `/_pwbt/` runs isolated chain + dedicated Prisma client per V25
- **Operations (Step 9):** GlitchTip + Docker JSON logs + Komodo log viewer; UptimeRobot 5-min probes → email + Telegram; static status page at `status.powerbyte.app`; k6 perf harness run on-demand pre-`:prod` (regression block at p95 signaling >150ms or p95 call-setup >3s)
- **Out of scope for MVP:** group calls, recording, screen share, Xendit self-serve billing, multi-region failover, hosted statuspage, central log aggregator, APM

For step-by-step lock decisions, see `DECISIONS_LOG guidance for Claude Code (Brownfield Adoption)` at the end of this document.

## App Identity
Name:           Yelli
Tagline:        Video calling for your network — your LAN or our cloud, your call.
Industry:       Communications Platform — managed cloud + self-host
Primary users:  Two human peers, in or across networks. Tenant boundary applies in Cloud mode; absent in LAN mode.
Owner:          Powerbyte I.T. Solutions

## Problem Statement
Most teams default to Zoom or Meet for short, frequent video calls between two people in the same building (reception ↔ stockroom, doctor ↔ front desk, manager ↔ floor staff) — but cloud-routed calls are slow, expensive, and unnecessary for traffic that never needs to leave the network. Self-host alternatives like Jitsi are heavy and built for group meetings, not 1-on-1 intercom. Yelli ships as two editions sharing one codebase: Yelli LAN (self-hosted, no internet needed after setup) and Yelli Cloud (managed multi-tenant hosting, cross-network calling) — both 1-on-1, both white-labelable, both keeping media peer-to-peer via WebRTC.

## Core User Flows

### Calling (both editions)

1. **A Member places a 1-on-1 call.** Open app → directory shows online peers → tap peer → press CALL → callee accepts → WebRTC peer-to-peer media streams. *Errors:* peer offline before accept → "Peer unavailable"; peer busy → server rejects with `busy`; mic/cam permission denied → abort with help link; ICE fails (NAT/firewall) → "Connection failed — try again on the same network"; WebSocket drops mid-handshake → retry once then end.

2. **A Member receives an incoming call.** Modal shows caller's display name + Accept/Reject → ACCEPT → media streams. *Errors/edges:* REJECT → caller sees "Declined"; no answer in 30s → modal auto-dismisses, caller sees "No answer"; receiver role is `receiver-only` and already in a call → auto-reject `busy`; mic/cam denied on accept → auto-reject with reason.

3. **Either side ends or cancels a call.** In-call → END button → both sides cleanup + return to idle. *Errors/edges:* peer disconnects mid-call → "Peer disconnected" + cleanup; ICE drops → "Connection lost" + cleanup; caller cancels while ringing → callee modal auto-dismisses.

4. **A LAN Admin assigns a device's call role.** Admin → Devices → row → set role (Both / Caller / Receiver) → save → server persists assignment in the device registry → role-update event published on the existing WebSocket signaling channel and fanned out across signaling instances via Valkey pub/sub → all online sessions for that device receive it within 5s → caller-side UIs across the LAN re-render so the CALL button hides for any peer whose role is `receiver` (and likewise for `caller`-only peers on the receiver side). *Defaults:* every newly-joined device starts at `receiver` until an admin promotes it. *Enforcement:* defense-in-depth — UI hides forbidden CALL buttons AND the server rejects any `call.invite` whose target role forbids the action (returns `forbidden_by_role`). *Edge:* role change during an active call does not disrupt it; the new role takes effect after the call ends. *Transport edge:* if Valkey is unavailable (LAN anonymous mode without account features), broadcast falls back to in-process WebSocket fan-out — acceptable because LAN anonymous deployments run a single signaling instance by design.

5. **A Member toggles mute or camera mid-call.** Tap mute icon → audio track disabled → icon updates. Same for camera. *Edge:* peer sees a "muted" indicator on top overlay; cam-off shows placeholder avatar with peer's display name initial.

### Shared identity + admin (both editions)

6. **A Member sets their per-device display name on first launch.** Modal prompts "What should others see when you call?" → user types → saved to localStorage → used in directory + incoming-call modal. Editable later from Settings drawer. *Errors:* empty submit → re-prompt; name >24 chars → truncate; duplicate name on same network → server appends short device-id suffix in display (e.g. `Alex (A1B)`).

7. **An Admin configures branding.** Settings → Branding → upload logo (PNG/JPG/SVG, ≤2 MB) + type header text (≤40 chars) → Save → all live sessions refresh branding within 30s. *Errors:* oversized file → reject with limit; invalid type → reject; corrupt image → "Couldn't process this image"; header text overflow → truncate + warn.

8. **A Member browses the directory and calls from it.** Idle screen → "Online" section lists peers with display names → tap a row → CALL → flow 1 starts. *Edges:* empty directory → "No peers online — open Yelli on another device"; peer goes offline while list is open → row removed in realtime.

9. **A LAN Server Admin runs first-time setup.** Admin starts server → first browser visit launches setup wizard → choose Anonymous mode (no accounts, current LAN behaviour) OR Account mode (sets up first admin + invitable members) → enter org name + upload logo → save. *Edges:* wizard interrupted → resumes on next visit; switching anonymous→account later via Settings → existing display-name history wiped with confirmation.

### Accounts + tenancy (Cloud, plus LAN account mode where noted)

10. **An Org Owner signs up for Yelli Cloud.** Visit landing → "Start free trial" → enter org name + admin email + password → verification email sent → click link → org provisioned → land on admin dashboard. *Errors:* email already used (different tenant) → generic anti-enumeration response per V25; weak password → Auth.js v5 rejects with policy hint; verification link expired (24h) → resend flow; org-name collision → auto-suffix.

11. **A User logs in** *(Cloud, or LAN in account mode).* Enter email + password → session created → land on directory. *Errors:* wrong credentials → generic "Couldn't sign in"; account suspended → "Account is inactive — contact your admin"; tenant suspended (Cloud) → "Service unavailable — admin action required"; rate limit (10/min) → "Too many attempts — wait 60s".

12. **A Tenant Admin invites a member by email.** Admin → Members → Invite → enter email → invitation sent → invitee clicks → sets password → joins org → appears in directory. *Errors:* email already in another tenant → anti-enumeration silent; email already in this tenant → "Member already exists"; invite link expired (7 days) → admin resends.

13. **A User resets their password.** Login → "Forgot password" → enter email → always-success message "If that account exists, an email is sent" → click link → set new password → login. *Errors:* reset link expired (1h) → request new; rate limit (3/hour/email) → silent throttle.

14. **A Tenant Admin suspends or removes a member.** Admin → Members → row menu → Suspend or Remove → confirm → member's active sessions terminated within 30s. *Errors:* admin removes themselves → blocked with "Transfer admin role first"; member in active call → call ends + sessions kill; Remove triggers 7-day soft-delete grace period before hard delete.

15. **A Tenant Admin exports tenant data (GDPR/DPA).** Admin → Settings → Export data → confirm → BullMQ job enqueued (`tenant.export`) → worker assembles JSON bundle (Users + Devices + AuditLog + CallSession scoped by tenantId) → uploads to S3/MinIO under `exports/<tenantId>/<jobId>.json` → emails the requesting admin a signed download URL valid 24h → AuditLog records `tenant.export.request` (actor + jobId) and `tenant.export.complete` (size + checksum). *Errors:* concurrent export already running → "An export is already in progress — check your email"; job fails → admin receives failure email + AuditLog `tenant.export.failed` with reason; download link expired → admin re-requests. *Rate limit:* 1 export per tenant per 24h. *LAN parity:* same flow in LAN account mode using MinIO + customer-configured SMTP; anonymous LAN mode hides the feature (no tenant boundary, no admin email).

16. **An archived device reconnects.** Device offline ≥90 days → cron archives it (`device.archive` AuditLog) → device later opens app and connects → server detects `archivedAt IS NOT NULL` → auto-clears `archivedAt`, restores the prior admin-assigned `callRole`, AuditLog records `device.unarchive` → directory broadcasts the device as online to peers → admin's "Archived" view drops the row and "Online" view picks it up. *Edge:* if the device's owner User was hard-deleted during the archival window (Cloud), the device row is treated as orphaned and auto-unarchive is blocked pending admin reassignment.

17. **A Tenant Admin promotes a Member to co-admin (or demotes a co-admin back to Member).** Admin → Members → row menu → Promote to Admin (or Demote to Member) → confirm → `User.role` flips → Valkey pub/sub publishes `session.invalidate` to the target user's WS-connected sessions so the client re-fetches role on the next request → AuditLog records `member.role.promote` (or `member.role.demote`) with payload `{from, to}`. *Errors/edges:* attempting to demote the sole remaining admin → blocked with "Tenant must have at least one admin"; attempting to demote self while sole admin → same block ("Transfer admin role first"); transfer-admin = atomic transaction (promote target, then demote self, all-or-nothing); target user is suspended → promote allowed (role change preserved through suspension lift); cross-tenant — `targetUserId` cross-checked to belong to same tenant before commit (V25). *Parity:* LAN account mode uses the same flow; LAN anonymous mode hides the feature (no Member entity to promote).

18. **A LAN Server Admin signs in to the admin console (anonymous mode).** First-run wizard captured an admin passphrase (Argon2id-hashed, stored on the implicit Tenant row). Admin visits `/admin/login` → enters passphrase → server verifies hash → issues HttpOnly admin cookie (`yelli_admin_session`, 30-day rolling, scoped `/admin/*` + `/setup`, `SameSite=Lax`, `Secure` when HTTPS) → redirects to `/admin/branding`. *Errors:* wrong passphrase → generic "Couldn't sign in" + AuditLog `lan.admin.login.fail`; rate limit 5/min/IP at the `/admin/login` route. *Edge:* forgotten passphrase → admin must SSH into the host and run `./scripts/reset-admin-passphrase.sh` (clears `adminPassphraseHash`, AuditLog `lan.admin.passphrase.reset`, forces the first-run wizard to re-collect on next visit). *Parity:* LAN account mode hides this flow entirely (admins use the regular Auth.js login at `/login`); Cloud mode never exposes `/admin/login` (admin authority is derived from `User.role === admin` after standard Auth.js login).

### PWA + offline (both editions)

19. **A user installs Yelli as a PWA.** First visit: app loads normally, no install prompt. Second visit (detected via `localStorage.yelli_visited === '1'` set on first load): if the browser fires `beforeinstallprompt`, the event is intercepted and a Clay-styled banner appears at the top of the idle screen — "Install Yelli for incoming-call ringing" + **Install** / **Dismiss**. Install → `event.prompt()` → on accept, banner removes + (Cloud) AuditLog `pwa.install` written with `{platform: ios | android | desktop}` (inferred from `navigator.userAgentData` / fallback UA sniff). Dismiss → 30-day snooze stored at `localStorage.yelli_install_snoozed_until`. *Edges:* iOS Safari does not fire `beforeinstallprompt` → banner is suppressed entirely; instead, the directory's "Install Yelli to receive call notifications" inline hint links to **Settings → Install on iOS** which shows the Share-sheet → Add-to-Home-Screen walkthrough with screenshots; already-installed (`window.matchMedia('(display-mode: standalone)').matches` or `navigator.standalone === true`) → all install affordances suppressed.

20. **A backgrounded user receives a push-notified incoming call.** Callee's tab is closed or backgrounded. Caller presses CALL → server `call.invite` fans the WebSocket signal AND enqueues Web Push to every row in `WebPushSubscription` for the callee's Device → notification fires with body `{callerDisplayName} is calling` + tag `incoming-call-{callSessionId}` + **no action buttons** (consistent cross-platform behavior, including iOS PWA which does not support action buttons) → user taps the notification → service worker runs `clients.matchAll()` → if an app client exists it's focused and posted `{type: 'incoming-call', callSessionId}`; otherwise `clients.openWindow('/app?incoming={callSessionId}')` → app reads the `incoming` param OR receives the postMessage → reconnects WS → re-fetches pending call state via `call.pending` query → renders the standard Accept/Reject modal from flow #2. *Edges:* push delivered after caller cancelled → tap opens app to idle (server returns `endReason=cancelled` on `call.pending`, modal suppressed with toast "Missed call from {name}"); notification permission never granted → no subscription row created, callee depends on the tab being open; user dismisses notification without tapping → call times out per the 30s rule in flow #2; expired/invalid subscription endpoint (410 GONE from push service) → server deletes the row inline and continues with the remaining endpoints.

21. **A user loses network while the directory is open.** WebSocket `close` or `error` fires → app shell stays mounted (service worker serves cached HTML + JS + CSS + last directory snapshot from cache storage) → top-of-app banner appears: "Reconnecting…" with an animated indicator; every CALL button is disabled (visually greyed) while disconnected → reconnect loop runs with exponential backoff `1s → 2s → 5s → 15s → 60s` then steady 60s; offline >5 min → banner upgrades to "Still trying — check your network" + a manual **Retry now** button → on reconnect: banner clears, directory re-syncs from a fresh `directory.list` query, CALL buttons re-enable. *Edges:* user navigates while offline → routes resolve from the service-worker cache; mutating actions (settings save, branding save) carry an idempotency key (UUIDv7) and queue with a toast "Will retry when reconnected", replayed in order on reconnect (server dedupes on `(actorId, idempotencyKey)` within 24h); non-idempotent ops (`call.invite`) are NOT queued — they require a live WS connection and surface "Reconnect to call" if attempted offline; tab fully closed during offline → on relaunch the service worker resumes from cache then the live reconnect runs.

## Modules + Features

### Calling (both editions)
- 1-on-1 video + audio over WebRTC peer-to-peer
- WebSocket signaling for offer / answer / ICE-candidate handshake
- Incoming-call modal with caller display name + Accept / Reject
- In-call controls: mute, camera toggle, end
- Caller cancel-while-ringing
- "Busy" auto-reject when callee is already in a call
- No-answer auto-dismiss after 30s
- Auto-end on peer disconnect, ICE failure, or sustained signaling drop
- Local PIP preview, fullscreen remote video, call timer
- Connection-state badge: CONNECTING → READY → CALLING → IN CALL
- Per-device call role: both / caller / receiver — admin-assigned, default `receiver` on first join
- Call-role enforcement: UI hides CALL button against forbidden peers; server rejects `call.invite` with `forbidden_by_role` (defense in depth)
- Device registry: server persistently stores every device that has ever joined + its assigned role; admin UI defaults to showing online + 24hr-recent, with a toggle to view the full history
- Role-broadcast transport: admin role changes propagate via the existing WebSocket signaling channel; Valkey pub/sub fans events across signaling instances (Cloud + LAN account mode); LAN anonymous mode uses in-process fan-out only
- Device auto-archive: BullMQ cron sweeps devices not seen in 90 days and sets `archivedAt`; runs daily 03:00 UTC, iterates tenants explicitly per V25 cron rule
- Archived-device reconnect: an archived device that reconnects is auto-unarchived (prior `callRole` restored, AuditLog `device.unarchive` written); orphaned devices (owner User hard-deleted during archival window) are blocked pending admin reassignment
- Web Push tap-to-open for incoming calls: `call.invite` enqueues a Web Push notification (body `{callerDisplayName} is calling`, tag `incoming-call-{callSessionId}`, NO action buttons — uniform cross-platform behavior including iOS PWA); tap focuses or opens the app, app re-fetches pending call state via `call.pending`, then renders the standard Accept/Reject modal

### Directory (both editions)
- Live list of online peers scoped to the deployment (LAN: same signaling server; Cloud: same tenant)
- Display names shown (replaces hex IDs)
- Real-time join/leave updates via WebSocket broadcast
- Tap-to-call from row
- Empty-state guidance
- Cached shell + "Reconnecting…" banner on transient WebSocket loss; CALL buttons disabled while offline; exponential backoff 1s → 2s → 5s → 15s → 60s then steady; >5 min upgrades to "Still trying — check your network" with manual Retry; idempotent mutations queue with toast "Will retry when reconnected" and replay on reconnect (server dedupes by `(actorId, idempotencyKey)` within 24h)

### Device Identity (both editions)
- First-launch display-name prompt
- Editable later via Settings drawer
- Max 24 chars; collisions on same network disambiguated by device-id suffix
- Persisted in localStorage per browser/install
- Role-chip preference also persisted per device

### Accounts & Auth (Cloud always; LAN in account mode)
- Email + password authentication via Auth.js v5 (sessions in PostgreSQL)
- Email verification on signup (24h link expiry)
- Password reset by email (1h link expiry, 3/hour/email throttle)
- Rate limiting: login 10/min, signup 5/hour/IP
- Anti-enumeration responses per V25 Secure Code Generation
- Magic-link login alternative (low-friction for invited members)

### Tenancy & Members (Cloud always; LAN account mode = single implicit tenant)
- Tenant provisioning at org signup
- Member roles: Tenant Admin + Member
- Invitation by email (7-day link expiry, anti-enumeration)
- Suspend member → active sessions terminated ≤30s
- Remove member → 7-day soft-delete grace
- Admin can't remove self (must transfer admin first); multi-admin supported
- L1–L6 data isolation: every query scoped by tenantId
- Seat counter displayed (no enforcement in MVP)

### Branding (both editions)
- Per-tenant override of header text (≤40 chars) + logo upload
- Logo: PNG/JPG/SVG ≤2 MB, rendered at 36×36 in app shell
- Storage: MinIO (dev) → S3 (prod)
- Live broadcast to all active sessions within 30s of save
- Default fallback: "Yelli" + teal-mint gradient blob (current logo treatment)
- Powerbyte footer immutable — not editable by tenants

### Admin Console (both editions)
- First-run setup wizard (LAN: anonymous vs account mode, org name, logo)
- Members page: list, invite, suspend, remove, promote to admin, demote to member (last-admin demotion blocked at API + UI)
- LAN admin login page (`/admin/login`, anonymous mode only) — passphrase entry, rate-limited, HttpOnly admin cookie
- Branding settings page
- Org settings: display name, slug (Cloud)
- Seat count + plan badge (Cloud, display-only in MVP)
- Powerbyte Super-Admin minimal console at `/_pwbt/` — separate tRPC router + dedicated Prisma client (V25 isolation): list tenants, view metadata (name, slug, member count, status, createdAt), toggle isSuspended
- Tenant data export (GDPR/DPA): Tenant Admin requests JSON bundle of own tenant's Users + Devices + AuditLog + CallSession; BullMQ job assembles + uploads to S3/MinIO + emails signed 24h link; rate-limited 1/tenant/24h; AuditLog records request, complete, and failed events

### PWA + offline (both editions)
- Custom install banner triggered on 2nd visit via intercepted `beforeinstallprompt`; Clay-styled top-of-idle banner with **Install** / **Dismiss**; Dismiss snoozes 30 days via `localStorage.yelli_install_snoozed_until`
- iOS Safari fallback: `beforeinstallprompt` not supported → banner suppressed; inline directory hint + Settings → "Install on iOS" walkthrough (screenshots of Share → Add to Home Screen)
- Already-installed detection (`display-mode: standalone` or `navigator.standalone`) hides all install affordances
- Service-worker shell caching (Workbox precache: app HTML/JS/CSS + last directory snapshot via stale-while-revalidate)
- Auto-reconnect WS with exponential backoff (1s → 2s → 5s → 15s → 60s steady); CALL disabled while offline; >5 min surfaces manual Retry
- Mutation replay queue: idempotent procedures carry UUIDv7 `idempotencyKey`; offline queue replays in order on reconnect; server dedupes `(actorId, idempotencyKey)` within 24h
- Non-idempotent calls (`call.invite`) are NOT queued — require live WS; offline attempt shows "Reconnect to call"
- Web Push subscription lifecycle: registered after notification-permission grant in the standalone PWA only; expired/invalid endpoint (`410 GONE`) auto-pruned by the server on next send
- AuditLog `pwa.install` recorded on successful install acceptance in Cloud mode (LAN anonymous mode skips — no user binding)

## Roles + Permissions

| Role | Can do | Cannot do |
|------|--------|-----------|
| **Device User** *(LAN anonymous mode only)* | Set device display name (subject to global rename-lock toggle); place 1-on-1 calls to any peer whose role permits it; accept/reject incoming calls; mute/cam toggle mid-call | Set or change own call role (admin-assigned only); access any admin/settings page; persist identity across browsers; see anything outside the on-network peer directory |
| **Member** *(Cloud + LAN account mode)* | Log in with email + password (or magic link); set per-device display name + role; place/receive calls within own tenant's directory; reset own password; toggle mute/cam mid-call | See members of other tenants; modify tenant branding; invite or remove other members; access `/_pwbt/` |
| **Tenant Admin** *(inherits Member)* | Invite members by email; suspend or remove members; transfer admin role; configure branding (header text + logo); change tenant display name; run first-run wizard (LAN) | See or affect any other tenant; bypass own tenant's session policies; access `/_pwbt/` |
| **Powerbyte Super-Admin** *(Cloud only; `/_pwbt/`)* | List all tenants; view tenant metadata (display name, slug, member count, isSuspended, createdAt); toggle a tenant's `isSuspended` | Read any tenant's user data, branding files, or call content; impersonate Members or Admins; access tenant-scoped tRPC routers; view call media (P2P — never reaches the server in any case) |

Role scope: Device User per-device; Member and Tenant Admin tenant-scoped (JWT carries tenantId); Powerbyte Super-Admin global (separate router per V25).

**Role transitions:**
- Promote Member → Tenant Admin: any existing Tenant Admin can perform; AuditLog `member.role.promote` (payload `{from: member, to: admin}`); Valkey pub/sub publishes `session.invalidate` to target's sessions.
- Demote Tenant Admin → Member: any existing Tenant Admin can perform; blocked if target is the sole admin (transfer first); same broadcast as promote.
- Transfer admin (self-demotion + promote another): single atomic transaction — promote target then demote self, all-or-nothing.
- Suspend Member (flow #14): sets `User.isSuspended = true`; per-request middleware blocks all subsequent calls; `session.invalidate` broadcast forces WS-connected clients to logout within 30s; idle tabs invalidate on next action.
- Remove Member (flow #14): 7-day soft-delete grace; `isSuspended = true` set immediately so session-kill applies the same way; hard delete after 7 days via BullMQ cron.
- Powerbyte Super-Admin tenant suspension/unsuspension: AuditLog written with `tenantId = NULL`, `actorUserId = <superAdminId>`, action `superadmin.tenant.suspend` / `superadmin.tenant.unsuspend`, targetType `Tenant`; `session.invalidate` broadcast to every session in that tenant simultaneously.

**Server-side enforcement (tRPC middleware order):**
1. `requireSession` — verifies Auth.js session cookie (or `yelli_admin_session` LAN admin cookie for `/admin/*` routes in anonymous mode); rejects 401 if missing/expired.
2. `requireFreshAccount` — re-validates `user.isSuspended === false` AND `tenant.isSuspended === false`; 30s Valkey cache keyed by sessionId; rejects 403 if either flag is true.
3. `requireTenantMatch` — V25 cross-check: `session.tenantId === resolvedTenantId` (from subdomain or payload `tenantId`); rejects 403 on mismatch.
4. `requireRole(roles)` — RBAC check against `session.user.role`; rejects 403 if role not in allowed set.
5. Procedure-specific guards (e.g. `call.invite` checks both peers' `callRole` per the defense-in-depth rule from flow #4; `member.role.demote` checks last-admin invariant).

The Super-Admin tRPC router skips steps 2–4 entirely; it runs its own `requireSuperAdmin` middleware against a dedicated Prisma client per V25 isolation. LAN anonymous mode collapses steps 2–4 into a single admin-cookie check (no Member entity, single implicit tenant).

## Data Entities

**Tenant**: id (uuid), slug (unique; subdomain), displayName (≤40 chars), logoUrl (nullable; S3/MinIO path), isSuspended (bool, default false), adminPassphraseHash (nullable; Argon2id; populated only in LAN anonymous mode by the first-run wizard — null in Cloud and LAN account mode where admin authority is derived from `User.role === admin`), createdAt, updatedAt. Has many Users, Devices, Invitations, AuditLogs. LAN mode: single implicit tenant row created at first-run with slug="default".

**User**: id (uuid), tenantId (fk), email (unique within tenant), emailVerifiedAt (nullable), passwordHash (Argon2id via Auth.js v5), displayName (account-level; ≤24 chars), role (enum: admin | member), isSuspended (bool, default false), createdAt, updatedAt, lastLoginAt (nullable). Belongs to Tenant; has many Devices, Sessions, Invitations (as inviter).

**Device**: id (uuid), tenantId (fk), userId (fk, nullable for LAN anonymous mode), displayName (≤24 chars; locked after first set when global rename-lock is ON), callRole (enum: both | caller | receiver — admin-assigned only; default `receiver` on first join), browserFingerprint (client-generated, persisted to localStorage), assignedRoleAt (nullable; timestamp of last admin role change), lastSeenAt, archivedAt (nullable; set when device is 90 days offline), createdAt. Belongs to Tenant; belongs to User (optional). Persistence: rows are retained after first join so admin can pre-assign roles before a device comes online. Lifecycle: devices not seen for 90 days are auto-archived by the daily 03:00 UTC BullMQ cron (`archivedAt` set; hidden from default admin views; still queryable and restorable). Auto-unarchive on reconnect: an archived device that comes back online has `archivedAt` cleared and its prior `callRole` restored; `device.unarchive` is written to AuditLog. Orphaned auto-unarchive (owner User hard-deleted during archival window) is blocked pending admin reassignment. Admin UI defaults to online + 24hr-recent; toggles available for "All active" and "Archived". Hard-delete only on explicit admin removal.

**Invitation**: id (uuid), tenantId (fk), invitedByUserId (fk), email (invitee), tokenHash (one-way hash; raw token only in the email), expiresAt (7 days from creation), acceptedAt (nullable), createdAt. Belongs to Tenant; belongs to inviting User.

**AuditLog**: id (uuid), tenantId (fk; null for super-admin actions), actorUserId (fk, nullable; null for system events like device.first_join), action (string enum: member.invite | member.suspend | member.remove | member.role.promote | member.role.demote | tenant.brand.update | tenant.suspend | tenant.export.request | tenant.export.complete | tenant.export.failed | device.first_join | device.role.assign | device.archive | device.unarchive | device.remove | auth.login.success | auth.login.fail | superadmin.tenant.suspend | superadmin.tenant.unsuspend | superadmin.tenant.import | lan.tenant.export | lan.admin.login.success | lan.admin.login.fail | lan.admin.passphrase.reset | pwa.install | etc.), targetType (User | Tenant | Invitation | Device | ExportJob), targetId (uuid), payload (jsonb; minimal context, no sensitive data — e.g. device.role.assign carries `{from, to}` enum pair; member.role.promote/demote carries `{from, to}` enum pair; tenant.export.complete carries `{bytes, sha256, expiresAt}`; device.unarchive carries `{restoredCallRole, archivedDurationDays}`; superadmin.tenant.suspend carries `{reason}` if provided; pwa.install carries `{platform}` where platform ∈ {ios, android, desktop}), createdAt. Retention: 7 years. L5 always-active. Super-admin entries are queryable via the dedicated `/_pwbt/audit` view (filters `tenantId IS NULL`); tenant admins never see them.

**CallSession**: id (uuid), tenantId (fk), callerDeviceId (fk Device), calleeDeviceId (fk Device), callerRoleAtCall (enum: both | caller | receiver — snapshot of caller's callRole at invite time), calleeRoleAtCall (enum: both | caller | receiver — snapshot of callee's callRole at invite time), startedAt (when ringing began), connectedAt (nullable — null if never connected), endedAt, durationSec (computed; null until ended), endReason (enum: completed | declined | busy | no-answer | peer-disconnect | ice-failed | cancelled | forbidden-by-role). Belongs to Tenant; belongs to two Devices. Indexes: (tenantId, startedAt DESC). Retention: 1 year. Role snapshots make audit queries decidable without walking the AuditLog timeline (e.g. "show all calls placed by a `receiver`-only device" returns instantly even after the role was later changed).

**WebPushSubscription**: id (uuid), tenantId (fk; null for LAN anon), userId (fk; nullable for LAN anon), deviceId (fk Device), endpoint (text; Web Push endpoint URL), p256dh (key), auth (key), expiresAt (nullable), createdAt, lastUsedAt. Belongs to Device (1-to-many — one device may have multiple subscriptions across browsers).

**Auth.js v5–managed (schema owned by Auth.js)**: Session, VerificationToken, Account.

## Integrations

- **Auth.js v5** — email/password + magic-link auth, sessions in PostgreSQL — OSS (MIT)
- **PostgreSQL** — primary database — OSS
- **Valkey + BullMQ** — async jobs and crons: invitation/verify/reset emails, logo image processing, 7-day soft-delete cron, **device-archive cron** (daily 03:00 UTC, sweeps devices offline ≥90d, tenant-scoped per V25), **tenant-export job** (`tenant.export` — assembles JSON, uploads to S3/MinIO, emails signed 24h link, rate-limited 1/tenant/24h); Valkey also serves as the **pub/sub bus for cross-instance signaling events** (admin device-role-change broadcast, directory join/leave fan-out, `session.invalidate` on member-suspend/remove/role-change/tenant-suspend) and as the backing store for the **30s freshness cache** keyed by sessionId (`user.isSuspended` + `tenant.isSuspended` snapshot) — OSS
- **MinIO (dev) / S3 (prod)** — logo + branding asset storage — OSS dev → AWS prod
- **Google STUN** (`stun.l.google.com`) — NAT discovery — public/free
- **coturn (self-hosted)** — TURN relay for users behind strict NAT (Cloud only) — OSS
- **Cloudflare DNS + Wildcard SSL** — `powerbyte.app` wildcard zone (Cloud only; subdomains `yelli-basic.powerbyte.app` + `yelli-basic-staging.powerbyte.app`) — existing zone shared with Marine-Guardian — free tier
- **Cloudflare Turnstile** — bot protection on signup, login, password reset (Cloud only; framework V27 default) — free tier
- **Resend** — transactional email (verify, magic link, password reset, member invitation) for Cloud — paid (~$20/mo for 50k emails)
- **SMTP (customer-configured)** — LAN account mode admins configure own SMTP (Gmail App Password, custom relay, or skip) — per-deployment
- **GlitchTip (self-hosted)** — error tracking, Sentry-compatible SDK (Cloud only) — OSS

## Deployment Config

**Yelli Cloud:**
- Environments: dev / staging / prod
- Hosting:      VPS + Komodo orchestration + Traefik reverse proxy (V27 stack)
- Dev mode:     MODE A — WSL2 native (only supported mode — pre-locked)
- Docker Hub:   enabled — hub_repo: powerbyteit/yelli
- Image tags:   staging = `:staging-latest` (floating); prod = `:vX.Y.Z` (immutable semver) AND `:prod` (floating pointer at current prod release). `push.sh` tags every prod-bound build with both. Komodo prod stack pulls `:prod`.
- Komodo:       staging `auto_update: true` (polls `:staging-latest`); prod `auto_update: false` — release = `push.sh vX.Y.Z` → re-tag `:prod` to that semver → click "Redeploy" in Komodo UI.
- Rollback:     re-tag `:prod` to a prior `:vX.Y.Z` on Docker Hub → click "Redeploy" in Komodo UI. No rebuild required. Prior 10 semver tags retained on Docker Hub indefinitely (older purged by quarterly retention sweep).
- TURN:         coturn as Docker service alongside app, ephemeral REST credentials (15-min)

**Yelli LAN:**
- Distribution: Docker image — `docker compose up` (assumes Docker installed on customer's box)
- License:      MIT (open-source — public GitHub repo)
- Auto-update:  none — admin pulls newer images manually
- Base URL:     `http://<lan-ip>:<port>` (HTTPS via self-signed cert when `./scripts/gen-cert.sh` is run)
- Port:         assigned by Phase 3
- Cloud export: `./scripts/export-lan-tenant.sh` produces a portable bundle (users, devices, branding, audit, sessions, push subscriptions) for one-way migration to Yelli Cloud — see "LAN → Cloud migration" under Infrastructure Notes

## Mobile Needs

**Native mobile app:** None — web only, PWA-installable from browser ("Add to Home Screen").
**Auth mode:** sessions live in cookies; persist across browser restarts; expire per Auth.js v5 default (30-day rolling).

**Mobile-First is the global design contract (locked Step 10, 2026-05-31).** Every page — public marketing, end-user, and admin — designs from 375px portrait baseline first and progressively enhances upward. There is no "Mobile Ready" fallback class; admin tables/forms must work on a phone as their first state, not their fallback state. Rationale: Yelli's primary users (clinic reception, shop staff, ward nurses) live on phones and tablets; even admin tasks (member promotion, branding tweak) frequently happen on the same handheld device. A Mobile-Ready desktop-primary build pushes admin work onto a second device the user often doesn't have at hand.

**Per-page mobile strategy (every page = Mobile First):**

| # | Page                                | Strategy       | Mobile-specific pattern                              |
|---|-------------------------------------|----------------|-----------------------------------------------------|
| 1 | Idle / Directory + CALL button      | Mobile First   | CALL hero stacks above directory; per-row Call button is full-width tap target |
| 2 | Fullscreen call view                | Mobile First   | Portrait-optimised; PiP bottom-right; control dock thumb-reachable |
| 3 | Incoming call modal                 | Mobile First   | Full-screen sheet on phone; centered modal on ≥md |
| 4 | Peer picker modal                   | Mobile First   | Bottom-sheet on phone; centered modal on ≥md |
| 5 | First-time display-name prompt      | Mobile First   | Single input + Save; keyboard-aware layout |
| 6 | LAN first-run setup wizard          | Mobile First   | Step cards stack vertically; one section at a time |
| 7 | Settings drawer (name + role)       | Mobile First   | Slide-up sheet on phone; right drawer on ≥md |
| 8 | Org signup (Cloud)                  | Mobile First   | Single-column form; subdomain field full-width |
| 9 | Log in                              | Mobile First   | Single-column form; Turnstile fits 375px |
| 10 | Forgot password                    | Mobile First   | One field + CTA |
| 11 | Reset password landing             | Mobile First   | Two fields stacked |
| 12 | Verify email landing               | Mobile First   | Single message card |
| 13 | Magic-link landing                 | Mobile First   | Single message card |
| 14 | Invitation accept                  | Mobile First   | Org+role preview card → Set password & join |
| 15 | Members list (admin)               | Mobile First   | Card list on <md (no horizontal scroll); table on ≥md |
| 16 | Invite member modal                | Mobile First   | Bottom-sheet on phone; centered on ≥md |
| 17 | Branding settings                  | Mobile First   | Form stacks above live-preview; preview becomes side column on ≥lg |
| 18 | Org settings (Cloud)               | Mobile First   | Single-column form sections; section anchors via tabs on phone |
| 19 | Tenant-suspended notice            | Mobile First   | Full-screen centered message |
| 20 | Super-Admin `/_pwbt/` tenant list  | Mobile First   | Same card-list pattern as #15 (Powerbyte staff still respond on-phone for incidents) |
| 21 | Landing page (Cloud marketing)     | Mobile First   | Hero stacks; feature cards 1-up on <md, 3-up on ≥md |
| 22 | Pricing page (Cloud)               | Mobile First   | Tier cards 1-up on <md, 3-up on ≥md |
| 23 | Privacy / Terms / Legal pages      | Mobile First   | Single-column body; max-width 720px on ≥md |

**Phase 4 implementation guidance (for Claude Code):**
- **375px portrait is THE baseline.** Build every page mobile-first; `md:` (768px) and `lg:` (1024px) classes ADD desktop affordances. Never write a desktop layout and add `max-md:` fallbacks — that's an anti-pattern under this lock.
- **Touch targets ≥44×44px.** Every clickable target (button, list-row Call, table-row action, filter pill) must satisfy this on `<md` viewports. Tap-target compliance is checked by the `a11y` skill pre-delivery.
- **Single-column defaults.** Forms, tables (rendered as card lists at `<md`), and side panels collapse to one column at base; multi-column appears only at `md:` (768px+).
- **No horizontal scroll for tables.** Members and Super-Admin tenant lists render as card lists at `<md`. Tables (`<table>`) only render at `md:` and up.
- **Mobile navigation pattern.** Tenant top bar collapses to a hamburger + bottom-nav at `<md`. Marketing nav collapses to a hamburger sheet at `<md`. Hero illustrations stack BELOW the headline at `<md`, not beside it.
- **Tailwind breakpoints:** `sm:` (640px — large phone), `md:` (768px — tablet portrait), `lg:` (1024px — laptop), `xl:` (1280px — desktop). All custom CSS still uses these as the canonical ladder.

**Push notifications:** Web Push API + Service Worker (PWA) for incoming-call ringing when tab is backgrounded/closed. Subscriptions stored in `WebPushSubscription` table. Notification UX = tap-to-open with NO action buttons (see flow #20); iOS PWA action-button limitation drove the cross-platform choice.

**PWA install + offline UX:** see flows #19–21. Install affordances suppressed for already-installed contexts (`display-mode: standalone` / `navigator.standalone`). iOS Safari gets an inline directory hint + Settings → "Install on iOS" walkthrough with Share-sheet screenshots in place of the native banner.

## Non-functional Requirements

Performance:    Signaling relay <100ms at 200 concurrent peers per node; call-setup latency <2s from CALL tap → callee ringing; media is P2P (no server hop). Marketing/auth pages <2s load on mobile 4G.
Uptime:         Yelli Cloud prod 99.5% SLA (≤43min downtime/month). Staging best-effort. LAN N/A (customer-controlled infra).
Data retention: AuditLog 7 years (PH BIR / compliance norm). CallSession metadata 1 year. User accounts indefinite while active; soft-delete grace 7 days then hard delete. Device rows retained indefinitely while active; auto-archived after 90 days offline (hidden from default admin views, still queryable and restorable); hard-delete only on explicit admin removal. VerificationTokens auto-expire per type (1h reset / 7d invite / 24h verify).
Compliance:     PH DPA (RA 10173) primary. GDPR opt-in (export + delete on request) for any EU customer. No PCI-DSS scope in MVP. No HIPAA scope. SOC 2 / ISO 27001 deferred until enterprise customers ask.
Accessibility:  WCAG 2.1 AA — framework V23 default; enforced by `a11y` skill pre-delivery checklist. Set `accessibility: wcag_aa` in inputs.yml.
Encryption:     HTTPS in transit everywhere (Let's Encrypt via Cloudflare + Traefik in Cloud; self-signed cert for LAN). WebRTC media DTLS-SRTP end-to-end (peer-to-peer, never decryptable by signaling server). At-rest filesystem-level encryption on host (Komodo-managed) for Cloud.
Observability:  GlitchTip self-hosted (Sentry-compatible SDK) for errors + Docker JSON-file log driver for structured app logs, tailed via Komodo's per-container log viewer. No central log aggregator (Loki, ELK) and no APM (OpenTelemetry, Datadog) in MVP — added only when error volume or SLO breaches justify the infra cost. Every log line is structured JSON (`{ts, level, msg, tenantId?, userId?, requestId, ...}`) so future Loki/OTel adoption is a transport swap, not a rewrite.
Uptime monitoring: UptimeRobot free tier polls `https://yelli-basic.powerbyte.app/` and `https://yelli-basic.powerbyte.app/_pwbt/health` every 5 minutes from multiple regions. Alerts route to `oncall@powerbyteitsolutions.com` + a dedicated Telegram channel. LAN deployments are NOT monitored (customer-owned infra). Health endpoint returns `{ok, db, valkey, signaling}` with 200/503 status — no auth required (no PII; rate-limited 60/min/IP).
Status page:    Static page at `status.powerbyte.app` (separate Cloudflare Pages site, single Markdown source in `status-page/` repo). MVP shows current state (operational / degraded / outage) + last 3 incidents with timestamps. Manually updated by Powerbyte on-call during incidents — no auto-population from UptimeRobot in MVP. Hosted-statuspage migration (Atlassian Statuspage, Instatus) deferred until customer contract requires SLA reporting.
Perf testing:   k6 scenario at `tests/perf/signaling.k6.js` simulates 200 concurrent WebSocket peers issuing `call.invite` + `signal.relay` at sustained 1 req/s/peer for 5 minutes. Run on-demand by the release engineer before every `:prod` tag promotion against the staging environment. Baseline numbers (p50/p95/p99 of signaling latency, call-setup wall-clock) are checked into `perf-baselines/<git-sha>.json`. No CI gate in MVP — release engineer reads the report and decides; regression threshold is documented as "p95 signaling > 150ms or p95 call-setup > 3s = block release". Automated weekly cron + Slack regression report is a documented Phase 5 enhancement.

**Feature parity (architectural rule, NON-NEGOTIABLE):** every feature must work in both Yelli LAN and Yelli Cloud editions from the same codebase. Phase 2.7 spec stress-test checks every workflow against both modes before code generation. PRs that introduce Cloud-only or LAN-only features without explicit `@dual-mode-exception` annotation MUST be rejected during review.

## Tenancy Model

Mode:                  multi (Cloud) + single (LAN — implicit single-tenant per deployment)
Routing (Cloud):       subdomain — `<slug>.yelli-basic.powerbyte.app`
Shared global data:    none — every entity is tenant-scoped via tenantId
DB isolation exception: none (no payroll/banking/medical data in MVP)

Single codebase serves both. LAN deployment creates one implicit tenant row at first-run (slug="default") and disables the subdomain router. Cloud deployment runs the full multi-tenant stack with subdomain → tenantId resolution at the proxy layer. V25 anti-tenant-switching cross-check: session.tenantId === resolved.slug.tenantId on every Cloud request.

**Tenant slug rules (Cloud signup):**
- Length: 3–30 characters
- Charset: lowercase ASCII letters, digits, hyphens (`^[a-z][a-z0-9-]*[a-z0-9]$`)
- Must start with a letter; cannot end with a hyphen; no consecutive hyphens
- Validated server-side at `tenant.signup`; client-side preview is UX only
- **Immutable after creation** — slug rename is not user-facing in MVP; manual rename = support ticket → Super-Admin DB migration via `/_pwbt/`
- **Reserved subdomain list** (rejected at signup with generic "slug unavailable" per V25 anti-enumeration): `www`, `api`, `app`, `admin`, `staging`, `dev`, `_pwbt`, `pwbt`, `status`, `blog`, `docs`, `mail`, `smtp`, `mx`, `support`, `help`, `auth`, `cdn`
- Reserved list lives in `src/config/reserved-slugs.ts` (single source of truth — referenced by `tenant.signup` validator and Traefik subdomain router)

## User-Facing URLs

**Yelli Cloud (root domain — `yelli-basic.powerbyte.app`):**
- `/`                            landing page (public marketing)
- `/pricing`                     pricing page (public)
- `/legal/privacy`               privacy policy (public)
- `/legal/terms`                 terms of service (public)
- `/signup`                      org signup (public)
- `/login`                       login (public)
- `/forgot-password`             password reset request (public)
- `/reset-password?token=...`    password reset landing (token-gated)
- `/verify-email?token=...`      email verification landing (token-gated)
- `/invite?token=...`            invitation accept (token-gated)
- `/_pwbt/`                      Powerbyte Super-Admin console (separate router)
- `/_pwbt/tenants`               tenant list + suspension toggle (Super-Admin only)
- `/_pwbt/import`                LAN-tenant import (Super-Admin only) — accepts `export-lan-tenant.sh` bundle, provisions a new tenant + slug, replays data

**Yelli Cloud (tenant subdomain — `<slug>.yelli-basic.powerbyte.app`):**
- `/`                            redirects to `/app`
- `/app`                         idle / directory (authenticated)
- `/admin/members`               members management (Tenant Admin)
- `/admin/branding`              branding settings (Tenant Admin)
- `/admin/settings`              org settings (Tenant Admin)
- `/settings`                    personal settings (any Member)

**Yelli LAN (`http://<lan-ip>:<port>`):**
- `/`                            idle / directory (anonymous mode) or login (account mode)
- `/setup`                       first-run setup wizard (LAN admin, one-time)
- `/admin/branding`              branding settings (admin)
- `/settings`                    personal device settings

## Access Control

Public routes:    `/`, `/pricing`, `/legal/*`, `/signup`, `/login`, `/forgot-password`, `/reset-password`, `/verify-email`, `/invite`
Protected routes: `<slug>.yelli-basic.powerbyte.app/app`, `<slug>.yelli-basic.powerbyte.app/settings` — require authenticated Member or Admin session in matching tenant
Admin-only:       `<slug>.yelli-basic.powerbyte.app/admin/*` — require Tenant Admin role
Super-Admin only: `/_pwbt/*` — require Powerbyte Super-Admin role (separate tRPC router + dedicated Prisma client per V25)
LAN anonymous:    device-facing routes (`/`, `/settings`) accessible without login; `/admin/*` + `/setup` gated by the `yelli_admin_session` HttpOnly cookie issued by `/admin/login` (passphrase-based, set during first-run wizard); `/admin/login` itself is public but rate-limited 5/min/IP
Server enforcement: see "Server-side enforcement (tRPC middleware order)" under Roles + Permissions — every authenticated procedure runs the 5-step middleware chain (session → freshness → tenant-match → role → procedure guard); Super-Admin router runs its own isolated chain.

## Data Sensitivity

PII stored:       yes — email, displayName, IP address (rate-limiting + audit log), browserFingerprint
Financial data:   no (Xendit deferred to v2)
Health data:      no
Audit required:   yes — every mutation to Tenant, User, Invitation, CallSession via AuditLog (L5 always-active). Login success + login fail events also logged.
GDPR/compliance:  yes — Tenant Admin can request data export (JSON of own tenant's User + Device + AuditLog + CallSession) and tenant deletion (7-day soft delete, then hard delete). PH DPA-aligned.

## Security Requirements

Rate limiting:    public 30/min, auth (login/reset) 10/min, signup 5/hour/IP, password reset 3/hour/email, api 120/min, upload 20/min
CORS origins:     dev: `localhost:*` | staging: `https://*.yelli-basic-staging.powerbyte.app` | prod: `https://*.yelli-basic.powerbyte.app`
Security layers:  L3 RBAC + L5 AuditLog + L6 Prisma guardrails always active. L1+L2+L4 active in Cloud (multi-tenant); dormant in LAN single-tenant (no migration needed if a LAN deployment ever upgrades to multi-tenant).
Anti-enumeration: signup, login, password-reset, invitation flows return generic responses per V25 Secure Code Generation
Tenant guard:     V25 cross-check — `session.tenantId === URL.slug.tenantId` on every Cloud request
Superadmin:       separate tRPC router + dedicated Prisma client for `/_pwbt/`; no shared middleware with tenant-scoped routers (V25)
Bot protection:   Cloudflare Turnstile on signup, login, password-reset (Cloud only)
File download:    server verifies tenantId matches storage path prefix before serving (V25 rule for branding logos)
Cron jobs:        iterate over tenants explicitly when running soft-delete-hard cron AND the daily 03:00 UTC device-archive cron (V25 rule — no unscoped queries). Tenant-export jobs are inherently tenant-scoped (jobId carries tenantId; worker rejects mismatched payloads).
Session kill:     hybrid pull + push — tRPC `requireFreshAccount` middleware re-checks `user.isSuspended` + `tenant.isSuspended` per request with a 30s Valkey cache keyed by sessionId; Valkey pub/sub publishes `session.invalidate` on suspend/remove/role-change/tenant-suspend so WS-connected clients force-logout within 30s; idle tabs invalidate on next action. 30s ceiling is the SLO.
LAN admin auth:   anonymous mode admin gate = Argon2id passphrase hash on `Tenant.adminPassphraseHash` (collected at first-run wizard) + HttpOnly `yelli_admin_session` cookie (30-day rolling, `SameSite=Lax`, `Secure` when HTTPS, scope `/admin/*` + `/setup`); rate limit 5/min/IP on `/admin/login`; reset only via host-side `./scripts/reset-admin-passphrase.sh`. LAN account mode + Cloud do NOT use this path (admin authority derived from `User.role === admin` via standard Auth.js login).
Last-admin guard: tenant must always have ≥1 admin — last-admin demotion, removal, and suspension are blocked at the API layer; transfer-admin (atomic promote+demote) is the documented escape hatch.
Role enforcement: privileges checked exclusively server-side (UI hiding is UX, not security); every role-mutating procedure (`member.invite`, `member.suspend`, `member.remove`, `member.role.promote`, `member.role.demote`, `device.role.assign`, `tenant.brand.update`, `tenant.export.request`) writes an AuditLog entry before returning.
Replay queue:     offline-queued mutations (settings save, branding save, etc.) MUST carry an idempotency key (UUIDv7); server deduplicates by `(actorUserId, idempotencyKey)` within a 24h sliding window before mutating. Idempotency keys are stored in a Valkey `SET` with 24h TTL per `actorUserId` namespace. Non-idempotent procedures (`call.invite`, `call.accept`, `call.reject`, `call.end`) are never queued — they require a live WebSocket and surface "Reconnect to call" if attempted offline.
PWA install:      `pwa.install` AuditLog (Cloud only) recorded only on the user's first successful install per device (deduped by `deviceId`); re-install events are not logged. Platform field is advisory (UA-derived), never used for authorization.

## App Footer (overrides framework default per user instruction)

Footer style:     subtle, centered, small text, muted color, bottom of every page layout
Content:          `Developed by Powerbyte IT Solutions · © [year]` — year auto-updates via `new Date().getFullYear()`
Link:             "Powerbyte IT Solutions" text is an anchor to `https://www.powerbyteitsolutions.com` (target=_blank, rel=noopener)
Immutability:     locked in app shell — NOT editable by Tenant Admins (the Branding feature only overrides header text + logo, never the footer)
Implementation:   single `<Footer />` component in app layout — renders on every page (public + authenticated). Uses `text-muted-foreground text-xs py-4 text-center`.

## Environments Needed

Yelli Cloud:  dev / staging / prod
Yelli LAN:    single environment (customer's box)

## Domain / Base URL Expectations

**Yelli Cloud:**
- Dev:     `http://localhost:[port assigned by Phase 3 — do not specify a number here]`
- Stage:   `https://yelli-basic-staging.powerbyte.app` (+ wildcard `*.yelli-basic-staging.powerbyte.app` for tenant subdomains)
- Prod:    `https://yelli-basic.powerbyte.app` (+ wildcard `*.yelli-basic.powerbyte.app` for tenant subdomains)

**Yelli LAN:**
- All envs: `http://<lan-ip>:[port assigned by Phase 3]` (HTTPS via self-signed cert when `./scripts/gen-cert.sh` is run)

## Infrastructure Notes

All services run in Docker Compose — mono-server for dev/staging/prod (Cloud) and single-machine (LAN).

**Yelli Cloud Docker services:**
- app (Next.js + tRPC + WebSocket signaling) — behind Traefik for automatic TLS
- postgres (PostgreSQL)
- valkey (Valkey + BullMQ workers)
- minio (dev) → S3 (prod)
- coturn (TURN relay)
- glitchtip (error tracking)
- traefik (reverse proxy, automatic Let's Encrypt)
- pgAdmin (all envs — credentials auto-generated by Phase 3)

**Yelli LAN Docker services:**
- app (Next.js + tRPC + WebSocket signaling — same image as Cloud, different config)
- postgres
- valkey (account mode only — anonymous mode runs without Valkey/BullMQ)
- no coturn, no Cloudflare, no Resend, no GlitchTip — LAN is offline-capable by design

**Docker Hub publishing:** enabled — hub_repo: `powerbyteit/yelli`. `push.sh` + `COMMANDS.md` generated by Phase 4 Part 7. Tag scheme: every prod-bound build is tagged `:vX.Y.Z` (immutable semver) AND `:prod` (floating pointer). Staging builds tagged `:staging-latest` (floating). Prior 10 semver tags retained on Docker Hub; older purged via quarterly retention sweep.

**Backups (Cloud postgres):** BullMQ cron at 02:00 UTC daily runs `pg_dump --format=custom --compress=9` → uploads to `s3://yelli-backups-prod/postgres/YYYY-MM-DD.dump`. Retention policy: 30-day lifecycle expiration; transition to Glacier Instant Retrieval after 7 days (warm-side cost optimization while preserving 30-day RPO). Restore tested quarterly into a throwaway staging DB. PITR (wal-g) deferred until first enterprise customer asks. LAN N/A (customer responsibility — `./scripts/backup-lan.sh` provided as a convenience).

**S3 buckets (Cloud):**
- `yelli-prod-uploads` — branding logos + future user uploads. **Versioning ON** (rollback bad uploads). No TTL — user content. Server-side encryption SSE-S3 (AES-256). Public-read disabled — all reads via signed URLs.
- `yelli-backups-prod` — postgres dumps + tenant-export artifacts. Versioning OFF. Lifecycle: 30-day expiration on `postgres/`; 24-hour expiration on `tenant-exports/` (matches signed-URL TTL). SSE-S3.
- `yelli-staging-uploads` / `yelli-backups-staging` — same shape, separate keys.

**Komodo deployment (Cloud):** staging `auto_update: true` (polls Docker Hub for `:staging-latest`), prod `auto_update: false` (manual deploy from Komodo UI per V27, pulls floating `:prod` tag). Release flow: `./scripts/push.sh vX.Y.Z` builds + tags `:vX.Y.Z` + `:prod` + `:staging-latest`, pushes to Docker Hub, then Komodo prod "Redeploy" pulls `:prod`. Rollback = re-tag `:prod` to a prior semver via `docker buildx imagetools create -t powerbyteit/yelli:prod powerbyteit/yelli:vX.Y.Z-1` + Komodo "Redeploy".

**CREDENTIALS.md:** generated by Phase 3 — master credentials list for all envs, strictly gitignored. Bootstrap Step 18 collects: GitHub PAT, Docker Hub token, Resend API key, Cloudflare API token + Turnstile keys, Komodo tokens, coturn shared secret, SMTP fallback creds.

**Security:** HTTP headers + rate limiter + DOMPurify sanitizer scaffolded by Phase 4 — always-on defaults.

**Spec stress-test (Phase 2.7):** runs automatically before Phase 3 — checks every workflow against both LAN and Cloud editions (feature-parity rule).

**AWS path when ready:** RDS, S3, ElastiCache, SES — update `.env.{env}` only, zero code changes.

**LAN → Cloud migration (one-way, documented but not auto-tested):**
- **Trigger:** customer outgrows LAN (multi-site, remote-work, or wants Cloud features); migration is opt-in and Powerbyte-assisted in MVP (not self-service).
- **Step 1 (on-box):** LAN admin runs `./scripts/export-lan-tenant.sh` → emits `yelli-lan-export-<timestamp>.tar.gz` containing: tenant row (slug rewritten to placeholder), users (passwords excluded — Cloud re-issues invitations), devices, branding assets (logo binaries inlined), audit log, call sessions, web-push subscriptions. Schema-versioned (`schema_version` field) so Cloud importer validates compatibility.
- **Step 2 (Cloud side):** Powerbyte Super-Admin uploads bundle to `/_pwbt/import`, chooses target slug (validated against reserved list + uniqueness), confirms preview, executes. Importer runs inside a single Prisma transaction with V25 cross-checks; on failure, full rollback.
- **Step 3 (post-import):** Cloud auto-sends fresh email invitations to all imported users (re-onboarding); customer DNS-points existing LAN clients at Cloud subdomain or distributes new URL.
- **Out of scope:** auto-tested migration coverage (lives in DECISIONS_LOG as a known gap); reverse migration (Cloud → LAN); incremental sync (export is one-shot snapshot).

## Tech Stack Preferences

Frontend framework:        Next.js
API style:                 tRPC
ORM / DB layer:            Prisma
Auth provider:             Auth.js v5 — email/password + magic link, sessions in PostgreSQL
Auth strategy:             authjs
Primary database:          PostgreSQL
Cache / queue:             Valkey + BullMQ (Cloud always; LAN in account mode only)
File storage:              MinIO (dev) / S3 (prod) — logos + branding assets
UI component library:      shadcn/ui + Tailwind CSS (locked — no alternatives)
Chart library:             none (no dashboards/analytics in MVP)
Map library:               none (no maps in scope)
Complex UI components:     none (standard shadcn primitives cover everything)
Icon set:                  lucide-react (shadcn/ui default — no other icon libraries)
Mobile UI library:         none (PWA web only — no native app)

**WebRTC stack:**
- Signaling:               WebSocket (`ws` library, riding the same HTTP/HTTPS server as the app)
- NAT discovery (STUN):    `stun.l.google.com` (both editions)
- NAT relay (TURN):        coturn self-hosted (Cloud only — LAN doesn't need TURN)
- Media:                   peer-to-peer DTLS-SRTP — never touches the signaling server

**PWA stack:**
- Service worker:          Web Push notifications + offline shell
- Manifest:                app installable from browser ("Add to Home Screen")
- Web Push:                `web-push` (server) + Push API (client)

## Design Identity

Brand feel:         Friendly / approachable / warm B2B SaaS — not enterprise-cool
Target aesthetic:   **Clay.com design system** — cream-tinted white canvas (#fffaf0), dark-navy primary CTAs (#0a0a0a), 6-color saturated brand palette (pink / teal / lavender / peach / ochre / mint), generous border radius (12px buttons, 24px feature cards), Inter font (Plain Black not licensed — Inter 500 with negative letter-spacing as substitute)
Industry category:  Communications Platform (SaaS + self-host)
Dark mode required: no (out of scope per Section 11)
Key constraint:     WCAG AA accessibility
Theming approach:   shadcn/ui CSS variables (`--primary`, `--secondary`, etc.) — customized in `globals.css` per Clay-derived tokens
Design system:      see `DESIGN.md` at project root (Clay aesthetic — promoted from `AlphaTest/DESIGN.md` on 2026-05-30; carry forward into Phase 2.6)
Reference:          https://ui.shadcn.com/docs/theming · Dark mode docs: https://ui.shadcn.com/docs/dark-mode

**Design tokens architecture (locked Step 8):**
- **Single source of truth**: `src/styles/tokens.css` declares every Clay token as a CSS custom property — canvas (`--clay-cream-canvas: #fffaf0`), navy primary (`--clay-navy-primary: #0a0a0a`), 6-color brand palette (`--clay-pink`, `--clay-teal`, `--clay-lavender`, `--clay-peach`, `--clay-ochre`, `--clay-mint`), radii (`--clay-radius-button: 12px`, `--clay-radius-card: 24px`), and Inter-based type scale (`--clay-fs-display`, `--clay-fs-h1`, `--clay-fs-body`, plus `--clay-tracking-tight` for the Plain-Black substitute).
- **shadcn/ui mapping**: `src/styles/globals.css` declares shadcn's `--primary`, `--secondary`, `--background`, `--foreground`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--radius` and maps each one FROM `tokens.css` (e.g. `--primary: var(--clay-navy-primary); --background: var(--clay-cream-canvas); --radius: var(--clay-radius-button);`). No literal hex values in `globals.css`.
- **Tailwind mapping**: `tailwind.config.ts` `theme.extend.colors` references `hsl(var(--primary))` / `hsl(var(--background))` etc. so Tailwind utility classes share the same tokens with no duplication.
- **Non-CSS consumers**: a small hand-maintained `src/styles/tokens.ts` re-exports the same values as TypeScript constants for places CSS vars cannot reach (icon stroke colors set via React props, future chart palettes). Drift between `tokens.css` and `tokens.ts` is caught by a Vitest token-parity test.
- **Outcome**: one edit to `tokens.css` propagates to shadcn primitives, Tailwind utilities, and raw CSS simultaneously — no codegen step, no YAML, no build-time generation.

## Out of Scope

**Communication features:**
- Group calls (3+ participants) — strictly 1-on-1 per Problem Statement
- Screen sharing
- In-call text chat
- Call recording
- Call history UI (CallSession exists as audit data; no user-facing log view in MVP)
- Live captioning / transcription
- Multi-language i18n (English only at MVP)
- Dark mode toggle

**Mobile / distribution:**
- Native iOS / Android app (PWA covers MVP)
- LAN single-binary or install-script distribution (Docker image only)
- LAN auto-update mechanism (admin pulls newer images manually)
- Bluetooth / USB peripheral selection UI

**Accounts / auth:**
- Social login providers (Google, GitHub) — Auth.js supports it; deferred to v2
- Enterprise SSO / SAML (Keycloak path; not requested)
- 2FA / TOTP / WebAuthn — defer to v2

**Tenancy / billing:**
- Self-serve subscription + billing via Xendit (manual invoicing in MVP)
- Seat-limit enforcement (display only — enforcement is v2 billing concern)
- Custom domains beyond `*.yelli-basic.powerbyte.app` (e.g. `intercom.acme.com` reverse-mapped) — v2
- Cross-deployment federation (Yelli Cloud user calling a Yelli LAN user across deployments)

**Admin / ops:**
- Full Powerbyte super-admin console (only minimal `/_pwbt/` tenant list + suspend in MVP)
- Tenant data export by Powerbyte staff (only by Tenant Admin themselves per GDPR/DPA)
- Tenant impersonation by support staff

**Integrations:**
- Public API for 3rd-party integrations
- Webhooks for tenant events (member.created etc.)
- n8n / OpenClaw automation workflows (none declared in Step 5 per Rule 11)

**Compliance scope (don't apply at MVP):**
- PCI-DSS scope (no payment data — Xendit deferred to v2)
- HIPAA scope (not a medical product; no PHI stored)
- SOC 2 / ISO 27001 audit certification (defer until enterprise customers ask)

---

## DECISIONS_LOG guidance for Claude Code (Brownfield Adoption)

**Stack migration — Prompt 1.5 territory:**

The existing Yelli LAN MVP (now at the project root, promoted from `AlphaTest/` on 2026-05-30) is built on a different stack than this PRODUCT.md targets. Phase 3 must generate `inputs.yml` with `migration.brownfield: true` and Phase 4 Part 1 must rewrite the signaling layer rather than retrofit the framework around the existing code.

| Concern | Current (project root) | Framework target (this PRODUCT.md) |
|---|---|---|
| Backend runtime | Vanilla Node.js (http + ws) | Next.js 16 + Node 24 |
| API style | Raw WebSocket message types | tRPC + WebSocket subscription for signaling |
| Database | None (in-memory `Map<id, ws>`) | PostgreSQL + Prisma |
| Auth | None (ephemeral hex IDs) | Auth.js v5 |
| Frontend | Single-file vanilla HTML + inline CSS/JS | Next.js + React + shadcn/ui + Tailwind |
| Styling | Clay tokens applied inline as CSS variables | Clay tokens as shadcn/ui CSS variables in `globals.css` |
| Container | Dockerfile present (single-stage) | Multi-service compose + Traefik (Cloud); minimal compose (LAN) |
| Deployment | Manual `node server.js` + cloudflared tunnel | Komodo + Traefik + Docker Hub (Cloud); `docker compose up` (LAN) |

**Phase 2.8 Visual Checkpoint:** **SATISFIED** — working UI artifact exists at `public/index.html` (Clay design tokens already applied). React mockup generation skipped per SITUATION D step 6. The existing client is the reference for the Phase 4 React rebuild.

**Audit trail of decisions captured during reverse-extraction interview (SITUATION D):**
- Dual-deployment (LAN + Cloud, feature parity) — top-level architectural rule
- Cloud tenancy = B2B multi-tenant
- LAN account mode = optional (anonymous mode is the default)
- Per-device display names (replaces hex IDs)
- Per-tenant branding (header text + logo)
- Powerbyte footer immutable (text + link locked, year auto-updates)
- Tenant URL routing = subdomain (`*.yelli-basic.powerbyte.app`)
- Super-admin console = minimal `/_pwbt/` only (defer full console to v2)
- TURN server = self-hosted coturn (Cloud)
- SMTP = Resend (Cloud), customer-configured (LAN account mode)
- Cloudflare Turnstile = enabled (Cloud public endpoints)
- Domains: `yelli-basic.powerbyte.app` (prod), `yelli-basic-staging.powerbyte.app` (staging)
- LAN distribution = Docker image only
- LAN license = MIT (public repo)
- Push notifications = Web Push + PWA service worker
- Native mobile app = none (PWA only)
- Observability = GlitchTip self-hosted
- CallSession entity included as audit-only (no UI in MVP)
- Manual invoicing in MVP; Xendit self-serve billing deferred to v2

**Step 7 lock (deployment + tenancy + URLs + infrastructure, 2026-05-31):**
- Prod image tag scheme = semver `:vX.Y.Z` (immutable) + floating `:prod` pointer; rollback = re-tag `:prod` to prior semver + Komodo "Redeploy" (no rebuild)
- Tenant slug rules = 3–30 chars, `^[a-z][a-z0-9-]*[a-z0-9]$`, immutable after creation; reserved subdomain list of 18 entries in `src/config/reserved-slugs.ts` (single source of truth shared by validator + Traefik router)
- Postgres backup = daily 02:00 UTC `pg_dump` → `s3://yelli-backups-prod/postgres/`, 30-day retention, Glacier IR transition after 7 days; restore tested quarterly; PITR (wal-g) deferred until first enterprise ask
- S3 bucket lifecycle = `yelli-prod-uploads` versioned + no TTL (user content); `yelli-backups-prod` 30d expiry on `postgres/`, 24h expiry on `tenant-exports/`
- LAN → Cloud migration = `./scripts/export-lan-tenant.sh` bundle + `/_pwbt/import` endpoint; documented, Powerbyte-assisted (not self-service in MVP); auto-tested coverage is a known gap; AuditLog extended with `lan.tenant.export` + `superadmin.tenant.import`

**Step 8 lock (Mobile + UI/UX + Design + PWA + Tech Stack, 2026-05-31):**
- PWA install = custom Clay-styled banner triggered on 2nd visit by intercepted `beforeinstallprompt`; **Install** / **Dismiss**; Dismiss snoozes 30 days via `localStorage.yelli_install_snoozed_until`; iOS Safari (no `beforeinstallprompt`) falls back to inline directory hint + Settings → "Install on iOS" walkthrough; already-installed detection suppresses all affordances
- Web Push UX for incoming calls = tap-to-open + in-app modal (NO action buttons — uniform cross-platform behavior including iOS PWA which doesn't support them); service worker focuses existing client or opens `/app?incoming={callSessionId}`; expired endpoints auto-pruned on 410
- Offline behaviour = service-worker cached shell + "Reconnecting…" banner; CALL disabled while offline; exponential backoff `1s → 2s → 5s → 15s → 60s steady`; >5 min upgrades to "Still trying — check your network" + manual Retry; idempotent mutations queue with UUIDv7 keys and replay on reconnect; non-idempotent (`call.invite/accept/reject/end`) never queued
- Replay queue dedup = server stores keys in Valkey `SET` keyed by `actorUserId`, 24h TTL; rejects duplicate `(actorUserId, idempotencyKey)` mutations
- Design tokens = single `src/styles/tokens.css` source declares Clay tokens as CSS vars; `globals.css` maps shadcn `--primary`/etc. FROM the Clay tokens; `tailwind.config.ts` references the same vars; hand-maintained `tokens.ts` for non-CSS consumers; Vitest token-parity test catches drift; one edit to `tokens.css` propagates everywhere with no codegen
- AuditLog enum extended with `pwa.install` (Cloud only; deduped per-device; platform field advisory only)

**Step 10 lock (Mobile-First global contract — post-audit 2026-05-31):**
- Every page in the per-page Mobile Strategy table is now `Mobile First` (the 6 prior `Mobile Ready` admin pages were flipped). Admin work (Members, Branding, Org settings, `/_pwbt/` tenant list) is designed from 375px portrait baseline FIRST and only enhances at `md:` / `lg:`.
- Touch targets ≥44×44px enforced on every clickable target at `<md` viewports.
- Tables render as card lists at `<md`; `<table>` only at `md:`+. No horizontal-scroll tables in the MVP.
- Tenant top bar collapses to hamburger + bottom-nav at `<md`. Marketing nav collapses to hamburger sheet at `<md`. Hero illustrations stack BELOW the headline at `<md`.
- DESIGN.md "Responsive Behavior" section was updated in lockstep (mobile-first direction; "Mobile-First Principles" subsection added).
- MOCKUP.jsx was rewritten in lockstep so every Tier 1 screen renders correctly at 375px without horizontal scroll.

**Step 9 lock (Operational quality attributes — final NFR closeout, 2026-05-31):**
- Status page = static `status.powerbyte.app` (Cloudflare Pages, Markdown source in `status-page/` repo); manual updates by Powerbyte on-call; current state + last 3 incidents; hosted-statuspage migration deferred
- Observability = GlitchTip (errors) + Docker JSON-file log driver + Komodo per-container log viewer; structured JSON log lines (`{ts, level, msg, tenantId?, userId?, requestId, ...}`) so future Loki/OTel adoption is a transport swap; no central aggregator or APM in MVP
- Uptime monitoring = UptimeRobot free tier, 5-min interval, multi-region; probes `/` + `/_pwbt/health`; alerts to `oncall@powerbyteitsolutions.com` + Telegram channel; LAN deployments not monitored (customer infra); `/_pwbt/health` returns `{ok, db, valkey, signaling}` with 200/503, no auth, rate-limited 60/min/IP
- Perf testing = `tests/perf/signaling.k6.js` (k6) simulates 200 concurrent WS peers at 1 req/s/peer for 5 minutes; release engineer runs against staging before every `:prod` promotion; baselines in `perf-baselines/<git-sha>.json`; regression block threshold `p95 signaling > 150ms` OR `p95 call-setup > 3s`; CI cron + Slack regression report deferred to Phase 5
- PRODUCT.md V31 framework lock complete: all 9 steps closed, ready for `Phase 2` (architecture spec) → `Phase 3` (bootstrap) → `Phase 4` (implementation). No further user input required to begin Phase 2.
