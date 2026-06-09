# PROTOTYPE.md — Yelli Phase 3.3 Interactive Prototype

> Durable behavioural blueprint for Phase 4. Authoritative for **what the app
> does and how its screens behave**; `docs/PRODUCT.md` remains authoritative
> for **what the app is and why**. Phase 4 builds the production stack against
> this blueprint, replacing the simulated data layer with real tRPC + Prisma
> behind the same interface boundary.

- **Phase:** 3.3 (Interactive Prototype & Simulation)
- **Status:** §3 Core User Flows complete — 9/9 walkable (Waves 3–11)
- **Last updated:** 2026-06-09
- **Source of truth:** `docs/PRODUCT.md` §3 Core User Flows
- **Runnable artifact:** `prototype/` (Next.js 15 + React 19 + Tailwind 4)
- **PA baseline (inherited, never regenerated):** `docs/DESIGN.md`, `docs/MOCKUP.jsx`

---

## 1. Simulation Technique

**Choice:** Browser storage (localStorage) + in-tab pub/sub via a custom
`yelli:sim:change` CustomEvent, with a single `subscribe(table, cb)` API
matching what tRPC + WebSocket subscriptions will provide in Phase 4.

**Why this technique:**
- Yelli is **flow + workflow heavy** with realistic cross-tab and cross-window
  interactions (calls, role broadcasts, admin sessions). Plain fixtures cannot
  reproduce those dynamics; a real DB is premature.
- localStorage gives durable state across reloads, real cross-tab eventing
  (`storage` event), and zero infra cost — appropriate for client validation
  without locking in a backend choice.
- The full data layer lives behind a **single barrel** at
  `prototype/src/lib/sim/index.ts`. Phase 4 swaps that barrel's
  implementations for tRPC client wrappers of identical shape; no UI file
  changes.

**Files:**
```
prototype/src/lib/sim/
  index.ts      — barrel (the swap boundary)
  types.ts      — entity shapes verbatim from PRODUCT.md
  storage.ts    — localStorage wrapper + change pub/sub (SSR-safe)
  clock.ts      — abstract `now()` + `advance(ms)` so tests can fast-forward
  seed.ts       — deterministic seed for first-load demo state
  repo.ts       — typed repository (the API the UI consumes)
```

---

## 2. Simulated Data Model

Entity types are verbatim from PRODUCT.md and locked at the barrel.
Storage keys are prefixed `yelli:sim:<table>` and namespaced via
`TABLES` (single source of truth).

| Table | Entity | Phase 4 store |
|---|---|---|
| `tenants` | `Tenant` | Prisma `tenant` table |
| `users` | `User` | Prisma `user` table (Auth.js v5 adapter) |
| `devices` | `Device` | Prisma `device` table |
| `callSessions` | `CallSession` | Prisma `callSession` table |
| `invitations` | `Invitation` | Prisma `invitation` table |
| `auditLog` | `AuditLog` | Prisma `auditLog` (append-only) |
| `adminSession` | `AdminSession` (single row) | HttpOnly cookie + server session |
| `tenantExports` | `ExportJob` | Prisma `exportJob` + BullMQ job state |

**Sim-only state (does not persist to Phase 4 DB):**
- `dummy-tenant.ts` — `TENANT` and `ME` constants for the top-bar avatar +
  branding shell. Phase 4 derives these from the resolved tenant + session.

---

## 3. Audit Vocabulary (§11-canonical)

Every mutation in the sim emits exactly one audit row from this list.
Phase 4 must preserve this vocabulary verbatim (tRPC procedures emit the
same action strings + payload shape so the Audit View screen keeps working).

```
device.create              device.first_join           device.rename
device.role.assign         device.archive              device.archive.batch
device.unarchive           device.delete

call.start                 call.connected              call.end
                           (endReason: completed | declined | busy | no-answer |
                            peer-disconnect | ice-failed | cancelled | forbidden-by-role)

invitation.create          invitation.resend           invitation.revoke
invitation.accept

user.create                user.role.promote           user.role.demote
user.suspend               user.delete

tenant.create              tenant.branding.update      tenant.admin.passphrase.set
tenant.export.requested    tenant.export.ready         tenant.export.downloaded

lan.admin.login.success    lan.admin.login.fail        lan.admin.logout
```

