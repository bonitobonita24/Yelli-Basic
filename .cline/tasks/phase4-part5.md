# Phase 4 Part 5 — apps/yelli Next.js full scaffold
# Fresh session. Read STATE.md first, then parts below only.
# Branch: scaffold/part-5. Never commit to main directly.

TASK: Generate apps/yelli Next.js web app with security-hardened scaffold (Part 5 of 8).

PRE-FLIGHT:
- Read .cline/STATE.md — confirm LAST_DONE shows Part 4 complete.
- Read inputs.yml: apps[0] (name=yelli, framework=nextjs, pwa=true), ports.dev.*
- Read PRODUCT.md sections: Core User Flows, Pages/Screens, Roles, Realtime+signaling
- Read docs/DECISIONS_LOG.md: tenant-guard chain, Loading Library dual-path, CORS origins, Turnstile
- Read .cline/memory/lessons.md (ALL 🔴 gotchas first)
- Create scaffold/part-5 branch before writing any file

FIRST — Initialize shadcn/ui (mandatory before any component — V29):
  cd apps/yelli
  npx shadcn@latest init          # New York style, CSS variables, globals.css path
  npx shadcn@latest add button card dialog input label select textarea toast sonner \
    skeleton form sheet tabs avatar dropdown-menu badge separator scroll-area

Add chart if PRODUCT.md shows analytics dashboards. Add data-table if list views declared.

GENERATE (apps/yelli/):
- tsconfig.json — extends ../../tsconfig.base.json, strict: true
- package.json — Next.js 15+, Auth.js v5, @trpc/server, @trpc/client, @trpc/react-query,
    isomorphic-dompurify, lru-cache, next-pwa/workbox, web-push, tailwindcss, clsx, zod
- src/env.ts — t3-env Zod-validated env vars (DB, AUTH, REDIS, STORAGE, SMTP, TURNSTILE, WEB_PUSH)
- src/app/layout.tsx — Clay token import (tokens.css → shadcn vars), Web Push init, PWA meta
- src/app/ — App Router pages per PRODUCT.md:
    (auth)/login/page.tsx, (auth)/register/page.tsx
    (app)/page.tsx — idle screen / call directory
    (app)/settings/page.tsx
    (app)/directory/page.tsx
    (app)/audit/page.tsx (admin only)
    /_pwbt/page.tsx — platform super-admin (isolated, role-guarded)
    api/trpc/[trpc]/route.ts — tRPC HTTP handler
    api/auth/[...nextauth]/route.ts — Auth.js v5 handler
    api/webhooks/ — placeholder for Xendit (conditional, skip if payment.gateway absent)
    api/health/route.ts — GET 200 liveness check
    api/push/subscribe/route.ts — Web Push subscription endpoint
- src/server/trpc/trpc.ts — initTRPC, createTRPCContext, middleware stack
- src/server/trpc/middleware/rbac.ts — requireRole() guard (L3 — always active)
- src/server/trpc/middleware/tenant.ts — tenantId from session (L1 — multi mode)
- src/server/trpc/middleware/session-version.ts — securityVersion freshness check (V28)
- src/server/trpc/middleware/rate-limit-mw.ts — applies rateLimiters tier per procedure
- src/server/trpc/middleware/audit-log.ts — L5 mutation logger
- src/server/trpc/routers/tenant.ts — CRUD (platform only)
- src/server/trpc/routers/user.ts — profile, role change, suspend
- src/server/trpc/routers/device.ts — register, list, archive, unarchive
- src/server/trpc/routers/call.ts — initiate, end, history, WebRTC signaling helpers
- src/server/trpc/routers/branding.ts — tenant logo/color (admin only)
- src/server/trpc/routers/audit.ts — paginated log reads (admin)
- src/server/trpc/routers/platform.ts — _pwbt superadmin router using isolated platformPrisma
- src/server/trpc/root.ts — merge all routers
- src/server/auth/config.ts — Auth.js v5: Credentials (email+bcrypt) + LAN passphrase mode
- src/server/auth/session.ts — getServerSession wrapper, securityVersion check hook
- src/middleware.ts — tenant resolution from subdomain (Cloud) + session.tenantId cross-check
    (V28: if URL slug ≠ session.tenantId → redirect to correct tenant; prevents tenant-switching attack)
- src/server/lib/rate-limit.ts — LRU in-memory store; tiered limiters:
    auth ≤10/min per IP, api ≤120/min per user, public ≤30/min per IP, upload ≤20/min
    Wire into all tRPC base procedures
- src/server/lib/sanitize.ts — DOMPurify: sanitize() (safe HTML), sanitizePlainText()
- src/types/phantom-ui.d.ts — JSX intrinsic for <phantom-ui> (V31.3 PATH B)
- src/components/ — page-level components per module (DeviceCard, CallRow, AuditTable, etc.)
- next.config.ts — output:'standalone', 7 HTTP security headers on all routes:
    X-Frame-Options: SAMEORIGIN
    X-Content-Type-Options: nosniff
    Strict-Transport-Security: max-age=31536000; includeSubDomains
    Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
    Referrer-Policy: strict-origin-when-cross-origin
    X-XSS-Protection: 1; mode=block
    Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'
      https://challenges.cloudflare.com; frame-src 'none' https://challenges.cloudflare.com;
      connect-src 'self' wss://*; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'
- public/manifest.json — PWA manifest (name=Yelli, short_name=Yelli, theme_color from tokens.css)
- src/lib/service-worker/sw.ts — Workbox cached-shell offline + UUIDv7 replay queue (Step 8)
- Dockerfile — multi-stage node:24-alpine; Stage 1 install, Stage 2 build, Stage 3 standalone runner
- .dockerignore

SECURITY NOTES:
- platformPrisma = new PrismaClient() (no tenant-guard extension) — used ONLY in platform.ts router
- ALL platform ops logged to AuditLog with prefix "PLATFORM:"
- requireRole enforced on every mutation; public procedures rate-limited via rateLimiters.public
- Turnstile server-side siteverify required on login + register (SECRET key server-only)

EXECUTE:
  cd <project_root>
  pnpm install --frozen-lockfile
  pnpm typecheck          # 0 errors required
  pnpm lint               # 0 errors required
  pnpm build              # must succeed; tests can be deferred to Part 8

GOVERNANCE SELF-CHECK before merge:
  □ STATE.md rewritten: PHASE="Phase 4 Part 5 complete"
  □ CHANGELOG_AI.md entry: Agent: CLAUDE_CODE, Part 5 files listed

COMMIT + MERGE:
  git add -A
  git commit -m "scaffold(web): apps/yelli Next.js + shadcn + auth + tRPC + security — Part 5 of 8"
  # squash-merge scaffold/part-5 to main; delete branch

OUTPUT:
"✅ Part 5 complete. Open phase4-part6.md in a NEW Claude Code session."

STOP HERE. Do not start Part 6 in this session.
