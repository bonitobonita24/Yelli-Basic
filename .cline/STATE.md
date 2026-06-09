# Project State — Yelli
# Auto-generated. Never edit manually.

## Current State — Phase 3.3 Wave 8 Complete (V32.6.1 canary rebuild, 2026-06-09)

PHASE:        Phase 3.3 — Interactive Prototype & Simulation (Wave 8/N+ complete; Flow F Invite walkable; 6 of 9 §3 Core User Flows walkable: A Calling + B Receive + C Admin-Assigns-Role + D Register-Device + E LAN-Admin-Login + F Invite; audit-emit vocabulary §11-canonical, no new actions introduced this wave — `invitation.create`/`invitation.accept` and `user.create` already present in Wave 2B baseline).

LAST_DONE:    Phase 3.3 Wave 8 adds Flow F (PRODUCT.md §3 Flow F — cloud + LAN-account-mode admin invites a member by email; invited recipient accepts via simulated invitation link and joins the tenant). Tier 1 (~313L gross / ~313L net across 2 created + 2 modified — no deletions). CREATED `prototype/src/screens/ScreenAdminInvitations.tsx` (~150L) admin-gated screen: pending/accepted/expired Invitation list, email-input create form (7-day TTL handled by `sim.invitations.create` Wave-2B baseline), "Open link" deep-routes to ScreenJoinByInvite via new `go('join-invite:<id>')` deep-link protocol, "Revoke" calls `sim.invitations.expire`. On-demand `ensureAdminUser(tenantId)` helper synthesizes a stub admin User when seed mode is LAN-anonymous (no users seeded) so `invitations.create(tenantId, email, invitedByUserId)` has a valid `invitedByUserId` without changing the global seed mode — preserves Wave 7 admin-login + Wave 5 first-join walkability. CREATED `prototype/src/screens/ScreenJoinByInvite.tsx` (~120L) 3-phase state machine `review` → `accepted` | `invalid`; initial state computed in one `useMemo` (validates tenant scope, expiry, already-accepted); on accept provisions member User via `sim.users.create` if not already present then calls `sim.invitations.accept` (sim repo emits §11-canonical `invitation.accept` audit row). MODIFIED `prototype/src/app/page.tsx` (+33L): `Screen` union gains `'admin-invitations'` + `'join-invite'`; new `joinInviteId` state; `go()` parses `'join-invite:<id>'` protocol and pre-fills `joinInviteId` before transitioning; `'admin-invitations'` admin-gated via `adminSession.current()` mirroring Wave 7's single-source routing gate. MODIFIED `prototype/src/components/TenantTopBar.tsx` (-1L net): nav `items` swap stub `'members'`/`'orgSettings'` for the real routes `'admin-members'` + new `'admin-invitations'`. Sim audit emits unchanged. `cd prototype && npx tsc --noEmit` exits 0 first try (only 1 typecheck run). DISPATCH-LAYER REGRESSION: standing acceptance per Wave 7 falsification test (1-word `pwd` Sonnet dispatch REJECTED "Prompt is too long" at fresh-session start — environment-structural Sonnet baseline overhead, NOT session-accumulated context). No Sonnet dispatch attempted this wave per prior STATE.md NEXT-field standing recommendation. Fourth consecutive wave R1 deviation. No new lessons.md entry — same root cause + same mitigation as Wave 5's already-logged regression.

NEXT:         Wave 9 — Flow G Manage Devices full (PRODUCT.md §3 Flow G + Device entity). Wave 4B's `ScreenAdminMembers` is narrowed to Flow C call-role-assign scope only; Wave 9 should expand it (or add a sibling screen) with: archive/unarchive (`sim.devices.archive` already exists; needs `unarchive` if missing — verify in repo.ts), rename/displayName edit (sim path: `sim.devices.setDisplayName` already §11-canonical post Wave 6), remove/delete device (verify sim has it; if not, ADD with §11-canonical `device.remove {deviceId}` audit emit — flag for sim-repo Edit pre-flight), and an Archived filter pill that flips visible list to archived devices with Unarchive action. Estimated Tier 1 (~150-220L). Remaining flows post-Wave-9: H Audit View, I Tenant Export. Dispatch recommendation: continue Opus-inline R1 deviation acceptance (4 consecutive waves now); pursue framework-layer fix (skill auto-load budget) before attempting Sonnet dispatch again. Goal unchanged: all 9 §3 flows walkable + docs/PROTOTYPE.md + /design-review green + client sign-off → Phase 3.3 gate-closure → Phase 3.5.

