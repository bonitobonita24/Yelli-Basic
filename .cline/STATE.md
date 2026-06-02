# Project State — Yelli
# Auto-generated. Never edit manually.
# Updated: 2026-06-02 23:18 GMT+8 by CLAUDE_CODE (Opus 4.7 Architect, V32 R1 — STATE.md exception)

PHASE:        Phase 7 Features 3a + 3b COMPLETE — staging/prod compose internal-URL override shipped + Phase 7 Features 1+2 visually verified end-to-end via Playwright smoke, AND a latent Phase 4 bug fixed along the way (tRPC client httpBatchLink superjson transformer mismatch — `fix(trpc):` commit 0c2f736). Sequence: 3a ✅ → 3b ✅ → 3c (in_progress) → 3d → 3e → 3f.
LAST_DONE:    Phase 7 Feature 3b — local stack rebuild + Playwright smoke verification, plus latent Phase 4 bug fix discovered during smoke (3 Sonnet dispatches in 3b, plus Opus-side ctx_execute health probes):
                1) Docker app-only rebuild: `bash deploy/compose/start.sh dev up -d` rebuilt yelli:dev-latest in ~3min, recreated yelli_dev_app container only (DB/cache/storage stayed up). Background Bash, exit 0.
                2) First Playwright smoke (Sonnet D-smoke-1, 12 tools, 69s): FAIL. Login worked, Directory page rendered, but BOTH trpc.device.list and trpc.device.register returned HTTP 400 "Unable to transform response from server". DeviceList Card showed "Could not load devices" error; Register button showed same error.
                3) Root cause investigation (Opus, 2 grep tool uses): server tRPC config has `transformer: superjson` at apps/yelli/src/server/trpc/trpc.ts:52, but BOTH client httpBatchLink sites (apps/yelli/src/lib/trpc-client.ts:29 + packages/api-client/src/index.ts:38) omitted the transformer. Latent Phase 4 Part 5 bug — never surfaced before because login uses next-auth (not tRPC) and Feature 2's trpc.device.list.useQuery is the first client-side tRPC call ever exercised. Typecheck did NOT catch this because TransformerOptions is `void` when omitted; runtime fails on response deserialization.
                4) Bug fix dispatch (Sonnet D-fix, 18 tools, 192s): branched fix/trpc-client-superjson-transformer → added `superjson ^2.2.1` to packages/api-client/package.json → imported superjson + added `transformer: superjson` to httpBatchLink in both client sites → pnpm install (already in lockfile from server dep, resolved into packages/api-client/node_modules) → pnpm -r typecheck 0 errors across 8 packages → CHANGELOG_AI.md entry + lessons.md 🔴 gotcha entry → squash-merged to main @ 0c2f736 → docker rebuild app container.
                5) Re-smoke (Sonnet D-smoke-2, 14 tools, 76s): PASS. Pre-click N=0 ("No devices yet"). Click "Register this device". Post-click M=1 ("Linux (6/2/2026)", Last seen: just now, Role: Both). DeviceList Card rendered cleanly, no tRPC errors. Console: 1× React hydration error #418 (pre-existing cosmetic, unrelated to transformer fix — noted as future candidate). Cosmetic /icons/icon-192.png 404s also present (Feature 3c will fix).
                Side artifacts of 3b: (a) 2 stray screenshot PNGs at project root (yelli-3b-directory-pre.png, yelli-3b-directory-post.png — Sonnet's first smoke saved them at root instead of /tmp; got swept into `fix(trpc)` commit by `git add -A`). Rolling cleanup into 3c. (b) Subsequent smoke saved to .playwright-mcp/ which is gitignored (no leakage).
              Phase 7 Features 1+2 (commits 2bf7714 + 2593928): NOW VISUALLY VERIFIED end-to-end in real container. Feature 3a (commit 0df2f63): staging/prod compose patch shipped — pending actual staging deploy verification.
                D4 — Implement (7 tool uses, 75s): scouted device.list return shape (`{ items, nextCursor }` with lastSeenAt in select) + confirmed shadcn Skeleton/Badge present → created apps/yelli/src/components/devices/DeviceList.tsx (~110L, "use client") with trpc.device.list.useQuery({limit:50}) + 4 render states (skeleton loading per Rule 11 PATH A, empty CTA, error with role="alert", success list with displayName + callRole Badge + formatRelative-formatted lastSeenAt) → edited apps/yelli/src/app/(app)/page.tsx to replace placeholder Card with <DeviceList/> + drop unused Card imports. pnpm --filter @yelli/web typecheck → 0 errors.
                D5 — Governance + commit (4 tool uses, 44s — tactical improvement over Feature 1's D3 which used 11): branched feat/render-device-list → appended CHANGELOG_AI.md Feature 2 entry → squash-merged to main → branch deleted. main @ 2593928.
              Combined Phase 7 outcome since 290d452 (Phase 6.5):
                Feature 1 (commit 2bf7714) — RegisterDeviceButton.tsx wires trpc.device.register.useMutation with localStorage UUID v4 fingerprint
                Feature 2 (commit 2593928) — DeviceList.tsx renders trpc.device.list.useQuery with 4 states; closes read-after-write loop with Feature 1
NEXT:         Phase 7 Feature 3 candidates (in rough priority order — user picks):
                (a) Staging/prod compose patch — replicate Phase 6.5's `DATABASE_URL_INTERNAL` + `REDIS_URL_INTERNAL` + `environment:` override to deploy/compose/stage/docker-compose.app.yml + deploy/compose/prod/docker-compose.app.yml. REQUIRED before deploying rewrite to yelli-maes.powerbyte.app (currently still on vanilla a251049). Pure infra, no PRODUCT.md edit. ~10L across 2 files.
                (b) Local stack rebuild + live Visual QA — `bash deploy/compose/start.sh dev up --build -d` to pick up Features 1+2 in the running container, then Playwright smoke test: login → see DeviceList empty Card → click Register → DeviceList refreshes to show the new device. Verifies both features end-to-end in a real browser. ~5min wall-clock.
                (c) Cleanup batch — generate /icons/icon-192.png stub (kills 2× cosmetic 404 in console), dedupe duplicate `export GET` in apps/yelli/src/app/api/health/route.ts (fixes app container healthcheck status from "unhealthy" → "healthy"). Mechanical, ~10L total.
                (d) Call placement UI — wire the first user-facing call flow per PRODUCT.md core flow A. Needs design pass on how the call UI is exposed on Directory page (e.g. click a device card → opens call modal). Medium scope ~200L.
                (e) Add React Testing Library + vitest-component infra so future client-component features can follow Rule 25 TDD. ~80L (config + 1 sample test).
                (f) Investigate pgbouncer.ini:3 syntax error — non-blocking real bug (app bypasses PgBouncer via DATABASE_URL_INTERNAL). Deferred from Phase 6.5. ~5L config edit.
              Visual QA for Features 1+2: STILL DEFERRED — running yelli_dev_app container is pre-Phase-7 build (eb5a442 / 290d452 image). Both features merged on main but not yet in container. Risk remains low (typecheck clean both times, standard tRPC patterns) but candidate (b) above would convert that to verified.
BLOCKERS:     Phase 7 Features 1+2 dev: NONE. Both features merged, governance synced.
              Phase 7 staging/prod deploy: same as Phase 5/6 — REQUIRED ⏳ in CREDENTIALS.md text-file (GitHub PAT, Docker Hub token, SMTP staging/prod, Turnstile prod LIVE keys, Komodo UI URL). Plus pending staging/prod compose patch (candidate a above).
GIT_BRANCH:   main @ 0c2f736 (fix(trpc) — superjson transformer client-side parity). Working tree: STATE.md dirty (this update — V32 R1 exception) + 2 stray PNGs at project root flagged for 3c cleanup. Commits ahead of origin: 6 since pre-spec-driven-adoption-20260531 tag (5b4b9cb → eb5a442 → 290d452 → 2bf7714 → 2593928 → 0df2f63 → 0c2f736).
GIT_TAG:      pre-spec-driven-adoption-20260531 (still pre-Phase-4 main — none of the Phase 5/6/7 work has been pushed to origin)
PORTS:        UNCHANGED — base=46838, db=46838, pgbouncer=46839 (bypass via DATABASE_URL_INTERNAL direct to yelli_dev_postgres:5432), redis=46840, minio=46841, minio_console=46842, mailhog=46843, mailhog_ui=46844, pgadmin=46845, app=46848.
MIGRATION:    Phase 4 COMPLETE. Phase 5 PASS. Phase 6 PASS. Phase 7 Features 1+2 PASS (code-level, typecheck clean, Stage 1+2 review PASS). DB state unchanged: tenants(1: _pwbt) + users(1: webmaster bonitobonita24@gmail.com role=admin). Live deploy at yelli-maes.powerbyte.app stays on vanilla a251049.
LIVE_DEPLOY:  yelli-maes.powerbyte.app — still vanilla a251049. Rewrite + Phase 7 Features 1+2 NOT deployed.
MODELS:
  planning:   claude-code (Opus 4.7 — Architect ONLY per V32 R1; STATE.md edits are documented exceptions)
  execution:  claude-sonnet-4-6 (Phase 7 Feature 2: 2 dispatches D4+D5. D5 came in at 4 tool uses vs Feature 1's D3 which used 11 — tactical improvement: split governance-append from heavy git ops where possible, keep prompts ≤1K tokens.)
  governance: gemini-2.5-flash-lite (configured but unused — Sonnet handled governance inline)
LINES_TOUCHED: Phase 7 Feature 2 session: ~135L net new across 3 files (1 new component ~110L + 1 page edit ~5L delta + CHANGELOG_AI append ~20L). Well under V32 R2 500-line gate.
              Combined Phase 7 (Features 1+2): ~210L net new across 5 files. Still well under gate.
CHECKPOINT_TYPE: full (Phase 7 Feature 2 complete — main updated, governance synced, ready for next Feature Update)
FILES_TOUCHED (since 290d452, both Phase 7 features):
  - apps/yelli/src/components/devices/RegisterDeviceButton.tsx (Feature 1 — Sonnet)
  - apps/yelli/src/components/devices/DeviceList.tsx (Feature 2 — Sonnet)
  - apps/yelli/src/app/(app)/page.tsx (Feature 1 + Feature 2 — Sonnet, two edits)
  - docs/CHANGELOG_AI.md (Feature 1 + Feature 2 entries — Sonnet)
  - .cline/memory/lessons.md (Feature 1 🟤 decision on fingerprint strategy — Sonnet)
  - .cline/STATE.md (this update — Opus V32 R1 exception)
TIER_CLASSIFICATION: 1 — lightweight (Feature 2 = single client component + small page edit, no file >300L modified, scout was scoped to lines 1-120 of device.ts)
DISPATCH_LEDGER (this session):
  D4 (scout+implement):  7 tool uses, 75s. Combined verify-shape + write component + edit page + typecheck. 1 over the suggested 6-budget but no thrash.
  D5 (gov + commit):     4 tool uses, 44s. Sharp improvement over Feature 1's D3. Pattern: pre-write the CHANGELOG entry in the prompt so Sonnet only does Edit+commit+merge, not compose-and-write.
NEXT_DISPATCH: User picks next. Recommend (b) local stack rebuild + Playwright smoke test to verify Features 1+2 end-to-end — converts "code-level PASS" into "visually verified" and would let staging deploy proceed with confidence after (a). Cost: ~5min wall-clock for rebuild + ~30s for smoke test.