Convention: action strings are lowercase, dot-separated. `*.batch` suffix
distinguishes server-side mass operations (cron) from singular admin actions
(see Wave 9 split: `device.archive` vs `device.archive.batch`).

---

## 4. Core User Flows — Walkthroughs

Each subsection maps a `docs/PRODUCT.md` §3 flow to the screen(s) that
implement it, lists the visible states (idle / interactive / empty /
loading / error), and names the audit emits the flow produces.

### Flow A — Member places a 1-on-1 call (PRODUCT.md §3 flow 1)
- **Screens:** `ScreenApp.tsx` (directory) → `ScreenActiveCall.tsx`
- **Path:** Directory lists online peers (filtered by `devices.online()`) →
  tap row → CALL button (hidden when peer role forbids it, Wave 6 §11
  enforcement) → `callSessions.start({callerDeviceId, calleeDeviceId})`
  emits `call.start` and snapshots both roles into `callerRoleAtCall` /
  `calleeRoleAtCall` → navigates to `ScreenActiveCall`.
- **States:** idle directory · CALL pressed (optimistic transition) ·
  active call (mocked media surface) · ended (back to directory).
- **Errors:** peer's role flips to `receiver` mid-list → CALL hides on next
  pub/sub tick (5s budget in spec, real-time in sim); peer goes offline →
  row removed.
- **Audit:** `call.start`.

### Flow B — Member receives an incoming call (PRODUCT.md §3 flow 2)
- **Screens:** `ScreenApp.tsx` + `OverlayIncomingCall.tsx`
- **Path:** Open `CallSession` with this device as callee → overlay renders
  with caller's display name + Accept / Reject. Accept → `callSessions.connect()`
  emits `call.connected`. Reject → `callSessions.end(reason: 'declined')`
  emits `call.end`.
- **States:** no incoming (idle) · ringing (overlay) · accepted (transition
  to ScreenActiveCall) · declined / no-answer (overlay auto-dismiss).
- **Errors:** forbidden-by-role → server-side auto-reject path emits
  `call.end` with `endReason: 'forbidden-by-role'` (Wave 4 §11 reconciliation).
- **Audit:** `call.connected` or `call.end`.

### Flow C — Admin assigns a device's call role (PRODUCT.md §3 flow 4)
- **Screens:** `ScreenAdminMembers.tsx` (devices list) +
  `OverlayCallRoleAssign.tsx`
- **Path:** Admin row → set role overlay (Both / Caller / Receiver) → save →
  `devices.setRole(id, role, adminUserId)` writes `{from, to}` into the
  audit payload (Wave 6 housekeeping) → pub/sub tick re-renders the
  directory for every open tab.
- **States:** unchanged row · overlay open · saving · saved (overlay
  closes, Pill updates).
- **Errors:** role unchanged → no-op write, no audit emit.
- **Audit:** `device.role.assign` (only when `from !== to`).

### Flow D — First-join device naming (PRODUCT.md §3 flow 6)
- **Screens:** `ScreenApp.tsx` + `OverlayNamePicker.tsx`
- **Path:** Device created with empty `displayName` → auto-trigger overlay
  on first render (`refreshKey` cache invalidation after mutation) → user
  types name → `devices.setDisplayName(id, name)` routes the audit emit:
  empty-prior → `device.first_join`; subsequent rename → `device.rename`
  with `{from, to}` (Wave 6 housekeeping — single emit, never both).
- **States:** overlay open (forced) · typing · saving · saved (overlay
  closes; directory updates via pub/sub).
- **Errors:** empty submit → re-prompt; >24 chars → client truncates.
- **Audit:** `device.first_join` then `device.rename` thereafter.

### Flow E — LAN-anonymous-admin login (PRODUCT.md §3 flow 18)
- **Screens:** `ScreenAdminLogin.tsx`
- **Path:** Hit any admin route while `adminSession.current() === null` →
  redirected to login screen → enter passphrase → `adminSession.login()`
  sets the single-row session and emits `lan.admin.login.success` (or
  `.fail` for wrong passphrase). Logout from any admin screen emits
  `lan.admin.logout`.
- **States:** empty form · typing · submitting · error banner · redirect
  on success.
- **Errors:** wrong passphrase → generic "Couldn't sign in" + audit
  `lan.admin.login.fail` (anti-enumeration).
- **Audit:** `lan.admin.login.success` | `lan.admin.login.fail` | `lan.admin.logout`.

