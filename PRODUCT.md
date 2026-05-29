# Yelli

## App Identity
Name:           Yelli
Tagline:        Video calling for your network — your LAN or our cloud, your call.
Industry:       Communications Platform — managed cloud + self-host
Primary users:  Two human peers, in or across networks. Tenant boundary applies in Cloud mode; absent in LAN mode.
Owner:          Powerbyte I.T. Solutions

## Problem Statement
Most teams default to Zoom or Meet for short, frequent video calls between two people in the same building (reception ↔ stockroom, doctor ↔ front desk, manager ↔ floor staff) — but cloud-routed calls are slow, expensive, and unnecessary for traffic that never needs to leave the network. Self-host alternatives like Jitsi are heavy and built for group meetings, not 1-on-1 intercom. Yelli ships as two editions sharing one codebase: Yelli LAN (self-hosted, no internet needed after setup) and Yelli Cloud (managed multi-tenant hosting, cross-network calling) — both 1-on-1, both white-labelable, both keeping media peer-to-peer via WebRTC.

## Core User Flows

### Calling (both editions)

1. **A Member places a 1-on-1 call.** Open app → directory shows online peers → tap peer → press CALL → callee accepts → WebRTC peer-to-peer media streams. *Errors:* peer offline before accept → "Peer unavailable"; peer busy → server rejects with `busy`; mic/cam permission denied → abort with help link; ICE fails (NAT/firewall) → "Connection failed — try again on the same network"; WebSocket drops mid-handshake → retry once then end.

2. **A Member receives an incoming call.** Modal shows caller's display name + Accept/Reject → ACCEPT → media streams. *Errors/edges:* REJECT → caller sees "Declined"; no answer in 30s → modal auto-dismisses, caller sees "No answer"; receiver role is `receiver-only` and already in a call → auto-reject `busy`; mic/cam denied on accept → auto-reject with reason.

3. **Either side ends or cancels a call.** In-call → END button → both sides cleanup + return to idle. *Errors/edges:* peer disconnects mid-call → "Peer disconnected" + cleanup; ICE drops → "Connection lost" + cleanup; caller cancels while ringing → callee modal auto-dismisses.

4. **A Member picks their device's call role.** Tap "Both / Caller only / Receiver only" chip → state persists in localStorage → CALL button disables for `receiver-only`. *Edge:* role change during active call doesn't disrupt it; takes effect after end.

5. **A Member toggles mute or camera mid-call.** Tap mute icon → audio track disabled → icon updates. Same for camera. *Edge:* peer sees a "muted" indicator on top overlay; cam-off shows placeholder avatar with peer's display name initial.

### Shared identity + admin (both editions)

6. **A Member sets their per-device display name on first launch.** Modal prompts "What should others see when you call?" → user types → saved to localStorage → used in directory + incoming-call modal. Editable later from Settings drawer. *Errors:* empty submit → re-prompt; name >24 chars → truncate; duplicate name on same network → server appends short device-id suffix in display (e.g. `Alex (A1B)`).

7. **An Admin configures branding.** Settings → Branding → upload logo (PNG/JPG/SVG, ≤2 MB) + type header text (≤40 chars) → Save → all live sessions refresh branding within 30s. *Errors:* oversized file → reject with limit; invalid type → reject; corrupt image → "Couldn't process this image"; header text overflow → truncate + warn.

8. **A Member browses the directory and calls from it.** Idle screen → "Online" section lists peers with display names → tap a row → CALL → flow 1 starts. *Edges:* empty directory → "No peers online — open Yelli on another device"; peer goes offline while list is open → row removed in realtime.

9. **A LAN Server Admin runs first-time setup.** Admin starts server → first browser visit launches setup wizard → choose Anonymous mode (no accounts, current LAN behaviour) OR Account mode (sets up first admin + invitable members) → enter org name + upload logo → save. *Edges:* wizard interrupted → resumes on next visit; switching anonymous→account later via Settings → existing display-name history wiped with confirmation.

### Accounts + tenancy (Cloud, plus LAN account mode where noted)

10. **An Org Owner signs up for Yelli Cloud.** Visit landing → "Start free trial" → enter org name + admin email + password → verification email sent → click link → org provisioned → land on admin dashboard. *Errors:* email already used (different tenant) → generic anti-enumeration response per V25; weak password → Auth.js v5 rejects with policy hint; verification link expired (24h) → resend flow; org-name collision → auto-suffix.

