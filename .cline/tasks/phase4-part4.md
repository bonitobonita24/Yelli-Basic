# Phase 4 Part 4 — packages/ui + packages/jobs + packages/storage (Yelli)
# Fresh session. Read STATE.md first. Confirm Part 3 complete.

TASK: Generate shared UI primitives + BullMQ job package + MinIO/S3 storage wrapper (Part 4 of 8).

PRE-FLIGHT:
- Read STATE.md. LAST_DONE must show Part 3 complete.
- Read inputs.yml jobs + tech_stack sections
- Read docs/PRODUCT.md "PWA + offline" + "Realtime + signaling" sections (for queue names + push job)
- Read design-system/MASTER.md if exists; else use shadcn defaults
- Create scaffold/part-4 branch

GENERATE:
- packages/ui/ — shared shadcn/ui primitives wrapper (re-exports for monorepo consumption)
- packages/jobs/ — Valkey + BullMQ typed queues:
    Queues per PRODUCT.md: webPushFanout, deviceArchive, callSessionCleanup, tenantExport
    Worker setup with graceful shutdown
    DLQ + retry+backoff
    Every job payload includes tenantId + userId (multi-tenant safety)
- packages/storage/ — typed MinIO (dev) / S3 (prod) wrapper:
    Tenant-scoped path prefix: ${tenantId}/${entityType}/${randomFilename}
    Whitelist MIME types (PNG/JPG/SVG for branding per PRODUCT.md ≤2MB)
    Magic byte validation server-side

EXECUTE:
- pnpm typecheck (Part scope)
- pnpm lint

GOVERNANCE SELF-CHECK + COMMIT:
- STATE.md, CHANGELOG. Commit "scaffold(ui+jobs+storage): Part 4 of 8". Squash-merge. Delete branch.

OUTPUT:
"✅ Part 4 complete. Open phase4-part5.md in a NEW Claude Code session."

STOP HERE.
