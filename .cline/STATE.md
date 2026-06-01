# Project State — Yelli
# Auto-generated. Never edit manually.
# Updated: 2026-06-01 by CLAUDE_CODE (Opus 4.7 Architect + Sonnet 4.6 Executor, V32 R1)

PHASE:        Phase 4 Part 4 complete (packages/ui Tailwind preset + packages/jobs BullMQ queues + packages/storage S3/MinIO wrapper; live deploy unchanged)
LAST_DONE:    Wrote 23 files across packages/ui + packages/jobs + packages/storage on scaffold/part-4, squash-merged to main as cc03433 and pushed to origin. packages/ui ships a shareable Tailwind 3.4 preset (Clay token color bridge via `hsl(var(--clay-*))` + radii from --radius-button/card + cn() helper using clsx + tailwind-merge) — no shadcn primitives yet (Part 5 runs `npx shadcn add` against this package). packages/jobs ships 6 typed BullMQ queues matching inputs.yml + DECISIONS_LOG "LOCKED: Jobs + Queues" / "LOCKED: Database Backup" (tenant-export, device-archive-cron, soft-delete-hard-delete-cron, backup-cron, email, logo-image-processing) with shared ioredis connection (5.10.1 exact pin + pnpm.overrides dedupe vs bullmq's bundled version), `assertTenantUser` payload guard enforcing security.md Queue Safety rules 1+2, 6 worker stubs that validate payload + log structured JSON + return placeholder (TODO Phase 5 markers throughout), and `startAllWorkers()` runtime with SIGTERM/SIGINT graceful shutdown for `node dist/workers/index.js` deploy. packages/storage ships an S3Client factory that flips between MinIO (dev, forcePathStyle) and AWS S3 (prod), typed BUCKETS registry, MIME whitelist PNG+JPEG only with magic-byte verification + 2 MiB limit (SVG intentionally excluded per security.md rule 6 — re-enable requires DOMPurify wiring in Phase 5/7), tenant-scoped upload path `${tenantId}/${entityType}/${randomFilename}.${ext}`, and signed-URL download that asserts `sessionTenantId` matches the storage key prefix per security.md File Upload Safety rule 8 (StorageAccessError returns generic "Not found" to prevent existence leak). pnpm -r typecheck = 0 errors workspace-wide both pre- and post-merge.
NEXT:         Phase 4 Part 5 — apps/yelli (Next.js 16 App Router scaffold + tRPC 5-step middleware chain + Auth.js v5 + V25 anti-tenant-switching middleware + shadcn primitives installed targeting packages/ui + Clay tokens.css single source + PWA Workbox + Web Push + rate limiter tiers + HTTP security headers + DOMPurify sanitize + signaling rewrite from vanilla server.js → tRPC WebSocket subscription). Open .cline/tasks/phase4-part5.md in a NEW Claude Code session per Rule 24. Trigger: "Start Part 5". Branch: scaffold/part-5. Largest Part yet — Opus will sub-divide per V32 R2/§1 Tiered Decomposition (likely 6–8 Sonnet dispatches: shadcn init + tokens.css + auth scaffold + tRPC routers + signaling subscription + UI pages + PWA + verify/merge).
BLOCKERS:     none for Part 5. Pre-existing lint script failure (`pnpm -r lint --if-present` returns non-zero due to ESLint v9 flat-config root config absence — noted Part 2 session memory) is NOT a Part 4 regression; typecheck is the authoritative gate. Phase 5 staging will block on unfilled CREDENTIALS.md ⏳ fields (GitHub PAT, Docker Hub token, SMTP, prod Turnstile keys, third-party APIs).
GIT_BRANCH:   main (scaffold/part-4 squash-merged as cc03433 and deleted)
GIT_TAG:      pre-spec-driven-adoption-20260531 (on main pre-rewrite)
PORTS:        ASSIGNED — base=46838, db=46838, pgbouncer=46839, redis=46840, minio=46841, minio_console=46842, mailhog=46843, mailhog_ui=46844, pgadmin=46845, app=46848, worker=46849, prisma_studio=46858.
MIGRATION:    brownfield=true. Parts 1+2+3+4 done. Live deploy at yelli-maes.powerbyte.app stays on prior commit a251049 until rewrite finishes + manual Komodo redeploy.
LIVE_DEPLOY:  yelli-maes.powerbyte.app (vanilla edition operational; not auto-redeploying during Phase 4)
MODELS:
  planning:   claude-code (Opus 4.7 — Architect ONLY per V32 R1)
  execution:  claude-sonnet-4-6 (via Claude Code — all file writes)
  governance: gemini-2.5-flash-lite
LINES_TOUCHED: ~1410 this Part (5 packages/ui + 14 packages/jobs + 8 packages/storage files + root package.json pnpm.overrides + pnpm-lock regen + 5 governance docs)
CHECKPOINT_TYPE: full
FILES_TOUCHED:
  - packages/ui/package.json (created)
  - packages/ui/tsconfig.json (created)
  - packages/ui/tailwind.config.ts (created — shareable preset)
  - packages/ui/src/index.ts (created — barrel)
  - packages/ui/src/lib/utils.ts (created — cn helper)
  - packages/jobs/package.json (created)
  - packages/jobs/tsconfig.json (created)
  - packages/jobs/src/index.ts (created — barrel + startAllWorkers re-export)
  - packages/jobs/src/connection.ts (created — getConnection singleton + createWorkerConnection + closeAllConnections)
  - packages/jobs/src/types.ts (created — 6 typed payloads + QUEUE_NAMES const)
  - packages/jobs/src/queues.ts (created — Queue<T> registry + DEFAULT_JOB_OPTS + closeAllQueues)
  - packages/jobs/src/workers/_validate.ts (created — assertTenantUser + log helper)
  - packages/jobs/src/workers/tenant-export.worker.ts (created — stub)
  - packages/jobs/src/workers/device-archive.worker.ts (created — stub)
  - packages/jobs/src/workers/soft-delete-cron.worker.ts (created — stub)
  - packages/jobs/src/workers/backup-cron.worker.ts (created — stub with _pwbt+system local guard)
  - packages/jobs/src/workers/email.worker.ts (created — stub with idempotencyKey guard)
  - packages/jobs/src/workers/logo-image-processing.worker.ts (created — stub)
  - packages/jobs/src/workers/index.ts (created — startAllWorkers + main entrypoint + SIGTERM/SIGINT)
  - packages/storage/package.json (created)
  - packages/storage/tsconfig.json (created)
  - packages/storage/src/index.ts (created — barrel)
  - packages/storage/src/client.ts (created — S3Client factory MinIO/S3)
  - packages/storage/src/buckets.ts (created — typed BUCKETS registry)
  - packages/storage/src/validate.ts (created — MIME whitelist PNG+JPEG + magic bytes + 2 MiB cap)
  - packages/storage/src/upload.ts (created — tenant-scoped path + tenantId/entityType guards + CacheControl no-store)
  - packages/storage/src/download.ts (created — signed URL with sessionTenantId key-prefix match + 24h export variant)
  - package.json (root — added pnpm.overrides.ioredis = "5.10.1")
  - pnpm-lock.yaml (regenerated)
  - docs/CHANGELOG_AI.md (Part 4 entry appended)
  - docs/IMPLEMENTATION_MAP.md (Phase 4 Part 4 section expanded + Phase Status updated)
  - docs/DECISIONS_LOG.md (3 LOCKED entries appended — ioredis pin, branding MIME whitelist, worker payload guard convention)
  - .cline/memory/lessons.md (4 typed entries appended — 🟤 ioredis dedupe, 🟤 SVG deferred, ⚖️ Tailwind 3.4, 🟢 worker boot pattern)
  - .cline/memory/agent-log.md (1 line appended)
  - .cline/STATE.md (this checkpoint — Opus exception per V32 R1)
TIER_CLASSIFICATION: 2 — moderate (5 Sonnet dispatches under V32 R1: D1 ui scaffold / D2 jobs core / D3 jobs workers / D4 storage / D5 governance+verify+squash-merge; ~1410L total; each ≤500L per V32 R2)
DISPATCH_LEDGER (Phase 4 Part 4):
  D1: scaffold/part-4 branch off main + packages/ui (package.json + tsconfig + tailwind preset + cn util + barrel); typecheck 0; commit cc7aa31
  D2: packages/jobs core (package.json + tsconfig + connection + 6 typed payloads + Queue<T> registry + barrel); typecheck 0; commit 5706930; DEVIATION: ioredis pinned 5.10.1 exact + root pnpm.overrides added to dedupe bullmq's bundled version (resolved exactOptionalPropertyTypes mismatch between two ioredis instances)
  D3: packages/jobs/src/workers/ (6 worker stubs + _validate shared guard + index boot with graceful shutdown); typecheck 0; commit 0377f24
  D4: packages/storage (S3Client factory + typed BUCKETS + MIME whitelist with magic-byte check + tenant-scoped upload + signed-URL download with sessionTenantId prefix match); typecheck 0; commit a16391f; DEVIATION: SVG intentionally excluded from branding whitelist per security.md rule 6 (re-enable in Phase 5/7 with DOMPurify)
  D5: pnpm -r typecheck verified 0 across 6 packages → governance docs (CHANGELOG_AI + IMPLEMENTATION_MAP + DECISIONS_LOG + 4 lessons entries + agent-log) committed 8786198 on branch → squash-merge scaffold/part-4 → main as cc03433 → push origin/main (3165aae..cc03433) → branch deleted → final post-merge pnpm -r typecheck 0 errors
NEXT_DISPATCH: Human opens fresh Claude Code session → "Start Part 5" from .cline/tasks/phase4-part5.md (largest Part — sub-divide per V32 R2/§1 into shadcn init, tokens.css single source, Auth.js v5 scaffold, tRPC 5-step middleware + Super-Admin isolated router, Next.js middleware.ts V25 anti-tenant-switching, signaling WebSocket subscription rewrite, PWA Workbox + Web Push, security headers + rate limiter tiers + DOMPurify sanitize, UI pages composing shadcn primitives, two-stage code review per Rule 25, squash-merge)