11. **A User logs in** *(Cloud, or LAN in account mode).* Enter email + password → session created → land on directory. *Errors:* wrong credentials → generic "Couldn't sign in"; account suspended → "Account is inactive — contact your admin"; tenant suspended (Cloud) → "Service unavailable — admin action required"; rate limit (10/min) → "Too many attempts — wait 60s".

12. **A Tenant Admin invites a member by email.** Admin → Members → Invite → enter email → invitation sent → invitee clicks → sets password → joins org → appears in directory. *Errors:* email already in another tenant → anti-enumeration silent; email already in this tenant → "Member already exists"; invite link expired (7 days) → admin resends.

13. **A User resets their password.** Login → "Forgot password" → enter email → always-success message "If that account exists, an email is sent" → click link → set new password → login. *Errors:* reset link expired (1h) → request new; rate limit (3/hour/email) → silent throttle.

14. **A Tenant Admin suspends or removes a member.** Admin → Members → row menu → Suspend or Remove → confirm → member's active sessions terminated within 30s. *Errors:* admin removes themselves → blocked with "Transfer admin role first"; member in active call → call ends + sessions kill; Remove triggers 7-day soft-delete grace period before hard delete.

## Modules + Features

### Calling (both editions)
- 1-on-1 video + audio over WebRTC peer-to-peer
- WebSocket signaling for offer / answer / ICE-candidate handshake
- Incoming-call modal with caller display name + Accept / Reject
- In-call controls: mute, camera toggle, end
- Caller cancel-while-ringing
- "Busy" auto-reject when callee is already in a call
- No-answer auto-dismiss after 30s
- Auto-end on peer disconnect, ICE failure, or sustained signaling drop
- Local PIP preview, fullscreen remote video, call timer
- Connection-state badge: CONNECTING → READY → CALLING → IN CALL
- Per-device call role: both / caller-only / receiver-only

### Directory (both editions)
- Live list of online peers scoped to the deployment (LAN: same signaling server; Cloud: same tenant)
- Display names shown (replaces hex IDs)
- Real-time join/leave updates via WebSocket broadcast
- Tap-to-call from row
- Empty-state guidance

### Device Identity (both editions)
- First-launch display-name prompt
- Editable later via Settings drawer
- Max 24 chars; collisions on same network disambiguated by device-id suffix
- Persisted in localStorage per browser/install
- Role-chip preference also persisted per device

### Accounts & Auth (Cloud always; LAN in account mode)
- Email + password authentication via Auth.js v5 (sessions in PostgreSQL)
- Email verification on signup (24h link expiry)
- Password reset by email (1h link expiry, 3/hour/email throttle)
- Rate limiting: login 10/min, signup 5/hour/IP
- Anti-enumeration responses per V25 Secure Code Generation
- Magic-link login alternative (low-friction for invited members)

### Tenancy & Members (Cloud always; LAN account mode = single implicit tenant)
- Tenant provisioning at org signup
- Member roles: Tenant Admin + Member
- Invitation by email (7-day link expiry, anti-enumeration)
- Suspend member → active sessions terminated ≤30s
- Remove member → 7-day soft-delete grace
- Admin can't remove self (must transfer admin first); multi-admin supported
- L1–L6 data isolation: every query scoped by tenantId
- Seat counter displayed (no enforcement in MVP)

### Branding (both editions)
- Per-tenant override of header text (≤40 chars) + logo upload
- Logo: PNG/JPG/SVG ≤2 MB, rendered at 36×36 in app shell
- Storage: MinIO (dev) → S3 (prod)
- Live broadcast to all active sessions within 30s of save
- Default fallback: "Yelli" + teal-mint gradient blob (current logo treatment)
- Powerbyte footer immutable — not editable by tenants

### Admin Console (both editions)
- First-run setup wizard (LAN: anonymous vs account mode, org name, logo)
- Members page: list, invite, suspend, remove
- Branding settings page
- Org settings: display name, slug (Cloud)
- Seat count + plan badge (Cloud, display-only in MVP)
- Powerbyte Super-Admin minimal console at `/_pwbt/` — separate tRPC router + dedicated Prisma client (V25 isolation): list tenants, view metadata (name, slug, member count, status, createdAt), toggle isSuspended

## Roles + Permissions

