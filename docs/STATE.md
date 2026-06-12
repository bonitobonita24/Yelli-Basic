# Project State — Yelli
# Auto-generated. Never edit manually.

## Current State — Clean-Slate Scaffold-then-Wire (swarm/rebuild · W1a complete → W1b NEXT, 2026-06-12)

> **W1a DONE (this session, 2026-06-12).** Wire A backend HALF (per the resolved q-W1-05 split): the
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
  5. **W2–W8** — remaining wire sessions (tenancy-members, calling/WebRTC, invitations, branding+storage,
     audit, PWA, pre-production validation). W4/W1/W2/W3 keep the §11 audit vocab VERBATIM. packages/storage
     (branding MIME whitelist) lands with the branding wire session. W8 = 9 §3 flows end-to-end + Phase 5
     re-run + Visual QA.
  Output Equivalence: the scaffold-then-wire rebuild must reproduce the proven decisions in DECISIONS_LOG.md
  and the 9 signed-off §3 flows in PROTOTYPE.md — nothing is re-decided, only re-built.

BLOCKERS:     None. W1a (Wire A backend + providers) is COMPLETE and committed; W1b (UI port) is unblocked —
              dispatch it next (it depends on the W1a tRPC hooks + mounted providers). Remaining skeleton
              TODOs are the later W-series' work, not blockers: Auth.js authorize() (accounts-auth wire),
              LAN-admin argon2 verify (W6), proxy redirect logic, the 5 still-`_placeholder` routers
              (call/tenants/invitations/audit/brand → W2–W7), and the 30s Valkey freshness cache.

GIT_BRANCH:   swarm/rebuild. S4a-2 adds 1 atomic commit (17 primitives + tokens.ts + parity test + vitest
              config + apps/yelli/package.json + pnpm-lock.yaml + pnpm-workspace.yaml catalog bump + 3
              governance docs). The human reviews and pushes — the worker never pushes.
              Recent commits:
  - `1eb2ae4` feat(phase-4-S4a): Scaffold Part 5 (app foundation) — apps/yelli Next.js 16 shell + design tokens
  - `c3b818c` feat(phase-4-S3): Scaffold Part 4 — packages/ui + packages/jobs
  - `5e0b58c` feat(phase-4-S2): Scaffold Part 3 — packages/db (Prisma schema + migration)
  - `9328eb5` feat(phase-4-S1): Scaffold Parts 1-2 — root config + packages/shared
  - `dddb647` feat(phase-4-S0): Re-baseline + inputs.yml regen (Bootstrap)
  - `2a5b1dc` chore(phase-3.3): client sign-off + STATE.md gate-closure

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
