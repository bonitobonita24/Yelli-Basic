# CHANGELOG_AI

## Current State — Post Clean-Slate (V32.6.1 canary rebuild, 2026-06-07)

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
- Commit:              [pending — atomic commit after this entry lands]