### Flow F — Invite member by email (PRODUCT.md §3 flow 12)
- **Screens:** `ScreenAdminInvitations.tsx` + `ScreenJoinByInvite.tsx`
- **Path:** Admin → Invites → enter email → `invitations.create(tenantId,
  email, invitedByUserId)` emits `invitation.create` with 7-day expiry →
  row appears with status chip (pending / accepted / expired / revoked).
  Deep-link `join-invite:<id>` opens the join screen → `invitations.accept`
  emits `invitation.accept` and creates a `User` row.
- **States:** empty list · sending · row with status · expired (Pill
  swaps tone) · resend / revoke menu.
- **Errors:** duplicate email in tenant → sim returns `null` and surfaces
  inline "Member already exists" (anti-enumeration silent for cross-tenant
  in Phase 4).
- **Audit:** `invitation.create` · `invitation.resend` · `invitation.revoke`
  · `invitation.accept`; on accept also `user.create`.

### Flow G — Manage devices (PRODUCT.md §3 flow 14 analog)
- **Screens:** `ScreenAdminMembers.tsx` (filter pills + row menu)
- **Path:** Admin → Members → filter pills (All / Online / Archived) drive
  `devices.list()` filtering → row menu actions: rename (modal),
  `devices.archiveOne(id, adminUserId)` (singular admin action) emits
  `device.archive`; nightly cron is simulated by an exposed
  `devices.archive(olderThanDays)` that emits `device.archive.batch` with
  `{count, olderThanDays}` (Wave 9 split preserved).
- **States:** filtered list · row hover · row menu open · archived empty
  state · unarchive on reconnect.
- **Errors:** archiving the device that just made a call within the
  presence window is allowed (no in-call guard in sim; Phase 4 must add).
- **Audit:** `device.archive` (admin manual) vs `device.archive.batch`
  (server cron); `device.unarchive` on reconnect.

### Flow H — Audit view (read-only) (governance surface)
- **Screens:** `ScreenAdminAudit.tsx`
- **Path:** Admin → Audit → `auditLog.recent(tenantId, 200)` returns
  reverse-chrono rows → action chip + actor chip (resolved via
  `users.byId` then `devices.byId`, fallback `LAN admin`) + relative
  timestamp + expandable JSON payload → filter pills by action prefix
  (`device.*` / `invitation.*` / `lan.*` / `user.*`) + full-text search
  over action name and payload JSON.
- **States:** empty (no actions yet) · loaded list · filtered subset ·
  search miss · payload expanded.
- **Errors:** none — read-only.
- **Audit:** emits nothing (governance surface only).

### Flow I — Tenant export (PRODUCT.md §3 flow 15)
- **Screens:** `ScreenAdminExport.tsx`
- **Path:** Admin → Export → Request → `tenantExports.request()` enqueues
  an `ExportJob` (status `queued`) and emits `tenant.export.requested` →
  sim BullMQ delay (1.5s) flips status to `processing` then `ready` and
  emits `tenant.export.ready` with `{payloadBytes, expiresAt}` → row shows
  size + countdown to 24h expiry + signed URL stub. Download → opens
  signed URL stub in a new tab + emits `tenant.export.downloaded` and
  records `downloadedAt`. Expiry is checked lazily on read; status flips
  to `expired` when `expiresAt < now`.
- **States:** no exports · queued · processing (animated Pill) · ready ·
  downloaded · expired.
- **Errors:** download on non-ready → button disabled; download on
  expired → no-op + sim status update.
- **Audit:** `tenant.export.requested` · `tenant.export.ready` ·
  `tenant.export.downloaded`.

---

## 5. Simulated → Production Swap Boundary

Phase 4 replaces ONLY the right-hand column. The UI imports
(left column) MUST NOT change.