BLOCKERS:     None for walkability or audit-vocab correctness. User can verify Wave 8 behavior end-to-end: (1) `cd prototype && npm run dev` → http://localhost:4838; (2) nav to admin via TenantTopBar "Members" → ScreenAdminLogin → passphrase `yelli-admin` (Wave 7) → ScreenAdminMembers; (3) nav to TenantTopBar "Invites" → ScreenAdminInvitations; enter email e.g. `sam@example.com` → "Send invite" → list shows `Pending` row with 7-day expiry date; `auditLog.list()` last entries: `{action:'user.create', payload:{...role:'admin'}}` (admin synthesized on first invite for LAN-anon seed) then `{action:'invitation.create', payload:{invitationId, email:'sam@example.com'}}`; (4) "Open link" on the pending row → ScreenJoinByInvite shows `review` phase with invited email; enter a name e.g. "Sam Reyes" → "Accept & join" → `accepted` phase; (5) back at "Invites" the row now shows `Accepted` with accepted date; `auditLog.list()` last entries: `{action:'user.create', payload:{...role:'member'}}` then `{action:'invitation.accept', payload:{invitationId}}`; (6) Revoke on a pending invitation → row flips to `Expired`; (7) accept/expire link → `invalid` phase ("This invitation is invalid, expired, or has been revoked."); (8) console verification: `localStorage.getItem('sim:invitations')`, `'sim:users'`, `'sim:auditLog'` reflect state. To reset: DevTools → Application → Clear site data → reload.

GIT_BRANCH:   main. Working tree clean post-commit `ac1a003`. Wave 8 = 1 commit so far: feat(phase-3.3): wave 8 — flow F (invite member by email) walkable. Smart Checkpoint governance writes (STATE.md + CHANGELOG_AI.md + IMPLEMENTATION_MAP.md) will land in the next commit after this entry.
PORTS:        base=46838 LOCKED for Yelli main app (Phase 4 onward). Prototype runtime port 4838 unchanged.
MODELS:
  planning:   claude-code (Opus 4.7 — Architect ONLY per V32 R1; Wave 8 R1-deviated under standing acceptance per Wave 7 STATE.md NEXT-field recommendation — no Sonnet dispatch attempted, fourth consecutive wave)
  execution:  claude-sonnet-4-6 (intended; Wave 8 deferred via standing acceptance, no dispatch attempt)
  governance: gemini-2.5-flash-lite
LINES_TOUCHED: ~313L gross / ~313L net across 2 created + 2 modified (prototype only).
CHECKPOINT_TYPE: full
FILES_TOUCHED:
  Wave 8 — Flow F impl (Opus inline — R1 DEVIATION):
  - prototype/src/screens/ScreenAdminInvitations.tsx (CREATED ~150L)
  - prototype/src/screens/ScreenJoinByInvite.tsx (CREATED ~120L)
  - prototype/src/app/page.tsx (MODIFIED +33L)
  - prototype/src/components/TenantTopBar.tsx (MODIFIED -1L net)
  - TODO (MODIFIED +1L marker line)
  Wave 8 — Governance (Opus allow-list, this checkpoint):
  - .cline/STATE.md (this entry — Wave 7 entry REPLACED)
  - docs/CHANGELOG_AI.md (Wave 8 entry PREPENDED above Wave 7 entry)
  - docs/IMPLEMENTATION_MAP.md (Phase 3.3 Wave 8 status updated; line 16 status + new ✅ Wave 8 bullet + duplicate Wave 8 entry in legacy-doc-anchor section + walkable count 5→6)
  Wave 8 — Drift review:
  - .cline/memory/lessons.md (NO new entry — same root cause + same mitigation as Wave 5's already-logged dispatch-layer regression; redundant; standing acceptance noted in CHANGELOG_AI Wave 8 dispatch ledger to preserve operator-visible evidence)
TIER_CLASSIFICATION: 1 — lightweight (4 files total, ~313L gross / ~313L net; would have been a single Sonnet dispatch had the dispatch layer worked)
DISPATCH_LEDGER (this session, Wave 8 only):
  Executor (Opus inline, no Sonnet attempt this wave): Opus 4.7 — SUCCEEDED, R1 DEVIATION DOCUMENTED IN COMMIT BODY ac1a003 + CHANGELOG_AI.md Wave 8 entry
dispatch_ratio:
  sonnet_writes: 0   (no Sonnet Edit/Write — dispatch deliberately skipped per standing acceptance)
  opus_writes:   ~7  (Wave-8 code: 4 Edit/Write ops; this checkpoint: ~3 governance Edits)
  ratio:         0 / 7 = 0
  target:        ≥ 3.0
  status:        FAIL (<1.0)
  trigger:       extends prior waves' lessons.md entry on V32.1 dispatch-layer regression (no NEW entry — same root cause + same mitigation; redundant). Standing acceptance per Wave 7's 1-word `pwd` falsification test result.
  root cause:    NOT Opus drift — same environment-structural Sonnet baseline overhead as Waves 5+6+7. Pursue framework-layer fix (skill auto-load budget) before retrying Sonnet path.
COMMIT_HASH: ac1a003 (code) + pending governance-checkpoint commit
