# Project State — Yelli
# Auto-generated. Never edit manually.
# Updated: 2026-06-01 by CLAUDE_CODE (Opus 4.7 Architect + Sonnet 4.6 Executor, V32 R1)

PHASE:        Phase 4 Part 3 complete (packages/db scaffolded: Prisma schema + L2/L5/L6 security stack + webmaster seed; live deploy unchanged)
LAST_DONE:    Wrote 11 files in packages/db/ on scaffold/part-3, then squash-merged to main. Prisma schema with 10 models (7 Yelli entities + Account/Session/VerificationToken Auth.js tables) + 4 enums (Role/CallRole/AuditTargetType/EndReason) + @@unique/@@index per Part 2 TS types. Initial migration 0001_init/migration.sql via `prisma migrate diff` with 6 L2 RLS policies appended (tenant_isolation USING current_setting('app.current_tenant_id', true) on User/Device/Invitation/CallSession; permissive on AuditLog + WebPushSubscription where tenantId is nullable). Manual down.sql for symmetric rollback. L5 always-active audit.ts (writeAuditLog inside any tx). L2 rls.ts (withTenant + setTenantContext via $executeRawUnsafe SET LOCAL). L6 tenant-guard.ts using Prisma.defineExtension + $allOperations (excludes Tenant/AuditLog/Account/Session/VerificationToken). prisma/seed.ts reads process.env.WEBMASTER_PASSWORD at runtime (validates ≥12 chars), bcrypt 12 rounds, idempotent upsert of `_pwbt` reserved platform tenant + webmaster user (bonitobonita24@gmail.com, role: admin). D2-fix realigned AuditLog.targetId nullability to match Part 2 TS source of truth. pnpm -r typecheck = 0 errors workspace-wide.
NEXT:         Phase 4 Part 4 — packages/ui (shadcn/ui base) + packages/jobs (CONDITIONAL on inputs.yml jobs.enabled) + packages/storage (CONDITIONAL on inputs.yml storage.enabled). Open .cline/tasks/phase4-part4.md in a NEW Claude Code session per Rule 24. Trigger: "Start Part 4". Branch: scaffold/part-4.
BLOCKERS:     none for Part 4. Phase 5 staging will block on unfilled CREDENTIALS.md ⏳ fields (GitHub PAT, Docker Hub token, SMTP, prod Turnstile keys, third-party APIs).
GIT_BRANCH:   main (scaffold/part-3 squash-merged and deleted)
GIT_TAG:      pre-spec-driven-adoption-20260531 (on main pre-rewrite)
PORTS:        ASSIGNED — base=46838, db=46838, pgbouncer=46839, redis=46840, minio=46841, minio_console=46842, mailhog=46843, mailhog_ui=46844, pgadmin=46845, app=46848, worker=46849, prisma_studio=46858.
MIGRATION:    brownfield=true. Parts 1+2+3 done. Live deploy at yelli-maes.powerbyte.app stays on prior commit a251049 until rewrite finishes + manual Komodo redeploy.
LIVE_DEPLOY:  yelli-maes.powerbyte.app (vanilla edition operational; not auto-redeploying during Phase 4)
MODELS:
  planning:   claude-code (Opus 4.7 — Architect ONLY per V32 R1)
  execution:  claude-sonnet-4-6 (via Claude Code — all file writes)
  governance: gemini-2.5-flash-lite
LINES_TOUCHED: ~660 this Part (11 packages/db files + root package.json + pnpm-lock + 5 governance docs)
CHECKPOINT_TYPE: full
FILES_TOUCHED:
  - packages/db/package.json (created)
  - packages/db/tsconfig.json (created; rootDir widened to "." in D3)
  - packages/db/src/index.ts (created — PrismaClient singleton + barrel)
  - packages/db/src/audit.ts (created — L5 always-active)
  - packages/db/src/rls.ts (created — L2 helper)
  - packages/db/src/middleware/tenant-guard.ts (created — L6 $allOperations)
  - packages/db/prisma/schema.prisma (created; AuditLog.targetId fix in D2-fix)
  - packages/db/prisma/migrations/0001_init/migration.sql (prisma diff + 6 RLS policies)
  - packages/db/prisma/migrations/0001_init/down.sql (manual reverse)
  - packages/db/prisma/migrations/migration_lock.toml (provider = postgresql)
  - packages/db/prisma/seed.ts (env-driven webmaster, bcrypt 12, idempotent)
  - package.json (root — pnpm.onlyBuiltDependencies for argon2/esbuild/@prisma/client/prisma)
  - pnpm-lock.yaml (regenerated)
  - docs/CHANGELOG_AI.md (Part 3 entry appended)
  - docs/IMPLEMENTATION_MAP.md (packages/db section updated, Phase Status updated)
  - docs/DECISIONS_LOG.md (4 LOCKED entries appended)
  - .cline/memory/lessons.md (4 typed entries appended)
  - .cline/memory/agent-log.md (1 line appended)
  - .cline/STATE.md (this checkpoint)
TIER_CLASSIFICATION: 2 — moderate (6 Sonnet dispatches under V32 R1: D0 Scout + D1 schema + D2 helpers + D2-fix nullability + D3 seed + D4 governance; ~660L total; each ≤500L per V32 R2)
DISPATCH_LEDGER (Phase 4 Part 3):
  D0 (Sonnet Scout): read DECISIONS_LOG + Part 2 types + inputs.yml + reserved-slugs → structured report resolving bcrypt-vs-Argon2id (both: bcrypt for User.passwordHash, Argon2id for Tenant.adminPassphraseHash), confirming 25 audit actions, $allOperations mandate, admin_email = bonitobonita24@gmail.com, tenancy.mode = multi
  D1: scaffold/part-3 branch off main + packages/db skeleton + prisma/schema.prisma (10 models + 4 enums + indexes + @@unique([tenantId, email])) + pnpm install + db:generate; commit f6f014e
  D2: migration via prisma diff (--from-empty --to-schema-datamodel --script) + 6 L2 RLS policies appended + down.sql + L2 rls.ts + L5 audit.ts + L6 tenant-guard.ts ($allOperations + 5 EXCLUDED_MODELS) + barrel update; typecheck 0 errors
  D2-fix: AuditLog.targetId nullability realigned (schema: `String?` + in-place edit of migration.sql to drop NOT NULL + audit.ts workaround removed); 6 RLS policies preserved
  D3: prisma/seed.ts env-driven webmaster (process.env.WEBMASTER_PASSWORD ≥12 chars + bcrypt 12 rounds + `_pwbt` platform tenant + idempotent upsert via @@unique key) + tsconfig rootDir widened to "."; commit d955d22
  D4 (this): typecheck + governance docs (CHANGELOG_AI + IMPLEMENTATION_MAP + DECISIONS_LOG + lessons + agent-log) + STATE.md rewrite + squash-merge scaffold/part-3 → main + push origin/main + delete branch
NEXT_DISPATCH: Human opens fresh Claude Code session → "Start Part 4" from .cline/tasks/phase4-part4.md