| Role | Can do | Cannot do |
|------|--------|-----------|
| **Device User** *(LAN anonymous mode only)* | Set device display name and role; place 1-on-1 calls to any peer on the same LAN; accept/reject incoming calls; mute/cam toggle mid-call | Access any admin/settings page; persist identity across browsers; see anything outside the on-network peer directory |
| **Member** *(Cloud + LAN account mode)* | Log in with email + password (or magic link); set per-device display name + role; place/receive calls within own tenant's directory; reset own password; toggle mute/cam mid-call | See members of other tenants; modify tenant branding; invite or remove other members; access `/_pwbt/` |
| **Tenant Admin** *(inherits Member)* | Invite members by email; suspend or remove members; transfer admin role; configure branding (header text + logo); change tenant display name; run first-run wizard (LAN) | See or affect any other tenant; bypass own tenant's session policies; access `/_pwbt/` |
| **Powerbyte Super-Admin** *(Cloud only; `/_pwbt/`)* | List all tenants; view tenant metadata (display name, slug, member count, isSuspended, createdAt); toggle a tenant's `isSuspended` | Read any tenant's user data, branding files, or call content; impersonate Members or Admins; access tenant-scoped tRPC routers; view call media (P2P — never reaches the server in any case) |

Role scope: Device User per-device; Member and Tenant Admin tenant-scoped (JWT carries tenantId); Powerbyte Super-Admin global (separate router per V25).

## Data Entities

**Tenant**: id (uuid), slug (unique; subdomain), displayName (≤40 chars), logoUrl (nullable; S3/MinIO path), isSuspended (bool, default false), createdAt, updatedAt. Has many Users, Devices, Invitations, AuditLogs. LAN mode: single implicit tenant row created at first-run with slug="default".

**User**: id (uuid), tenantId (fk), email (unique within tenant), emailVerifiedAt (nullable), passwordHash (Argon2id via Auth.js v5), displayName (account-level; ≤24 chars), role (enum: admin | member), isSuspended (bool, default false), createdAt, updatedAt, lastLoginAt (nullable). Belongs to Tenant; has many Devices, Sessions, Invitations (as inviter).

**Device**: id (uuid), tenantId (fk), userId (fk, nullable for LAN anonymous mode), displayName (≤24 chars), callRole (enum: both | caller | receiver), browserFingerprint (client-generated, persisted to localStorage), lastSeenAt, createdAt. Belongs to Tenant; belongs to User (optional).

**Invitation**: id (uuid), tenantId (fk), invitedByUserId (fk), email (invitee), tokenHash (one-way hash; raw token only in the email), expiresAt (7 days from creation), acceptedAt (nullable), createdAt. Belongs to Tenant; belongs to inviting User.

**AuditLog**: id (uuid), tenantId (fk; null for super-admin actions), actorUserId (fk, nullable), action (string enum: member.invite | member.suspend | member.remove | tenant.brand.update | tenant.suspend | auth.login.success | auth.login.fail | etc.), targetType (User | Tenant | Invitation), targetId (uuid), payload (jsonb; minimal context, no sensitive data), createdAt. Retention: 7 years. L5 always-active.

**CallSession**: id (uuid), tenantId (fk), callerDeviceId (fk Device), calleeDeviceId (fk Device), startedAt (when ringing began), connectedAt (nullable — null if never connected), endedAt, durationSec (computed; null until ended), endReason (enum: completed | declined | busy | no-answer | peer-disconnect | ice-failed | cancelled). Belongs to Tenant; belongs to two Devices. Indexes: (tenantId, startedAt DESC). Retention: 1 year.

**WebPushSubscription**: id (uuid), tenantId (fk; null for LAN anon), userId (fk; nullable for LAN anon), deviceId (fk Device), endpoint (text; Web Push endpoint URL), p256dh (key), auth (key), expiresAt (nullable), createdAt, lastUsedAt. Belongs to Device (1-to-many — one device may have multiple subscriptions across browsers).

**Auth.js v5–managed (schema owned by Auth.js)**: Session, VerificationToken, Account.

## Integrations

