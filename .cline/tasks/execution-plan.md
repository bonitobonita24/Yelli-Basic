# Phase 4 Execution Plan — Yelli (V32.6 brownfield-aware)

**Generated:** 2026-06-11 by Phase 3.5
**Phase 3.3 status:** CLOSED 2026-06-11 (commit `2a5b1dc`). 9/9 §3 Core User Flows walkable in `prototype/`; design-review GREEN-AFTER-REFINE 94/100; client sign-off in `docs/DECISIONS_LOG.md`.
**Brownfield reality:** Standard Phase 4 Parts 1, 2, 3, 4, 5 (scaffold), 7, 8 are **already BUILT** from the May 2026 V31 adoption (see IMPLEMENTATION_MAP.md). The work below is the **prototype→production wiring** phase that V32.6 was designed to gate.

---

## Complexity Profile

| Metric | Value | Bucket |
|--------|-------|--------|
| Domain entities | 8 (Tenant, User, Device, Invitation, AuditLog, CallSession, WebPushSubscription) + 3 Auth.js-managed (Session, VerificationToken, Account) | SMALL |
| Modules (§2 Modules + Features) | 8 (Calling, Directory, Device Identity, Accounts & Auth, Tenancy & Members, Branding, Admin Console, PWA + offline) | SMALL |
| Core user flows (§3) | 9 (all walkable in prototype) | — |
| Pages (PRODUCT.md Mobile Needs table) | ~15 mobile-first | SMALL/MEDIUM |
| BullMQ queues | 6 (tenant-export, device-archive, soft-delete-cron, backup, email, logo-image) | MEDIUM |
| Integrations | Auth.js v5, Resend (Cloud email), MinIO/S3 (logos), coturn (TURN), Valkey (cache + pub/sub + BullMQ) | MEDIUM |
| Native mobile | none — PWA only | — |
| Tenancy | hybrid (Cloud multi via subdomain + LAN single implicit) | — |
| Cross-cutting subsystems | WebRTC + WebSocket signaling + Valkey pub/sub bus; AuditLog L5 always-on; L6 tenant-guard Prisma extension | HIGH |
| **Overall bucket** | **MEDIUM** (entity count is SMALL but cross-cutting realtime + dual-edition deployment + 6 BullMQ workers push effective complexity up) | — |

## Brownfield BUILT State (from IMPLEMENTATION_MAP.md, verified 2026-06-11)

✅ Already scaffolded — Phase 4 sessions edit/extend, do NOT recreate:

- Root config (pnpm-workspace, turbo, tsconfig.base, eslint, prettier, .nvmrc=22)
- `packages/db/` Prisma schema (10 models, 4 enums, L2 RLS + L5 audit model + L6 guard extension), migration 0001
- `packages/shared/` types + Zod validators + 18-reserved-slugs constant + `phantom-ui@0.10.1` exact pin
- `packages/jobs/` BullMQ queue definitions (6 queues) + worker stubs
- `packages/ui/` Tailwind preset + `cn()` helper (no shadcn primitives wired yet)
- `apps/yelli/` Next.js 16 scaffold: 17 shadcn primitives present in `prototype/` (Phase 4 imports actual primitives); Auth.js v5 Credentials provider; tRPC v11 with 7 routers + 5 middleware; V25 anti-tenant-switching `proxy.ts`
- `prototype/` (Phase 3.3): Next.js 14 + Tailwind + 6 sim namespaces (`devices`, `callSessions`, `users`, `tenants`, `invitations`, `auditLog`) + 9 walkable §3 flows
- `deploy/compose/` (20 files, 3 envs) + `start.sh` + `push.sh`
- CI: `.github/workflows/ci.yml`, `docker-publish.yml`, `MANIFEST.txt`, `.socraticodecontextartifacts.json`

🟡 Open from Phase 3.3 sign-off (4 deferrals → must land in Phase 4):

1. Flow E LAN-admin-login UI gate re-render no-op — production fix requires tRPC session query + react-query invalidation (structurally different from prototype).
2. Overlay `aria-labelledby` targets → promote eyebrow `<div>` to semantic `<h2>` in `OverlayIncomingCall` + `OverlayCallRoleAssign`.
3. Font loading: migrate `@import` → `next/font/google` (FOUT prevention, self-hosting, preload).
4. Token consumption: wire shadcn theme to `globals.css` CSS vars; eliminate inline hex literals in production components.