| UI imports from `@/lib/sim` | Phase 4 production binding |
|---|---|
| `tenants.{list, byId, bySlug, create, updateBranding, setAdminPassphrase}` | tRPC `tenant.*` procedures backed by Prisma |
| `users.{list, byId, byEmail, create, setRole, suspend, remove}` | tRPC `user.*` + Auth.js v5 (Credentials provider) |
| `devices.{list, online, byId, create, setDisplayName, setRole, touch, archiveOne, archive, unarchive, remove}` | tRPC `device.*` procedures + Valkey pub/sub for the 5s role-broadcast SLO |
| `callSessions.{list, byId, start, connect, end}` | tRPC `call.*` procedures + WebSocket signaling (offer / answer / ICE) + Valkey pub/sub for cross-instance fan-out |
| `invitations.{list, byId, create, resend, revoke, accept}` | tRPC `invitation.*` procedures + BullMQ `email.send` worker (SMTP) |
| `auditLog.{append, recent, all}` | Prisma `auditLog.create` (server-side only — never write from UI) + tRPC `audit.recent` query |
| `adminSession.{current, login, logout}` | HttpOnly cookie `yelli_admin_session` (Argon2id passphrase verify; 30-day rolling; `SameSite=Lax`; `Secure` on HTTPS) |
| `tenantExports.{request, list, byId, markDownloaded}` | tRPC `tenantExport.*` + BullMQ `tenant.export` worker → S3 / MinIO `exports/<tenantId>/<jobId>.json` + signed URL valid 24h + SMTP email to requesting admin |
| `subscribe(table, cb)` | tRPC subscription + WebSocket per-tenant channel; signature unchanged |
| `seedDefaults` / `forgetSeedFlag` / `clearAll` | NOT carried to Phase 4 — dev-only fixtures via Prisma `seed.ts` |
| `clock.{now, advance, reset}` | `now()` becomes `new Date().toISOString()` server-side; `advance`/`reset` removed |

**Hard constraints for the swap:**
1. The `@/lib/sim` barrel is the **only** module a UI file imports from for
   data. No screen reaches into `repo.ts` / `storage.ts` / `clock.ts`
   directly. Verified Wave-by-Wave; Phase 4 import scope check must
   re-verify.
2. Audit-action vocabulary (§3 above) is locked. Phase 4 tRPC procedures
   MUST emit the same action strings with the same payload keys.
3. Status machines are locked: device (`archived | active`), invitation
   (`pending | accepted | expired | revoked`), export job (`queued →
   processing → ready → expired`).
4. `tenantExports` payload bytes + expiry semantics are stub-quality;
   Phase 4 worker computes real size from the streamed JSON and writes the
   real S3 presigned URL.

---

## 6. Out of Scope (intentionally NOT prototyped)

- Real WebRTC media — `ScreenActiveCall` is a UI shell; no peer connection,
  no ICE, no mic/cam access. Phase 4 wires `simple-peer` against the
  WebSocket signaler.
- Real SMTP / Web Push — invitations and call notifications emit audit
  rows but do not send mail or push. Phase 4 wires BullMQ `email.send` and
  the `WebPushSubscription` worker.
- Real passphrase hashing — `adminSession` stores a boolean flag only;
  the actual Argon2id verify lives server-side in Phase 4.
- Real role-broadcast fan-out across signaling instances — sim uses
  in-tab pub/sub. Phase 4 publishes to Valkey on every `device.setRole`
  and the WebSocket layer fans out to all instances.
- Cron — `devices.archive(olderThanDays)` is callable but never auto-runs
  in the sim. Phase 4 schedules a daily 03:00 UTC BullMQ repeatable job.
- Cloud-tenancy onboarding flows (sign-up, email verification, tenant
  provisioning). Sim seeds a single tenant at boot.

---

## 7. Verification

- **TypeScript:** `cd prototype && npx tsc --noEmit` → exit 0 (every wave).
- **Walkability:** all 9 §3 flows above are reachable from the seeded
  state in <5 clicks; tested manually after every wave commit.
- **Audit vocabulary parity:** the action list in §3 is grep-able across
  `repo.ts` (single source) and matches `docs/PRODUCT.md` §11 canonical.
- **Swap-boundary discipline:** UI screens import only from
  `@/lib/sim` (barrel) — no direct reach into `repo.ts` / `storage.ts`.
  Phase 4 import scope check re-verifies this contract.

---

## 8. Outstanding for Gate-Closure

- [ ] `/design-review` against finalized tokens (regression vs PA
  `docs/MOCKUP.jsx` + `docs/DESIGN.md`) — must return green; resolve any
  flags via `/design-refine` (surgical, flagged-only).
- [ ] Client sign-off recorded in `docs/DECISIONS_LOG.md` (date, scope,
  deferrals, divergences).

Once both items land, Phase 3.3 closes and Phase 3.5 (Execution Plan)
begins.