- **Auth.js v5** — email/password + magic-link auth, sessions in PostgreSQL — OSS (MIT)
- **PostgreSQL** — primary database — OSS
- **Valkey + BullMQ** — async jobs (invitation/verify/reset emails, logo image processing, 7-day soft-delete cron) — OSS
- **MinIO (dev) / S3 (prod)** — logo + branding asset storage — OSS dev → AWS prod
- **Google STUN** (`stun.l.google.com`) — NAT discovery — public/free
- **coturn (self-hosted)** — TURN relay for users behind strict NAT (Cloud only) — OSS
- **Cloudflare DNS + Wildcard SSL** — `yelli.app` + `*.yelli.app` (Cloud only) — free tier
- **Cloudflare Turnstile** — bot protection on signup, login, password reset (Cloud only; framework V27 default) — free tier
- **Resend** — transactional email (verify, magic link, password reset, member invitation) for Cloud — paid (~$20/mo for 50k emails)
- **SMTP (customer-configured)** — LAN account mode admins configure own SMTP (Gmail App Password, custom relay, or skip) — per-deployment
- **GlitchTip (self-hosted)** — error tracking, Sentry-compatible SDK (Cloud only) — OSS

## Deployment Config

**Yelli Cloud:**
- Environments: dev / staging / prod
- Hosting:      VPS + Komodo orchestration + Traefik reverse proxy (V27 stack)
- Dev mode:     MODE A — WSL2 native (only supported mode — pre-locked)
- Docker Hub:   enabled — hub_repo: powerbyteit/yelli
- Komodo:       staging auto-update from Docker Hub (`:staging-latest`), prod manual deploy from Komodo UI (V27 default)
- TURN:         coturn as Docker service alongside app, ephemeral REST credentials (15-min)