🔴 Known V32.1 dispatch-layer regression (env-structural, NOT session-accumulated; falsified by Wave 7 fresh-session test on 2026-06-09): Sonnet subagents inherit ~30–50K skill auto-load before any task work, causing thrash on small prompts. **Accepted standing pattern: Opus-inline R1 deviation when dispatch repeatedly fails.** Each session below uses minimum-viable prompts; if Sonnet rejects, fall back to Opus inline write and log the deviation in CHANGELOG_AI.md per Rule 15.

---

## Phase 4 Session Schedule (9 sessions, all ≤80K SAFE)

Each session: fresh Claude Code, reads STATE.md first, runs Smart Hydration (V32.3) on only the docs it needs, builds, runs targeted tests, Smart Checkpoint, commits, STOPS.

| # | Session label | Scope | Est. files | Est. context | Risk |
|---|---------------|-------|-----------|-------------|------|
| 4.1 | **Foundation finalization** | Verify `npx shadcn@latest init` ran in `apps/yelli/`; install missing primitives if any; finalize User.securityVersion wiring in Auth.js callback per security.md §AUTH DEFAULTS #6 | 8 | ~50K | ✅ SAFE |
| 4.2 | **Swap A — Devices + Auth surface** | Replace `prototype/src/lib/sim/devices.ts` consumers with real tRPC `devices` router calls in `apps/yelli/`; wire `users` ownership; rebuild LAN admin gate to read real session (FIX deferral #1: Flow E re-render no-op via tRPC session query + react-query invalidation) | 10 | ~70K | ✅ SAFE |
| 4.3 | **Swap B — Calling subsystem** | tRPC `calls` router (key MUST be `calls`, not `call` — schema lock); WebSocket signaling server; Valkey pub/sub bus for cross-instance role-change broadcast + session.invalidate at 30s SLO; CallSession persistence with role snapshots | 12 | ~75K | ⚠ AT RISK (largest single session — split if pre-flight `wc -l` >500L per Sonnet task) |
| 4.4 | **Swap C — Tenancy + Members + Invitations** | tRPC `tenants` + `invitations` routers; Cloud subdomain → tenantId resolution at proxy layer; V25 anti-tenant-switching cross-check; invitation email queue trigger | 9 | ~65K | ✅ SAFE |
| 4.5 | **Swap D — Audit + Branding** | tRPC `audit` router with §11-canonical action vocabulary verbatim (HARD CONSTRAINT from DECISIONS_LOG); `tenant.brand.update` with MinIO/S3 logo upload (PNG/JPEG MIME whitelist); audit middleware injects on every mutation | 8 | ~55K | ✅ SAFE |
| 4.6 | **BullMQ workers** | Implement 6 queue workers: `tenant-export` (S3 + 24h signed URL), `device-archive` (daily 03:00 UTC cron — 90d offline auto-archive + `device.unarchive` on reconnect), `soft-delete-cron` (7d→hard-delete), `backup` (daily 02:00 UTC pg_dump → S3 30d/Glacier IR 7d), `email` (verify/reset/invite via Resend), `logo-image` (resize + format) | 10 | ~70K | ✅ SAFE |
| 4.7 | **PWA + Web Push + offline** | Service Worker; install banner (2nd visit, 30d snooze, iOS Safari fallback); Web Push subscription endpoint + tap-to-open (no action buttons); cached-shell offline UX + UUIDv7 replay queue (24h Valkey dedup); `pwa.install` audit emit | 9 | ~60K | ✅ SAFE |
| 4.8 | **Design system finalization** (Phase 3.3 deferrals #2-#4) | `@import` font → `next/font/google` migration; eyebrow `<div>` → `<h2>` a11y promotion in `OverlayIncomingCall` + `OverlayCallRoleAssign`; hex literal → CSS var wiring throughout production components; `/design-review` regression pass vs `docs/MOCKUP.jsx` baseline | 7 | ~45K | ✅ SAFE |
| 4.9 | **Pre-production validation** | Walk all 9 §3 flows end-to-end against the real backend (no sim layer); verify audit vocabulary matches §11-canonical exactly; Phase 5 re-run (9 commands); Phase 6 Visual QA at `localhost:46848`; commit + tag `phase-4-complete` | 5 | ~50K | ✅ SAFE |

**Total sessions:** 9
**Cumulative est. work:** ~78 files touched/created, ~540K cumulative context across all sessions (vs ~250K if linear single-session — splits absorb ~3× the safe budget, which is the point).

### Dependency graph

```
4.1 (foundation)
  ├→ 4.2 (Devices+Auth)
  │    ├→ 4.3 (Calling — needs auth + device identity)
  │    ├→ 4.4 (Tenancy+Members — needs auth)
  │    └→ 4.5 (Audit+Branding — needs auth context for actor)
  ├→ 4.6 (BullMQ — independent of 4.3/4.4/4.5 once schemas locked)
  └→ 4.7 (PWA — independent of swap sessions)
4.8 (design finalization — runs after any UI-touching swap session)
4.9 (validation — strictly last)
```

Sessions 4.3, 4.4, 4.5, 4.6, 4.7 can run in any order after 4.2 (no shared mutation surface beyond schema). 4.8 must run AFTER all UI-touching swaps. 4.9 is the gate.

### Per-session pre-flight (mandatory every session)

1. Read `docs/STATE.md` first (orientation).
2. Run V32.3 Smart Hydration over the 9 governance docs (Scout-Sonnet for any >200 lines).
3. Run `wc -l` on all files in scope; total ≤ 500 lines per Sonnet dispatch (V32 R2).
4. Files >300 lines need explicit line ranges (V32 R3).
5. If dispatch repeatedly fails (V32.1 regression), Opus-inline fallback with R1 deviation logged.
6. After session: Smart Checkpoint (§2 of memory-governance.md) — STATE.md + memory entry + lessons.md if 🔴 surfaced.

### Read rules per session (token budget enforcement)

- **Read** ONLY the PRODUCT.md sections relevant to the session's scope (use line offsets from `ctx_execute_file` to slice).
- **Never** read full PRODUCT.md (621 lines, ~73K chars).
- Source files: use `codebase_search` (Rule 17) first; open files only when search results point to specific paths.
- 9 governance docs: hydrate via V32.3 Smart Governance Hydration schema — never raw-read >200L docs.

---

## Skill Activation Schedule

Primary Group (already installed — Skillpilot install 2026-05-31):
- ✅ skillpilot, owasp-security, git-pushing, test-fixing, review-implementing, varlock

MCP servers (already wired):
- ✅ socraticode, context7

**Per-session additions (run `/scan-project` at each phase transition; install only what audit recommends and you approve):**

| Session | Add (if not installed) | Why |
|---------|------------------------|-----|
| 4.1, 4.2 | `superpowers` bundle (TDD + verification + dispatch discipline) | Foundation work needs TDD enforcement |
| 4.2, 4.4, 4.5 | `postgres` | Read-only query to verify schema state post-migration |
| 4.7, 4.8 | `oiloil-ui-ux-guide`, `playwright-skill`, `react-doctor`, `designer-skills` | UI delta + regression `/design-review` against `docs/MOCKUP.jsx` (V32.5 INHERIT-not-REPLACE) |
| 4.9 | `test-fixing` (already installed) + `react-doctor` | Final React audit + smart error grouping |

Conditional: `code-review-graph` — install once via `claude plugin add tirth8205/code-review-graph` if not yet present; run `code-review-graph build` from WSL2 before 4.2 for blast-radius analysis on all subsequent swap sessions.

---

## V32.6 Output Equivalence Guarantee

Splitting this work into 9 sessions produces the SAME final state as a single hypothetical session — except complete, because no module is lost to context overflow. Every entity in `docs/PRODUCT.md` Data Entities, every flow in §3, every action in the §11-canonical audit vocabulary, every queue in BullMQ, every page in the Mobile Needs table MUST exist in the final codebase. Session boundaries are scoped by surface (router, queue, layer), never by arbitrary line cuts.

## Hand-off contract to human

After this plan is reviewed and approved:
- Human says "Start Part 4.1" in a fresh Claude Code session → Session 4.1 begins.
- Each session ends with a STOP and the human opens the next session fresh.
- After 4.9 completes and `phase-4-complete` tag is pushed → Phase 5 re-run + Phase 6 wiring → production cutover.

---

**End of Execution Plan.**
