# Project State — Yelli
# Auto-generated. Never edit manually.

## Current State — Phase 3.5 COMPLETE · Phase 4 ready for human approval (2026-06-11)

PHASE:        Phase 3.5 — **COMPLETE**. Execution Plan generated at `.cline/tasks/execution-plan.md` (136L).
              9 sessions scheduled, each ≤80K SAFE context budget. Brownfield-aware (Phase 4 Parts 1–8
              already BUILT in May 2026 V31 adoption — actual remaining work is the prototype→production
              wiring V32.6 was designed to gate).

              **Next phase: Phase 4 — begins with session 4.1 in a fresh Claude Code session after human
              reviews the plan.**

LAST_DONE:
  - **Phase 3.5 Execution Plan (this session)** — generated `.cline/tasks/execution-plan.md`:
      Complexity Profile (8 entities + 3 Auth.js; 8 modules; 9 §3 flows; 6 BullMQ queues; hybrid LAN+Cloud;
      WebRTC+WebSocket+Valkey pub/sub; PWA-only — bucket MEDIUM).
      Brownfield BUILT State (Parts 1–8 scaffolded; 4 Phase 3.3 deferrals open).
      9-session schedule with dependency graph: 4.1 Foundation → 4.2 Swap-Devices+Auth → 4.3 Swap-Calling
      (⚠ AT RISK) → 4.4 Swap-Tenancy+Members → 4.5 Swap-Audit+Branding → 4.6 BullMQ-workers →
      4.7 PWA+Web-Push → 4.8 Design-finalization → 4.9 Pre-production-validation.
      Per-session pre-flight (Smart Hydration + wc -l + Opus-inline R1 deviation fallback documented).
      Skill activation schedule + Output Equivalence Guarantee + human hand-off contract.
  - **CHANGELOG_AI.md appended** — Phase 3.5 entry with full V32 rule-compliance audit
    (R1/R2/R6/R7/R8/R9 results documented; PRODUCT.md Scout rejection + ctx_execute_file recovery noted).
  - **3 Scout dispatches (R6/R7)** — parallel fan-out for PRODUCT.md + DECISIONS_LOG.md + IMPLEMENTATION_MAP.md.
    PRODUCT.md Scout REJECTED by V32.1 baseline-overhead regression; pivoted to `ctx_execute_file` sandbox
    extraction (raw bytes never entered Opus context — derived complexity profile only).

NEXT:
  1. **Human reviews `.cline/tasks/execution-plan.md`** (136L) and confirms the 9-session schedule.
     Options: "Start Part 4.1" (accept and begin) | "Split [session] further" | "Combine [A] and [B]"
     | "Show me [session] details".
  2. After approval → **open a FRESH Claude Code session** (Rule 24 fresh-context discipline) and say
     "Start Part 4.1" — Session 4.1 (Foundation finalization: shadcn init verify + Auth.js
     securityVersion wiring) begins.
  3. Each Phase 4 session ends with a STOP; human opens the next session fresh. After 4.9 ships and
     `phase-4-complete` tag is pushed → Phase 5 re-run + Phase 6 production wiring.

BLOCKERS:     none. Phase 3.5 hard gate cleared. Phase 4 unblocked pending human plan approval.

GIT_BRANCH:   main. This session adds 1 atomic commit (execution-plan.md + CHANGELOG_AI.md + STATE.md).
              Recent commits:
  - `[this session]` chore(phase-3.5): execution plan generated — 9 sessions, brownfield-aware
  - `2a5b1dc` chore(phase-3.3): client sign-off + STATE.md gate-closure
  - `51ebf48` chore(ci): move react-doctor workflow to repo root + pin action SHAs
  - `0b4f83e` chore: install react-doctor diagnostic skill in prototype
  - `402ef71` chore(phase-3.3): STATE.md checkpoint — design-review GREEN, sign-off pending

PORTS:        prototype dev server on 4838 (Phase 3.3 validated baseline retained for Phase 4 spot-checks).
              Phase 4 Session 4.9 validates against `localhost:46848` (apps/yelli dev port from inputs.yml).

MODELS:
  planning:   claude-code (Opus 4.7 — architect-only per V32 R1)
  execution:  claude-sonnet-4-6 via Claude Code (V32.1 baseline-overhead regression remains — Opus-inline
              fallback acceptable per standing pattern)
  governance: gemini-2.5-flash-lite

CHECKPOINT TYPE: full (1 file created + 2 governance files rewritten + 1 atomic commit this session)
LINES_TOUCHED: ~136 lines .cline/tasks/execution-plan.md (new) + ~32 lines CHANGELOG_AI.md (appended)
               + this STATE.md rewrite
FILES_TOUCHED:
  - .cline/tasks/execution-plan.md (NEW — Sonnet dispatch)
  - docs/CHANGELOG_AI.md (appended — R8 Opus allow-list)
  - docs/STATE.md (this file — R8 Opus allow-list)
TIER_CLASSIFICATION: Tier 1 — lightweight (3 files total, single mechanical Sonnet dispatch + 2 R8 Opus writes)
dispatch_ratio:
  sonnet_writes: 1     # .cline/tasks/execution-plan.md (NOT on R8 allow-list — mandatory dispatch)
  opus_writes: 2       # docs/CHANGELOG_AI.md + docs/STATE.md (both R8 allow-list)
  ratio: 0.5
  target: ≥ 3.0
  status: WARN — Phase 3.5 is intrinsically a 1-Sonnet-write phase (one plan file). Metric rebalances
                  starting at session 4.1 (each Phase 4 session has multiple Sonnet code writes vs
                  fewer Opus governance writes — target 3.0+ achievable per session).

V32 RULE COMPLIANCE THIS SESSION:
  R1 (Zero Opus Execution):    PASS — execution-plan.md (not on R8 allow-list) dispatched to Sonnet; only
                                STATE.md + CHANGELOG_AI.md written directly by Opus.
  R2 (File-Size Dispatch):     PASS — Sonnet task: single 136L mechanical write, no analysis (≪500L).
  R6 (Scout-Before-Plan):      PASS — 3 parallel Scouts for PRODUCT.md + DECISIONS_LOG.md +
                                IMPLEMENTATION_MAP.md. PRODUCT.md Scout REJECTED by V32.1 baseline-overhead
                                regression; recovered via ctx_execute_file sandbox extraction (raw bytes
                                never entered Opus context — only derived complexity profile).
  R7 (Default Parallel Fan-Out): PASS — 3 Scouts in single Opus response.
  R8 (Opus Write Allow-List):  PASS — only STATE.md + CHANGELOG_AI.md written directly by Opus.
  R9 (Dispatch Ratio Metric):  WARN @ 0.5 (intrinsic to Phase 3.5 shape — single plan file).

KNOWN STANDING ISSUES (carried into Phase 4):
  - V32.1 dispatch-layer regression (env-structural; falsified-as-session-accumulated 2026-06-09 per
    memory 10788). Sonnet subagents reject small prompts due to ~30-50K skill auto-load baseline.
    Standing fallback: Opus-inline R1 deviation when dispatch repeatedly fails. Each Phase 4 session
    pre-flight should attempt Sonnet dispatch first; document deviation in CHANGELOG_AI.md per Rule 15
    if fallback required.
  - 4 Phase 3.3 deferrals carry into Phase 4: (1) Flow E re-render no-op fix in session 4.2;
    (2-4) overlay heading semantics + next/font/google migration + hex→CSS-var wiring in session 4.8.