**Yelli LAN:**
- Distribution: Docker image — `docker compose up` (assumes Docker installed on customer's box)
- License:      MIT (open-source — public GitHub repo)
- Auto-update:  none — admin pulls newer images manually
- Base URL:     `http://<lan-ip>:<port>` (HTTPS via self-signed cert when `./scripts/gen-cert.sh` is run)
- Port:         assigned by Phase 3

## Mobile Needs

**Native mobile app:** None — web only, PWA-installable from browser ("Add to Home Screen").
**Auth mode:** sessions live in cookies; persist across browser restarts; expire per Auth.js v5 default (30-day rolling).

**Per-page mobile strategy (auto-classified in Step 8b, reviewed by user):**

| # | Page                                | Strategy       | Notes                              |
|---|-------------------------------------|----------------|------------------------------------|
| 1 | Idle / Directory + CALL button      | Mobile First   | Primary intercom UX — users at posts on phones/tablets |
| 2 | Fullscreen call view                | Mobile First   | Already mobile-first in code; touch-optimised controls |
| 3 | Incoming call modal                 | Mobile First   | Notification / call surface |
| 4 | Peer picker modal                   | Mobile First   | Inline from idle; mobile-primary |
| 5 | First-time display-name prompt      | Mobile First   | First-launch happens on the device that'll be used |
| 6 | LAN first-run setup wizard          | Mobile Ready   | Admin task during install; desktop typical |
| 7 | Settings drawer (name + role)       | Mobile First   | Same device used to call |
| 8 | Org signup (Cloud)                  | Mobile First   | Customer-facing public URL |
| 9 | Log in                              | Mobile First   | Public URL; mobile-primary |
| 10 | Forgot password                    | Mobile First   | Public URL |
| 11 | Reset password landing             | Mobile First   | Email link clicked on phone typically |
| 12 | Verify email landing               | Mobile First   | Email link clicked on phone typically |
| 13 | Magic-link landing                 | Mobile First   | Email link clicked on phone typically |
| 14 | Invitation accept                  | Mobile First   | Invitee opens email on phone |
| 15 | Members list (admin)               | Mobile Ready   | Admin role + table view |
| 16 | Invite member modal                | Mobile Ready   | Admin task; works on mobile, desktop primary |
| 17 | Branding settings                  | Mobile Ready   | Settings panel + logo upload |
| 18 | Org settings (Cloud)               | Mobile Ready   | Settings panel + admin role |
| 19 | Tenant-suspended notice            | Mobile First   | User-facing notification, must work everywhere |
| 20 | Super-Admin `/_pwbt/` tenant list  | Mobile Ready   | Powerbyte staff desk work |
| 21 | Landing page (Cloud marketing)     | Mobile First   | Public URL |
| 22 | Pricing page (Cloud)               | Mobile First   | Public URL |
| 23 | Privacy / Terms / Legal pages      | Mobile First   | Public URL |

**Phase 4 implementation guidance (for Claude Code):**
- **Mobile First pages:** 375px baseline, progressively enhance for tablet (768px+) and desktop (1024px+). Touch targets ≥44×44px. Single-column forms when viewport <768px.
- **Mobile Ready pages:** 1280px+ baseline, gracefully degrade to tablet (768px) and mobile (375px). shadcn/ui responsive patterns: horizontal scroll for wide tables, collapsible sidebars, drawer-based nav on narrow viewports. Full functionality accessible at all breakpoints.
- **Both strategies use shadcn/ui** — difference is breakpoint priority, never the component library.
- **Tailwind breakpoints:** `sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px). Mobile First = base + `md:` enhancements. Mobile Ready = base + `max-md:` fallbacks or conditional rendering.

**Push notifications:** Web Push API + Service Worker (PWA) for incoming-call ringing when tab is backgrounded/closed. Subscriptions stored in `WebPushSubscription` table.

## Non-functional Requirements

Performance:    Signaling relay <100ms at 200 concurrent peers per node; call-setup latency <2s from CALL tap → callee ringing; media is P2P (no server hop). Marketing/auth pages <2s load on mobile 4G.
Uptime:         Yelli Cloud prod 99.5% SLA (≤43min downtime/month). Staging best-effort. LAN N/A (customer-controlled infra).
Data retention: AuditLog 7 years (PH BIR / compliance norm). CallSession metadata 1 year. User accounts indefinite while active; soft-delete grace 7 days then hard delete. VerificationTokens auto-expire per type (1h reset / 7d invite / 24h verify).
Compliance:     PH DPA (RA 10173) primary. GDPR opt-in (export + delete on request) for any EU customer. No PCI-DSS scope in MVP. No HIPAA scope. SOC 2 / ISO 27001 deferred until enterprise customers ask.
Accessibility:  WCAG 2.1 AA — framework V23 default; enforced by `a11y` skill pre-delivery checklist. Set `accessibility: wcag_aa` in inputs.yml.
Encryption:     HTTPS in transit everywhere (Let's Encrypt via Cloudflare + Traefik in Cloud; self-signed cert for LAN). WebRTC media DTLS-SRTP end-to-end (peer-to-peer, never decryptable by signaling server). At-rest filesystem-level encryption on host (Komodo-managed) for Cloud.
Observability:  GlitchTip self-hosted (Sentry-compatible SDK). Docker service alongside app in Cloud compose stack.

**Feature parity (architectural rule, NON-NEGOTIABLE):** every feature must work in both Yelli LAN and Yelli Cloud editions from the same codebase. Phase 2.7 spec stress-test checks every workflow against both modes before code generation. PRs that introduce Cloud-only or LAN-only features without explicit `@dual-mode-exception` annotation MUST be rejected during review.

## Tenancy Model

Mode:                  multi (Cloud) + single (LAN — implicit single-tenant per deployment)
Routing (Cloud):       subdomain — `<slug>.yelli.app`
Shared global data:    none — every entity is tenant-scoped via tenantId
DB isolation exception: none (no payroll/banking/medical data in MVP)

Single codebase serves both. LAN deployment creates one implicit tenant row at first-run (slug="default") and disables the subdomain router. Cloud deployment runs the full multi-tenant stack with subdomain → tenantId resolution at the proxy layer. V25 anti-tenant-switching cross-check: session.tenantId === resolved.slug.tenantId on every Cloud request.

## User-Facing URLs

**Yelli Cloud (root domain — `yelli.app`):**
- `/`                            landing page (public marketing)
- `/pricing`                     pricing page (public)
- `/legal/privacy`               privacy policy (public)
- `/legal/terms`                 terms of service (public)
- `/signup`                      org signup (public)
- `/login`                       login (public)
- `/forgot-password`             password reset request (public)
- `/reset-password?token=...`    password reset landing (token-gated)
- `/verify-email?token=...`      email verification landing (token-gated)
- `/invite?token=...`            invitation accept (token-gated)
- `/_pwbt/`                      Powerbyte Super-Admin console (separate router)
- `/_pwbt/tenants`               tenant list + suspension toggle (Super-Admin only)

**Yelli Cloud (tenant subdomain — `<slug>.yelli.app`):**
- `/`                            redirects to `/app`
- `/app`                         idle / directory (authenticated)
- `/admin/members`               members management (Tenant Admin)
- `/admin/branding`              branding settings (Tenant Admin)
- `/admin/settings`              org settings (Tenant Admin)
- `/settings`                    personal settings (any Member)

**Yelli LAN (`http://<lan-ip>:<port>`):**
- `/`                            idle / directory (anonymous mode) or login (account mode)
- `/setup`                       first-run setup wizard (LAN admin, one-time)
- `/admin/branding`              branding settings (admin)
- `/settings`                    personal device settings

## Access Control

Public routes:    `/`, `/pricing`, `/legal/*`, `/signup`, `/login`, `/forgot-password`, `/reset-password`, `/verify-email`, `/invite`
Protected routes: `<slug>.yelli.app/app`, `<slug>.yelli.app/settings` — require authenticated Member or Admin session in matching tenant
Admin-only:       `<slug>.yelli.app/admin/*` — require Tenant Admin role
Super-Admin only: `/_pwbt/*` — require Powerbyte Super-Admin role (separate tRPC router + dedicated Prisma client per V25)
LAN anonymous:    all routes accessible without login; admin-only routes gated by admin session token set during first-run wizard

## Data Sensitivity

PII stored:       yes — email, displayName, IP address (rate-limiting + audit log), browserFingerprint
Financial data:   no (Xendit deferred to v2)
Health data:      no
Audit required:   yes — every mutation to Tenant, User, Invitation, CallSession via AuditLog (L5 always-active). Login success + login fail events also logged.
GDPR/compliance:  yes — Tenant Admin can request data export (JSON of own tenant's User + Device + AuditLog + CallSession) and tenant deletion (7-day soft delete, then hard delete). PH DPA-aligned.

## Security Requirements

Rate limiting:    public 30/min, auth (login/reset) 10/min, signup 5/hour/IP, password reset 3/hour/email, api 120/min, upload 20/min
CORS origins:     dev: `localhost:*` | staging: `https://*.yelli-staging.app` | prod: `https://*.yelli.app`
Security layers:  L3 RBAC + L5 AuditLog + L6 Prisma guardrails always active. L1+L2+L4 active in Cloud (multi-tenant); dormant in LAN single-tenant (no migration needed if a LAN deployment ever upgrades to multi-tenant).
Anti-enumeration: signup, login, password-reset, invitation flows return generic responses per V25 Secure Code Generation
Tenant guard:     V25 cross-check — `session.tenantId === URL.slug.tenantId` on every Cloud request
Superadmin:       separate tRPC router + dedicated Prisma client for `/_pwbt/`; no shared middleware with tenant-scoped routers (V25)
Bot protection:   Cloudflare Turnstile on signup, login, password-reset (Cloud only)
File download:    server verifies tenantId matches storage path prefix before serving (V25 rule for branding logos)
Cron jobs:        iterate over tenants explicitly when running soft-delete-hard cron (V25 rule — no unscoped queries)

## App Footer (overrides framework default per user instruction)

Footer style:     subtle, centered, small text, muted color, bottom of every page layout
Content:          `Developed by Powerbyte IT Solutions · © [year]` — year auto-updates via `new Date().getFullYear()`
Link:             "Powerbyte IT Solutions" text is an anchor to `https://www.powerbyteitsolutions.com` (target=_blank, rel=noopener)
Immutability:     locked in app shell — NOT editable by Tenant Admins (the Branding feature only overrides header text + logo, never the footer)
Implementation:   single `<Footer />` component in app layout — renders on every page (public + authenticated). Uses `text-muted-foreground text-xs py-4 text-center`.

## Environments Needed

Yelli Cloud:  dev / staging / prod
Yelli LAN:    single environment (customer's box)

## Domain / Base URL Expectations

**Yelli Cloud:**
- Dev:     `http://localhost:[port assigned by Phase 3 — do not specify a number here]`
- Stage:   `https://yelli-staging.app` (+ wildcard `*.yelli-staging.app` for tenant subdomains)
- Prod:    `https://yelli.app` (+ wildcard `*.yelli.app` for tenant subdomains)

**Yelli LAN:**
- All envs: `http://<lan-ip>:[port assigned by Phase 3]` (HTTPS via self-signed cert when `./scripts/gen-cert.sh` is run)

## Infrastructure Notes

All services run in Docker Compose — mono-server for dev/staging/prod (Cloud) and single-machine (LAN).

**Yelli Cloud Docker services:**
- app (Next.js + tRPC + WebSocket signaling) — behind Traefik for automatic TLS
- postgres (PostgreSQL)
- valkey (Valkey + BullMQ workers)
- minio (dev) → S3 (prod)
- coturn (TURN relay)
- glitchtip (error tracking)
- traefik (reverse proxy, automatic Let's Encrypt)
- pgAdmin (all envs — credentials auto-generated by Phase 3)

**Yelli LAN Docker services:**
- app (Next.js + tRPC + WebSocket signaling — same image as Cloud, different config)
- postgres
- valkey (account mode only — anonymous mode runs without Valkey/BullMQ)
- no coturn, no Cloudflare, no Resend, no GlitchTip — LAN is offline-capable by design

**Docker Hub publishing:** enabled — hub_repo: `powerbyteit/yelli`. `push.sh` + `COMMANDS.md` generated by Phase 4 Part 7.

**Komodo deployment (Cloud):** staging `auto_update: true` (polls Docker Hub for `:staging-latest`), prod `auto_update: false` (manual deploy from Komodo UI per V27).

**CREDENTIALS.md:** generated by Phase 3 — master credentials list for all envs, strictly gitignored. Bootstrap Step 18 collects: GitHub PAT, Docker Hub token, Resend API key, Cloudflare API token + Turnstile keys, Komodo tokens, coturn shared secret, SMTP fallback creds.

**Security:** HTTP headers + rate limiter + DOMPurify sanitizer scaffolded by Phase 4 — always-on defaults.

**Spec stress-test (Phase 2.7):** runs automatically before Phase 3 — checks every workflow against both LAN and Cloud editions (feature-parity rule).

**AWS path when ready:** RDS, S3, ElastiCache, SES — update `.env.{env}` only, zero code changes.

## Tech Stack Preferences

Frontend framework:        Next.js
API style:                 tRPC
ORM / DB layer:            Prisma
Auth provider:             Auth.js v5 — email/password + magic link, sessions in PostgreSQL
Auth strategy:             authjs
Primary database:          PostgreSQL
Cache / queue:             Valkey + BullMQ (Cloud always; LAN in account mode only)
File storage:              MinIO (dev) / S3 (prod) — logos + branding assets
UI component library:      shadcn/ui + Tailwind CSS (locked — no alternatives)
Chart library:             none (no dashboards/analytics in MVP)
Map library:               none (no maps in scope)
Complex UI components:     none (standard shadcn primitives cover everything)
Icon set:                  lucide-react (shadcn/ui default — no other icon libraries)
Mobile UI library:         none (PWA web only — no native app)

**WebRTC stack:**
- Signaling:               WebSocket (`ws` library, riding the same HTTP/HTTPS server as the app)
- NAT discovery (STUN):    `stun.l.google.com` (both editions)
- NAT relay (TURN):        coturn self-hosted (Cloud only — LAN doesn't need TURN)
- Media:                   peer-to-peer DTLS-SRTP — never touches the signaling server

**PWA stack:**
- Service worker:          Web Push notifications + offline shell
- Manifest:                app installable from browser ("Add to Home Screen")
- Web Push:                `web-push` (server) + Push API (client)

## Design Identity

Brand feel:         Friendly / approachable / warm B2B SaaS — not enterprise-cool
Target aesthetic:   **Clay.com design system** — cream-tinted white canvas (#fffaf0), dark-navy primary CTAs (#0a0a0a), 6-color saturated brand palette (pink / teal / lavender / peach / ochre / mint), generous border radius (12px buttons, 24px feature cards), Inter font (Plain Black not licensed — Inter 500 with negative letter-spacing as substitute)
Industry category:  Communications Platform (SaaS + self-host)
Dark mode required: no (out of scope per Section 11)
Key constraint:     WCAG AA accessibility
Theming approach:   shadcn/ui CSS variables (`--primary`, `--secondary`, etc.) — customized in `globals.css` per Clay-derived tokens
Design system:      see `docs/DESIGN.md` (Clay aesthetic — DESIGN.md exists at `AlphaTest/DESIGN.md` from prior session; carry forward into Phase 2.6)
Reference:          https://ui.shadcn.com/docs/theming · Dark mode docs: https://ui.shadcn.com/docs/dark-mode

## Out of Scope

**Communication features:**
- Group calls (3+ participants) — strictly 1-on-1 per Problem Statement
- Screen sharing
- In-call text chat
- Call recording
- Call history UI (CallSession exists as audit data; no user-facing log view in MVP)
- Live captioning / transcription
- Multi-language i18n (English only at MVP)
- Dark mode toggle

**Mobile / distribution:**
- Native iOS / Android app (PWA covers MVP)
- LAN single-binary or install-script distribution (Docker image only)
- LAN auto-update mechanism (admin pulls newer images manually)
- Bluetooth / USB peripheral selection UI

**Accounts / auth:**
- Social login providers (Google, GitHub) — Auth.js supports it; deferred to v2
- Enterprise SSO / SAML (Keycloak path; not requested)
- 2FA / TOTP / WebAuthn — defer to v2

**Tenancy / billing:**
- Self-serve subscription + billing via Xendit (manual invoicing in MVP)
- Seat-limit enforcement (display only — enforcement is v2 billing concern)
- Custom domains beyond `*.yelli.app` (e.g. `intercom.acme.com` reverse-mapped) — v2
- Cross-deployment federation (Yelli Cloud user calling a Yelli LAN user across deployments)

**Admin / ops:**
- Full Powerbyte super-admin console (only minimal `/_pwbt/` tenant list + suspend in MVP)
- Tenant data export by Powerbyte staff (only by Tenant Admin themselves per GDPR/DPA)
- Tenant impersonation by support staff

**Integrations:**
- Public API for 3rd-party integrations
- Webhooks for tenant events (member.created etc.)
- n8n / OpenClaw automation workflows (none declared in Step 5 per Rule 11)

**Compliance scope (don't apply at MVP):**
- PCI-DSS scope (no payment data — Xendit deferred to v2)
- HIPAA scope (not a medical product; no PHI stored)
- SOC 2 / ISO 27001 audit certification (defer until enterprise customers ask)

---

## DECISIONS_LOG guidance for Claude Code (Brownfield Adoption)

**Stack migration — Prompt 1.5 territory:**

The existing Yelli LAN MVP at `AlphaTest/` is built on a different stack than this PRODUCT.md targets. Phase 3 must generate `inputs.yml` with `migration.brownfield: true` and Phase 4 Part 1 must rewrite the signaling layer rather than retrofit the framework around the existing code.

| Concern | Current (AlphaTest/) | Framework target (this PRODUCT.md) |
|---|---|---|
| Backend runtime | Vanilla Node.js (http + ws) | Next.js 16 + Node 24 |
| API style | Raw WebSocket message types | tRPC + WebSocket subscription for signaling |
| Database | None (in-memory `Map<id, ws>`) | PostgreSQL + Prisma |
| Auth | None (ephemeral hex IDs) | Auth.js v5 |
| Frontend | Single-file vanilla HTML + inline CSS/JS | Next.js + React + shadcn/ui + Tailwind |
| Styling | Clay tokens applied inline as CSS variables | Clay tokens as shadcn/ui CSS variables in `globals.css` |
| Container | Dockerfile present (single-stage) | Multi-service compose + Traefik (Cloud); minimal compose (LAN) |
| Deployment | Manual `node server.js` + cloudflared tunnel | Komodo + Traefik + Docker Hub (Cloud); `docker compose up` (LAN) |

**Phase 2.8 Visual Checkpoint:** **SATISFIED** — working UI artifact exists at `AlphaTest/public/index.html` (Clay design tokens already applied). React mockup generation skipped per SITUATION D step 6. The existing client is the reference for the Phase 4 React rebuild.

**Audit trail of decisions captured during reverse-extraction interview (SITUATION D):**
- Dual-deployment (LAN + Cloud, feature parity) — top-level architectural rule
- Cloud tenancy = B2B multi-tenant
- LAN account mode = optional (anonymous mode is the default)
- Per-device display names (replaces hex IDs)
- Per-tenant branding (header text + logo)
- Powerbyte footer immutable (text + link locked, year auto-updates)
- Tenant URL routing = subdomain (`*.yelli.app`)
- Super-admin console = minimal `/_pwbt/` only (defer full console to v2)
- TURN server = self-hosted coturn (Cloud)
- SMTP = Resend (Cloud), customer-configured (LAN account mode)
- Cloudflare Turnstile = enabled (Cloud public endpoints)
- Domains: `yelli.app` (prod), `yelli-staging.app` (staging)
- LAN distribution = Docker image only
- LAN license = MIT (public repo)
- Push notifications = Web Push + PWA service worker
- Native mobile app = none (PWA only)
- Observability = GlitchTip self-hosted
- CallSession entity included as audit-only (no UI in MVP)
- Manual invoicing in MVP; Xendit self-serve billing deferred to v2
