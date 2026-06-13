# S6 — Live Validation Report (partial)

**Date:** 2026-06-14 · **Branch:** `swarm/rebuild` · **Method:** live authed walk against the running dev stack (web `:46848`, signaling `:46850`, jobs worker, Postgres/Valkey/MinIO) driven via Playwright. **Validator:** Claude Code (PM-autonomous session).

> Scope note: this covers the **static + live-flow-walk + Visual-QA** portion of S6. It does NOT tag `phase-4-complete` — two human gates remain (design sign-off on ScreenTenantSettings; backup S3 credentials) plus the multi-peer WebRTC call flow (needs 2 real devices/media).

## Environment fixes that UNBLOCKED runtime (the app never ran end-to-end before)
| Commit | Bug | Impact |
|---|---|---|
| `bbdc06a` | `next-auth` beta.22 read `headers().get` synchronously; Next 16 made `headers()` async → **every SSR route 500'd** at runtime | Bumped → beta.31. Static build was green (dynamic routes never execute at build), so this slipped past CI. |
| `7dc6cf1` | `env.ts` validated server-only vars (AUTH_SECRET/DATABASE_URL/REDIS_URL) in the **client** bundle (useSignaling imports it for NEXT_PUBLIC_SIGNALING_URL) → "Invalid environment variables" thrown in the browser console on every page | Client now validates only the public subset. No secret leak (values were never client-side). |
| `b47aa27` | Settings was added to the AppShell nav but missing from the home "Admin tools" card grid | Nav parity restored. |

## Static suite — GREEN
- `typecheck` ✅ · `lint` ✅ · monorepo tests **21/21** (web 11, signaling 10).
- Coverage gap noted: tRPC routers (tenants/brand/devices/audit), auth/RBAC, and `@yelli/jobs` have **no unit tests** — recommend a Phase-5 test-coverage epic (validated live instead, below).

## Live walk — GREEN
- **Boot:** web `/`→200, `/admin/login`→200, gated `/admin/*`→307; `/_pwbt/health` = `{ok, db, valkey, signaling: all true}`. Signaling listening on `:46850/ws`; jobs host ready with 6 queues + cron.
- **Auth:** Cloud sign-in via Auth.js `/api/auth/signin` (email + password + tenantSlug) → session issued → gated routes accessible. (Test admin seeded in `_pwbt`, deleted after.)
- **ScreenTenantSettings (the new Page-18 screen) — END-TO-END:** renders live tenant data; display-name edit → Save → `brand.update` mutation → "Saved." → re-disables; slug `_pwbt` read-only with `.yelli.app` + permanent helper. The save emitted a `tenant.branding.update` entry **visible in ScreenAdminAudit** — full L5 audit chain confirmed.
- **Admin screens:** Members, Invitations, Audit all render; Audit filter chips derive from the §11 vocabulary; "N shown" counts correct.
- **Invitation + email worker (Flow F) — END-TO-END:** created an invite → row shows "Pending · expires +7d" → **MailHog received "You're invited to join Yelli"** → Revoke → row flips to "Expired". This validates the entire **BullMQ pipeline live** (`invitation.create` → email queue → email worker B2/W5c → SMTP → inbox) — the worker runtime was swarm-built but previously un-exercised. Major de-risk.
- **Visual QA:** desktop + mobile (375px). Mobile-first contract holds — forms stack single-column, bottom nav carries all 5 items (incl. the new Settings) without overflow; desktop nav hidden < md.
- **Console:** zero errors after the env fix (favicon 404 only, cosmetic).

## Remaining for full S6 / `phase-4-complete`
1. **WebRTC call flow (Flow A)** — needs 2 real peers + media; not exercisable from a single headless context. Signaling server boots + authorizes (10/10 unit tests) but the live 2-peer handshake is unvalidated.
2. **Design sign-off** (human) — ScreenTenantSettings design (screenshots delivered).
3. **Backup S3 credentials** (human) — `BACKUP_S3_*` unprovisioned; B5 worker throws until set.
4. Then: review/push `swarm/rebuild`, tag `phase-4-complete`.
