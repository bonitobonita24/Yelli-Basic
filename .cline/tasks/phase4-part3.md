# Phase 4 Part 3 — packages/db (Yelli — Prisma schema + tenant isolation)
# Fresh session. Read STATE.md first. Confirm Part 2 complete.

TASK: Generate full Prisma schema with all Yelli entities + multi-tenant L1-L6 security stack (Part 3 of 8).

PRE-FLIGHT:
- Read .cline/STATE.md. LAST_DONE must show Part 2 complete.
- Read inputs.yml + PRODUCT.md "Data Entities" section
- Read DECISIONS_LOG.md (tenancy mode = multi for Cloud + LAN single-implicit; tenant slug rules; tenant-guard chain)
- CREDENTIALS.md is gitignored — do NOT read. Seed reads WEBMASTER_PASSWORD from process.env at runtime.
- Create scaffold/part-3 branch

GENERATE:
- prisma/schema.prisma (all entities from PRODUCT.md: Tenant, User, Device, CallSession, AuditLog, Invitation, WebPushSubscription, etc.)
- prisma/migrations/0001_init/ (initial migration + down migration)
- prisma/seed.ts MUST include the first admin (MANDATORY):
    username: webmaster
    email: bonitobonita24@gmail.com (from inputs.yml app.admin_email)
    password: read from process.env.WEBMASTER_PASSWORD at runtime → bcrypt hash → store hashed
    role: super_admin
    NEVER hardcode the plaintext password in seed.ts
- src/audit.ts (L5 AuditLog write helper — always active)
- src/middleware/tenant-guard.ts (L6 Prisma extension via $allOperations — covers findMany/findFirst/findUnique/create/createMany/update/updateMany/delete/deleteMany/count/aggregate/groupBy)
- src/rls.ts (L2 RLS helper using SET LOCAL app.current_tenant_id — multi-mode active, LAN comments)
- packages/db/package.json + tsconfig.json

EXECUTE:
- pnpm db:generate
- pnpm typecheck (Part scope)
- Verify seed.ts reads WEBMASTER_PASSWORD from env: grep -n WEBMASTER_PASSWORD prisma/seed.ts

GOVERNANCE SELF-CHECK + COMMIT:
- STATE.md, CHANGELOG. Commit "scaffold(db): Prisma schema + L5/L6 always-on + seed — Part 3 of 8". Squash-merge. Delete branch.

OUTPUT:
"✅ Part 3 complete. Open phase4-part4.md in a NEW Claude Code session."

STOP HERE.
