# Yelli — Demo Guide (Deadline Readiness 2026-06-18)

Prepared for evaluator walkthroughs. Covers prod access, local dev access, credentials pointer, and the numbered click-path for each major feature.

---

## URLs

| Environment | URL | Status |
|---|---|---|
| Production | https://yelli-basic.powerbyte.app | LIVE — all health checks green |
| Dev (local) | http://localhost:46848 | Running — start with `bash deploy/compose/start.sh dev up -d` |
| Admin console (dev) | http://localhost:46848/admin/login | LAN passphrase mode |
| Signaling WS (dev) | ws://localhost:46850/ws | |
| MailHog (dev email) | http://localhost:46825 | Catches all outbound email in dev |

---

## Credentials

> Credentials are stored in `CREDENTIALS.md` at the repo root (gitignored).
> NEVER paste these into AI chat or commit them. Reference CREDENTIALS.md directly.

**Prod (Cloud mode — email + password + tenantSlug):**
- Tenant slug: `_pwbt`
- Login URL: https://yelli-basic.powerbyte.app/login
- Account: see `CREDENTIALS.md` → "Staging / Prod — Webmaster" (role: admin)

**Dev (Cloud mode — email + password + tenantSlug):**
- Tenant slug: `_pwbt`
- Login URL: http://localhost:46848/login
- Admin account: `admin@mail.com` / `admin` (role: admin)
- Member account: `user@mail.com` / `user` (role: member)

**Dev Admin Console (LAN anonymous mode — passphrase only):**
- Login URL: http://localhost:46848/admin/login
- Passphrase: `admin`

---

## Demo Data State (dev)

After running the seed pipeline (`pnpm db:seed` + `pnpm db:seed:demo`):
- 6 demo members registered
- 9 demo devices in the directory
- 12 demo call session records (historical)
- 5 demo invitations (pending/expired mix)
- 14 demo audit log entries

Seed is idempotent — safe to re-run. Does NOT touch prod/staging.

---

## Click-Path Walkthrough (Evaluator)

### 1. Cloud User Login

1. Open https://yelli-basic.powerbyte.app/login (or http://localhost:46848/login for dev)
2. Enter email, password, and tenant slug `_pwbt` → **Sign In**
3. On success: redirected to the main app (directory / idle screen)

### 2. Device Directory + Calling (Core Feature)

1. After login: the main screen shows the **device directory** — all registered devices with online/offline status
2. Tap / click any online peer → **CALL** button appears
3. The callee receives an incoming call modal — **Accept** or **Reject**
4. On accept: WebRTC peer-to-peer media streams (audio/video)
5. Either side can **Mute**, toggle **Camera**, or hit **End**
6. Call ends → both sides return to idle directory

> Demo tip: open two browser tabs (admin + member accounts) to simulate caller + callee.

### 3. PWA Install Prompt

1. On second visit to the app, an install banner appears at the top
2. Click **Install** → browser install prompt → accept
3. App installs as a standalone PWA

### 4. Settings (User Profile)

1. Bottom nav → **Settings** (gear icon)
2. Edit display name → **Save** → tRPC `brand.update` mutation fires
3. Change is reflected immediately

### 5. Admin Console — Members

1. Log in as admin → bottom nav → **Admin** (or navigate to `/admin/members`)
   - _Dev LAN mode:_ go to http://localhost:46848/admin/login, enter passphrase `admin`
2. Members list: see all users with role badges
3. Row menu → **Promote to Admin** or **Demote to Member**
4. Role flips live; target user's session is invalidated via Valkey pub/sub

### 6. Admin Console — Invitations + Email

1. Admin → **Invitations** (`/admin/invitations`)
2. **Invite Member** → enter email → Submit
3. Row appears with status "Pending · expires +7d"
4. In dev: open MailHog at http://localhost:46825 → email "You're invited to join Yelli" is present
5. **Revoke** → status flips to "Expired"

### 7. Admin Console — Audit Log

1. Admin → **Audit** (`/admin/audit`)
2. See timestamped entries for all admin actions (member role changes, invitations, branding updates, LAN logins)
3. Use filter chips to narrow by action category

### 8. Tenant Branding Settings (Admin)

1. Admin → **Settings** (`/admin/settings`)
2. Edit tenant display name → **Save** → `brand.update` tRPC mutation
3. Audit log records `tenant.branding.update` entry

### 9. Health / Uptime (Read-Only Proof)

```
curl https://yelli-basic.powerbyte.app/_pwbt/health
# Expected: {"ok":true,"db":true,"valkey":true,"signaling":true}
```

---

## Seeding Commands (dev only)

```bash
# From repo root — requires running dev containers
cd packages/db

# Baseline seed (platform tenant + accounts):
DATABASE_URL="postgresql://..." NODE_ENV=development pnpm db:seed

# Demo data (members, devices, calls, invitations, audit entries):
DATABASE_URL="postgresql://..." NODE_ENV=development pnpm db:seed:demo
```

Replace `DATABASE_URL` with the value from `.env.dev` (see `DATABASE_URL=...` in that file).

---

## QA Status (as of 2026-06-18)

| Check | Result |
|---|---|
| `pnpm lint` (7 packages) | All pass |
| `pnpm typecheck` (7 packages) | All pass |
| `pnpm test` (117 tests / 26 files) | All pass |
| `pnpm build` (Next.js) | Clean (1 Turbopack/Prisma CJS warning — known, cosmetic) |
| Prod health (`/_pwbt/health`) | `{ok,db,valkey,signaling: all true}` |
| Prod login (webmaster / `_pwbt`) | 302 + `__Secure-authjs.session-token` issued — confirmed working |
| Dev stack | All 8 containers healthy |

---

## Open Items (Owner-Gated)

- **ScreenTenantSettings Phase-3.3 sign-off** — deferred per `docs/STATE.md`; admin settings screen works but prototype review pending owner
- **Backup S3 creds** — `WEBMASTER_PASSWORD` env var not set in dev; backup worker deferred until S3 provisioned
- **Browser Playwright sweep** — separate wave reserved; not in this QA pass (code + HTTP verified only)
