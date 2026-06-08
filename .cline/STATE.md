# Project State — Yelli
# Auto-generated. Never edit manually.

## Current State — Phase 3.3 Wave 5 Complete (V32.6.1 canary rebuild, 2026-06-09)

PHASE:        Phase 3.3 — Interactive Prototype & Simulation (Wave 5/N+ complete; Flows A + B + C + D walkable; first-join naming flow live).
LAST_DONE:    Phase 3.3 Wave 5 wires Flow D (Register Device — first-join naming) end-to-end against the Wave 2 sim layer. Discovery via two parallel Sonnet Scouts (R6/R7): Scout-MOCKUP located `OverlayNamePicker` at MOCKUP.jsx §1132-1147 (heading "What should we call you?", helper "This is the name your colleagues see when you appear in the directory.", placeholder "e.g. Maria", Cancel + Save buttons, `maxLength={30}`) with sidebar Edit-button trigger at §617 + conditional render at §661. Scout-PRODUCT discovered NO formal "Flow D" heading exists in §3 — first-join is embedded in Device entity defs + Calling Model summary; §11 audit enum DOES contain `device.first_join` (system event, actorUserId=null) but payload schema is undeclared (unlike `device.role.assign {from,to}` or `device.unarchive {restoredCallRole, archivedDurationDays}`); `Device.displayName ≤24 chars, locked after first set when global rename-lock=ON` (spec ≤24 wins over MOCKUP's 30 per Rule 28 priority 4 > 7); default `callRole='receiver'` immutable. CRITICAL FINDING: sim layer's `devices.create` already emits `device.create` (not §11-canonical `device.first_join`) — pre-existing audit-vocabulary gap deferred to Phase 4 backend swap. Wave 5 chose Path A (UI-explicit first-join emit) to avoid mid-wave sim refactor. CREATED `prototype/src/components/OverlayNamePicker.tsx` (64L, inline modal shell matching `OverlayIncomingCall.tsx` pattern — no ModalShell dep, no ButtonPrimary/Secondary helpers; controlled `<input>` with React state instead of MOCKUP's `defaultValue`; live `{trimmed}/24 characters` counter; `canSave` requires non-empty + changed; `canCancel` is `false` when `initialName.trim()` empty → first-join is mandatory; props `{ initialName; onSave; onClose? }`). MODIFIED `prototype/src/screens/ScreenApp.tsx` (+53/-5 = 48L net): added `useState`+`useEffect` imports, `OverlayNamePicker` import, `auditLog` import from sim barrel; added `refreshKey` state + reactive `useMemo` deps; added `useEffect` auto-trigger — when `myDevice.displayName.trim().length === 0` AND `overlay === null`, `setOverlay('namePicker')` (mandatory first-join semantics; won't fire in current seed because all devices have names, but fires correctly in genuine first-join scenarios); added `saveMyName` handler — IF `initialName.trim().length === 0` (first set), emit `auditLog.append({tenantId, actorUserId: myDevice.userId, action: 'device.first_join', payload: {name}})` THEN `devices.setDisplayName(myDevice.id, name)` (which trails its own `device.rename` emit — Wave 4B-style double-emit, flagged for housekeeping) THEN `setRefreshKey(k=>k+1)` THEN `setOverlay(null)`; replaced `{overlay === 'namePicker' && null}` stub with conditional render — branches on `displayName.trim().length > 0` to satisfy `exactOptionalPropertyTypes: true` (with-onClose branch passes onClose; without-onClose branch omits the prop entirely rather than passing `undefined`). The existing sidebar "You" card Edit button (line 166) continues to trigger picker on demand for already-named devices. UPDATED `TODO` from "[X] Say start wave 5" to mark Wave 5 done + queue Wave 6. Final state: `cd prototype && npx tsc --noEmit` exits 0. 4 of 9 §3 Core User Flows now walkable (A Calling + B Receive + C Admin-Assigns-Role + D Register-Device). Sim semantics gaps surfaced (deferred to Phase 4): (1) `sim.devices.setDisplayName` always emits `device.rename` regardless of first-set vs subsequent-rename — Wave 5 layered a second fully-specified `device.first_join` UI emit rather than refactor repo.ts mid-wave (matches Wave 4B double-`device.role.assign` pattern); (2) `sim.devices.create` already emits `device.create` instead of `§11`-canonical `device.first_join` on Device row creation — pre-existing gap, untouched by Wave 5. Phase 4 backend swap collapses both into a single §11-conformant audit row per Device row insert + rename.

NEXT:         Wave 6 — fifth Core User Flow. Recommended: Flow E (Login — LAN-anonymous-admin Argon2id passphrase per Step 6 spec) since LAN-mode anonymous admin gate is the next-most-foundational missing piece. Bundle eligible for parallel R7 housekeeping dispatch alongside Wave 6 main: collapse BOTH double-emit pairs in a single sim/repo.ts refactor — (a) `devices.setRole` add `from`-field + drop UI duplicate emit (Wave 4B), (b) `devices.setDisplayName` route first-set vs subsequent to `device.first_join` vs `device.rename` + drop UI duplicate emit (Wave 5). Combined ~30L sim refactor + ~10L cleanup = ~40L net, ideal R7 candidate IF the dispatch-layer regression is resolved first. Remaining flows F-I (Invite / Manage Devices full / Audit View / Tenant Export) per iterative waves. Goal unchanged: all 9 §3 flows walkable + docs/PROTOTYPE.md + /design-review green + client sign-off → Phase 3.3 gate-closure → Phase 3.5.

BLOCKERS:     None for walkability. User can verify Flow D: `cd prototype && npm run dev` → http://localhost:4838 → sidebar "You" card → "Edit" button → OverlayNamePicker opens with current `myName` prefilled → edit to new name → Save → directory re-renders with new displayName; audit log records `device.rename` (and `device.first_join` if prior name was empty — only fires in genuine first-join scenarios since seed populates all names). DISPATCH-LAYER REGRESSION discovered mid-wave (Wave 6 dispatch risk): multiple `Agent(model: "sonnet")` dispatch attempts at minimal prompt sizes (~300-1500 tokens) repeatedly returned "Prompt is too long" — V32.1 baseline-overhead failure mode (subagent inherits ~30-50K tokens of CLAUDE.md + skills + MCPs before any task prompt evaluation; the four reminder banners in this session likely inflated baseline further). Scout dispatches via `Agent(subagent_type: "Explore")` SUCCEEDED (lighter context profile); general-purpose executor dispatches all FAILED. Wave 5 execution fell back to Opus inline (V32 R1 deviation) for the ~112L net code change. Recommend before Wave 6: (a) try `Agent(subagent_type: "code-simplifier")` or `Agent(subagent_type: "Plan")` paths for executor dispatch, (b) verify CLAUDE.md skill-list reload after `LSP` MCP reconnection didn't bloat the inherited context, (c) measure exact baseline tokens via probe.

GIT_BRANCH:   main. Working tree clean post-commit `989f893`. Wave 5 = 1 commit: feat(phase-3.3): wave 5 — flow D (register device) walkable.
PORTS:        base=46838 LOCKED for Yelli main app (Phase 4 onward). Prototype runtime port 4838 unchanged.
MODELS:
  planning:   claude-code (Opus 4.7 — Architect ONLY per V32 R1; Wave 5 R1-deviated due to dispatch-layer regression — see BLOCKERS)
  execution:  claude-sonnet-4-6 (intended; Wave 5 dispatch-layer-blocked)
  governance: gemini-2.5-flash-lite
LINES_TOUCHED: ~112L net new across 3 files (1 component CREATED + 1 screen MODIFIED + 1 TODO MODIFIED).
CHECKPOINT_TYPE: full
FILES_TOUCHED:
  Wave 5 — Flow D Register Device (Opus inline — R1 DEVIATION):
  - prototype/src/components/OverlayNamePicker.tsx (CREATED, 64L)
  - prototype/src/screens/ScreenApp.tsx (MODIFIED +53/-5 = 48L net)
  - TODO (MODIFIED +1/-0)
  Wave 5 — Discovery (Sonnet Scouts via Agent(subagent_type: "Explore") — R6):
  - Scout A: MOCKUP.jsx §1132-1147 + §617 + §661 (OverlayNamePicker JSX + trigger + render site) — SUCCEEDED
  - Scout B: PRODUCT.md §3 + §11 (Flow D existence check + audit enum entry) — SUCCEEDED
  Wave 5 — Governance (Opus allow-list, this checkpoint):
  - .cline/STATE.md (this entry)
  - docs/CHANGELOG_AI.md (Wave 5 entry appended)
  - docs/IMPLEMENTATION_MAP.md (Phase 3.3 Wave 5 status updated)
  Wave 5 — Drift review (R9-mandated FAIL handling):
  - .cline/memory/lessons.md (🔴 gotcha entry on V32.1 dispatch-layer regression at small prompt sizes — full executor failure, not just WARN drift)
TIER_CLASSIFICATION: 1 — lightweight (3 files, ~112L; would have been a single Sonnet dispatch had the dispatch layer worked)
DISPATCH_LEDGER (this session):
  Scout A (MOCKUP §1132-1147 + §617 + §661):              Sonnet via Agent(subagent_type:"Explore") — SUCCEEDED
  Scout B (PRODUCT.md §3 + §11):                          Sonnet via Agent(subagent_type:"Explore") — SUCCEEDED
  Executor attempt 1 (general-purpose, ~1.5K prompt):     Sonnet via Agent(model:"sonnet") — REJECTED "Prompt is too long"
  Executor attempt 2 (general-purpose, ~1K prompt):       Sonnet via Agent(model:"sonnet") — REJECTED "Prompt is too long"
  Executor attempt 3 (general-purpose, ~700-token prompt): Sonnet via Agent(model:"sonnet") — REJECTED "Prompt is too long"
  Executor attempt 4 (general-purpose, ~600-token prompt): Sonnet via Agent(model:"sonnet") — REJECTED "Prompt is too long"
  Executor fallback (Opus inline):                        Opus 4.7 — SUCCEEDED, R1 DEVIATION DOCUMENTED IN COMMIT BODY + lessons.md
dispatch_ratio:
  sonnet_writes: 0   (no Sonnet Edit/Write succeeded this session — dispatch-layer-blocked)
  opus_writes:   ~8  (Wave-5 code: 1 Write + 3 Edits + 1 TODO Write; this checkpoint: ~4 governance Edits — full count after checkpoint completes)
  ratio:         0 / 8 = 0
  target:        ≥ 3.0
  status:        FAIL (<1.0)
  trigger:       lessons.md drift review entry (R9-mandated) — see "V32.1 dispatch-layer regression at small prompt sizes" entry
  root cause:    NOT Opus drift — dispatch-layer rejection cascade. Documented separately so R9 metric retains its signal for genuine future drift events.
COMMIT_HASH: 989f893
