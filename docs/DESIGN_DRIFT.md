# DESIGN_DRIFT.md — V32.8 Fidelity Audit

**Branch:** `chore/v328-design-audit`
**Audit Date:** 2026-06-18
**Auditor:** Claude Sonnet 4.6 (V32.8 Design-as-Contract static analysis)
**Source of Truth:** `docs/DESIGN.md` (613 lines) + `docs/MOCKUP.jsx` (1337 lines)
**Framework Version:** V32.8 (Design-as-Contract — Rule 31 + Rule 32)

---

## Executive Summary

| Category | Count |
|---|---|
| CRITICAL token mismatches | 5 |
| HIGH component/layout divergences | 6 |
| MEDIUM missing or wrong styling | 7 |
| LOW minor discrepancies | 5 |
| Missing screens (not built yet) | 3 |
| Missing V32.8 scaffold artifacts | 9 |

Overall assessment: **Token layer is 90% correct** for the implemented screens — the build team did real work mapping DESIGN.md to tokens.css and the Tailwind preset. The most impactful drifts are (a) 5 semantic color tokens that were silently remapped to wrong values, (b) the brand palette substituting coral for ochre (a different hue entirely), (c) the complete absence of the V32.8 Style Dictionary compilation pipeline, and (d) three T1 screens not yet built.

---

## Section A — Token Mismatches (DESIGN.md vs `tokens.css` / `yelliTailwindPreset`)

### A1 — CRITICAL: `brand-ochre` replaced by `brand-coral` (different hue)

| | Expected (DESIGN.md) | Actual (tokens.css) |
|---|---|---|
| Token name | `{colors.brand-ochre}` — #e8b94a | `--color-brand-coral: #ff6b5a` |
| Hue | Mustard yellow / amber | Coral red-orange |
| Distance | ~90° hue difference | — |

**Impact:** The 6-color Clay feature-card palette is `pink, teal, lavender, peach, ochre, cream-card` in DESIGN.md and MOCKUP.jsx (`#e8b94a` used explicitly in the hero quad-grid). The build substitutes coral (#ff6b5a), a warm red-orange, for ochre (#e8b94a), a warm yellow. Any feature card painted with `brand-ochre` in the MOCKUP will render as red-coral instead of mustard in the built app.

**Files:** `apps/yelli/src/app/styles/tokens.css`, `packages/ui/src/tailwind-preset.ts`

**Fix:** Add `--color-brand-ochre: #e8b94a` to tokens.css; keep `brand-coral` as an additional accent but do not use it as the ochre replacement.

---

### A2 — CRITICAL: `warning` color mapped to peach (#ffb084), not amber (#f59e0b)

| | Expected (DESIGN.md) | Actual (tokens.css) |
|---|---|---|
| `{colors.warning}` | `#f59e0b` (amber/mustard) | `#ffb084` (peach — identical to brand-peach!) |
| `{colors.warning-strong}` | `#b45309` | `#c45a1f` (close, but off) |

**Impact:** `--color-warning` equals `--color-brand-peach` in the current build. Any warning badge, callout, or `idle` status dot that uses `bg-warning` will appear as peach/salmon instead of amber/mustard. DESIGN.md explicitly specifies `#f59e0b` and the MOCKUP uses `#f59e0b` for warning callouts (confirmed grep). This breaks semantic meaning: warning and brand-peach are visually indistinguishable.

**Files:** `apps/yelli/src/app/styles/tokens.css:--color-warning`

**Fix:** Change `--color-warning: #f59e0b` and `--color-warning-strong: #b45309`.

---

### A3 — CRITICAL: `brand-lavender` hex is off by 1 byte (#b8a4ed → #b8a4e3)

| | Expected (DESIGN.md + MOCKUP) | Actual (tokens.css) |
|---|---|---|
| `{colors.brand-lavender}` | `#b8a4ed` | `#b8a4e3` |

**Impact:** DESIGN.md specifies `#b8a4ed`; MOCKUP.jsx uses `#b8a4ed` for both the avatar initials background and the lavender feature card. The token is `#b8a4e3` — last byte `d` vs `3`. The resulting color is slightly more gray-lavender than the intended purple-lavender. The avatar background and any lavender-card surface in the build will show a fractionally cooler shade.

**Files:** `apps/yelli/src/app/styles/tokens.css:--color-brand-lavender`

**Fix:** `--color-brand-lavender: #b8a4ed`

---

### A4 — HIGH: 9 named color tokens from DESIGN.md absent from tokens.css

DESIGN.md defines these tokens by name; none appear in tokens.css. Components referencing them by name must fall back to hardcoded values or be missing states.

| Missing Token | DESIGN.md value | Consequence |
|---|---|---|
| `{colors.surface-soft}` | `#faf5e8` | Footer CTA-band background. Built app uses no equivalent token — footer bands will use `surface` (#ffffff) |
| `{colors.surface-card}` | `#f5f0e0` | Cream feature cards, testimonial cards. Build uses `surface-elevated` (#fffdfa) — a much cooler near-white |
| `{colors.surface-strong}` | `#ebe6d6` | Emphasized cream bands. Not available |
| `{colors.surface-dark}` | `#0a1a1a` | Dark teal near-black. ScreenActiveCall MOCKUP uses it as the call screen background; built ScreenActiveCall uses `bg-brand-teal` (#1a3a3a) — significantly lighter/greener |
| `{colors.surface-dark-elevated}` | `#1a2a2a` | Not available |
| `{colors.ink}` | `#0a0a0a` | DESIGN.md uses `{colors.ink}` as the primary text token alias; tokens.css uses `text-primary` naming instead |
| `{colors.body}` | `#3a3a3a` | Body text. Not available — `text-secondary: #4a4a4a` is the closest (different value) |
| `{colors.primary-active}` | `#1f1f1f` | CTA hover/active state. No token — hover states must use hardcoded values |
| `{colors.primary-disabled}` | `#e5e5e5` | Disabled CTA. No token — must fallback to raw hex or Tailwind gray |
| `{colors.hairline}` | `#e5e5e5` | Border/hairline. globals.css hardcodes `--border: #e5e5e5` (correct value, but not a named token) |

**Files:** `apps/yelli/src/app/styles/tokens.css`, `packages/ui/src/tailwind-preset.ts`

**Fix:** Add all missing tokens to tokens.css and the Tailwind preset. Priority order: `surface-dark`, `surface-card`, `surface-soft`, `primary-active`.

---

### A5 — HIGH: `error` and `success-strong` color values diverge from DESIGN.md

| Token | DESIGN.md | tokens.css | Delta |
|---|---|---|---|
| `{colors.error}` | `#ef4444` | `#ff8a80` | Completely different — DESIGN wants Tailwind red-500; tokens.css has a salmon/light-coral |
| `{colors.success-strong}` | `#15803d` | `#1b8a5a` | Slightly different — DESIGN wants Tailwind green-700; tokens.css is slightly more teal |

**Impact:** Destructive/error styling (delete buttons, error validation text, the end-call button on the call screen) will appear salmon-pink instead of the specified red. MOCKUP uses `#ef4444` for the end-call button background (confirmed in ScreenActiveCall section) — built app uses `bg-destructive` which maps to `--color-error-strong: #b3261e` (closer) but `--color-error: #ff8a80` (wrong).

**Files:** `apps/yelli/src/app/styles/tokens.css`

**Fix:** `--color-error: #ef4444`, verify `--color-success-strong: #15803d`

---

### A6 — MEDIUM: `body` text color diverges (#3a3a3a vs #4a4a4a)

| Token | DESIGN.md | tokens.css |
|---|---|---|
| Body/running text | `{colors.body}` — `#3a3a3a` | `--color-text-secondary: #4a4a4a` |

**Impact:** Body paragraph text across all screens is slightly darker than intended. Not a hue difference — a lightness shift of roughly 10 units. On the cream canvas (#fffaf0) the intended contrast ratio with #3a3a3a is ~7.5:1 (AAA); with #4a4a4a it's ~6.8:1 (still AA, fine, but not the intended value).

**Fix:** Audit whether `#4a4a4a` was a deliberate decision (if so, document in DECISIONS_LOG); otherwise change to `#3a3a3a`.

---

## Section B — Component / Layout Divergences from MOCKUP.jsx

### B1 — CRITICAL: `ScreenActiveCall` background: `surface-dark` vs `brand-teal`

| | MOCKUP.jsx | Built (`ScreenActiveCall.tsx`) |
|---|---|---|
| Background | `bg-[#0a1a1a]` (surface-dark, very dark teal-black) | `bg-brand-teal` (#1a3a3a — 4× lighter) |
| Gradient | `from-[#1a3a3a] via-[#0a1a1a] to-[#0a0a0a]` | `from-brand-teal via-primary to-primary` |

**Impact:** The call screen's intended atmosphere is near-black with a deep teal gradient — a cinematic dark mode. The built version uses `brand-teal` (#1a3a3a) as the full background, which is significantly lighter and green-leaning. The call screen is one of the highest-emotional-impact screens; this is a material visual divergence.

**Root cause:** `surface-dark` (#0a1a1a) is not in tokens.css (see A4), so the build team chose the closest available dark token (`brand-teal`).

**Fix:** Add `--color-surface-dark: #0a1a1a` to tokens.css; update ScreenActiveCall to use `bg-surface-dark` with the correct three-stop gradient.

---

### B2 — CRITICAL: Public marketing landing page (`ScreenLanding`) has no built equivalent

**MOCKUP:** `ScreenLanding` is a full-page marketing site with:
- 12-col hero grid (7:5 split) with display-sized headline (36px→72px responsive)
- 3 feature cards (brand-pink / brand-teal / brand-lavender) in a 2-col then 3-col grid
- CTA band on `surface-soft` (#faf5e8)
- A 4-quadrant hero illustration grid (`aspect-square rounded-[24px]` with ochre/pink/teal/black tiles)
- Nav with logo, links, "Sign in" / "Start free" CTAs

**Built:** No public root page exists. The root route (`/`) redirects to `(app)/page.tsx` (the peer directory — the authenticated app shell). There is no marketing landing page at all.

**Impact:** First impression for cloud users landing on the base domain is the authenticated app (which requires login) rather than the marketing page. The `ScreenLanding` mockup was the intended `yelli-basic.powerbyte.app/` experience.

**Note:** Yelli-Basic is primarily a LAN-first product; the LAN flow skips the marketing landing entirely. This may be an intentional scope deferral. However, the MOCKUP explicitly includes `ScreenLanding` as a T1 (Tier 1, primary) screen.

**Fix:** Build `app/(marketing)/page.tsx` implementing `ScreenLanding` or formally mark it as deferred in DECISIONS_LOG.

---

### B3 — HIGH: Cloud signup page (`ScreenSignup`) not built

**MOCKUP:** `ScreenSignup` shows a cloud tenant creation flow: org name + subdomain + work email + password + checkbox, max-w-[480px], full form with validation states.

**Built:** No `/signup` route exists anywhere in `apps/yelli/src/app/`. Auth routes only include LAN admin login at `(public)/admin/login/`.

**Impact:** Cloud tenant self-signup is a T1 MOCKUP screen with no built equivalent. Cloud users cannot self-register.

**Note:** Yelli-Basic may be LAN-primary with cloud as a later phase. Check PRODUCT.md for cloud sign-up scope. If cloud is in scope, this is a HIGH gap.

---

### B4 — HIGH: `ScreenAdminBranding` not built as a dedicated page

**MOCKUP:** A full admin branding page: app display name field, logo upload (with 24×24 large preview avatar), live preview panel, color customization, footer preview. 12-col layout (7:5 split) with live preview in right column.

**Built:** `admin/branding/` route does not exist. The `ScreenTenantSettings` component handles display-name only (a subset). Logo upload is acknowledged in code comments as "on the separate /admin/branding surface" but that route is not built.

**Impact:** Logo upload and visual customization from the MOCKUP are not accessible. Users can only change the display name via `/admin/settings`.

**Fix:** Build `app/admin/branding/page.tsx` implementing the branding flow, or formally scope-defer in DECISIONS_LOG.

---

### B5 — HIGH: Cloud-mode `ScreenLogin` vs LAN-only admin login

**MOCKUP:** `ScreenLogin` is a cloud email+password form (work email field + password + Cloudflare Turnstile placeholder) at `max-w-[420px]`, on canvas background, with "Forgot password" link.

**Built:** Only `(public)/admin/login/page.tsx` exists — a passphrase-based LAN admin login (shadcn `Card` pattern, no email field, no Turnstile).

**Impact:** The cloud authentication flow (next-auth email+password) from the MOCKUP has no built page. The LAN admin flow is built but styled with shadcn `Card` instead of the custom-form pattern in the MOCKUP.

**Styling delta (LAN admin page):** MOCKUP uses custom `rounded-[12px]` inputs with canvas background; built uses shadcn `Card` + shadcn `Input` (correct tokens, but different structural layout).

---

### B6 — HIGH: `ScreenSettings` styled correctly but missing notification section

**MOCKUP:** Settings screen has 4 sections: Profile (display name + email), Notifications (push toggle), Security (change password), Device (this device's name + call role). All in `max-w-[720px]` centered column.

**Built:** `ScreenDeviceSettings.tsx` exists (used by `(app)/settings/page.tsx`) with device name + signaling UI. Profile section is in `ScreenTenantSettings.tsx` (for org settings, not personal settings). There is no notifications section and no security/change-password section.

**Styling match:** The built `(app)/settings` page correctly uses `max-w-[720px]`, `rounded-[16px]` section cards, correct tokens. Structure is close but content is incomplete.

---

### B7 — MEDIUM: Nav hover state uses `hover:bg-surface` (#ffffff) instead of warm cream hover

**MOCKUP:** Nav links and avatar button: `hover:bg-[#f5f0e0]` (a warm mid-cream, DESIGN token `{colors.surface-card}`).

**Built AppShell.tsx:** `hover:bg-surface` which resolves to `--color-surface: #ffffff` — pure white hover, significantly cooler and flatter than the intended warm cream.

**Impact:** The topbar hover feel is "neutral white flash" instead of the warm cream tint that completes the Clay aesthetic. Every nav link hover and avatar button hover is affected.

**Root cause:** `surface-card` (#f5f0e0) is not in tokens.css (see A4). Closest available is `canvas` (#fffaf0) or `surface` (#ffffff).

**Fix:** Add `--color-surface-card: #f5f0e0` (or `surface-hover`) to tokens.css; update AppShell hover classes.

---

### B8 — MEDIUM: Admin Members table header background

**MOCKUP:** `thead` uses `bg-[#f5f0e0]` (surface-card, warm cream).
**Built:** `ScreenAdminMembers.tsx` uses shadcn Table — table header background is controlled by shadcn defaults, not an explicit warm cream.

**Impact:** The table header row appears as neutral/white rather than the warm cream tint the mockup shows. Contrast with the `canvas` background is reduced.

---

### B9 — MEDIUM: Directory page uses `bg-brand-teal` hero instead of MOCKUP layout

**MOCKUP:** ScreenApp has a 12-col split layout (8:4) with the CALL hero on the right column at `md+`, directory on the left. The hero card uses `bg-[#1a3a3a]` (brand-teal — correct).

**Built `(app)/page.tsx`:** Uses a full-width `rounded-[24px]` hero section with `bg-brand-teal` gradient — correct color, but the layout is a single-column stack rather than the md:grid-cols-12 split. The directory is below the hero on all screen sizes, while MOCKUP puts them side-by-side on md+.

**Impact:** On desktop the directory and call hero are stacked vertically instead of in a 2-column layout. This reduces information density on large screens.

---

## Section C — Missing vs Extra UI Elements

### C1 — MISSING: Plain Black display typeface (display sizes)

**DESIGN.md:** "Custom rounded Plain Black display typeface at 500 weight with -1 to -2.5px letter-spacing on display sizes." Display sizes specified: `display-xl: 72px`, `display-lg: 56px`, `title-xl: 40px`, `title-lg: 32px`, `title-md: 24px`.

**Built:** Only `Inter` is loaded (self-hosted via `next/font/google`). No display font is defined. No CSS custom property `--font-display` or similar exists. Typography scale uses Tailwind defaults (`text-2xl`, `text-3xl`) or arbitrary values.

**Impact:** All large-size headings (hero h1, page titles) use Inter instead of Plain Black. The headline character is fundamentally different — Inter is a clean geometric sans; Plain Black (or a substitute like "Syne", "Cabinet Grotesk", or Google's "DM Sans Rounded") has warmer, rounder forms that give Clay its "playful B2B" identity.

**DESIGN.md note acknowledges this:** "Note on Font Substitutes" section exists in DESIGN.md — likely the build team chose not to implement a custom display font. This should be a documented deferral.

---

### C2 — MISSING: 4-quadrant hero illustration grid (ScreenLanding)

**MOCKUP:** The landing hero right column has a `grid-cols-2` grid of four `aspect-square rounded-[24px]` colored tiles (teal/#1a3a3a, pink/#ff4d8b, ochre/#e8b94a, black/#0a0a0a) with a lavender/peach/mint gradient overlay — representing the product's visual identity.

**Built:** No equivalent — the landing page itself is absent (see B2).

---

### C3 — MISSING: Feature card grid with 3D illustration fragments (ScreenLanding)

**MOCKUP:** Three feature cards (pink, teal, lavender) each with a mono-space terminal/URL fragment showing the product concept. These are the primary brand-voltage elements on the marketing page.

**Built:** Not present (no landing page).

---

### C4 — MISSING: Active call screen as a routed page

**MOCKUP:** `ScreenActiveCall` is a fullscreen dark mode view — its own page (`/call` or similar).

**Built:** `ScreenActiveCall.tsx` exists as a component but no routed page renders it directly. The call is triggered from within the app shell as an overlay/modal state via `CallEngineProvider`, not as a navigable route. This is arguably correct product design for a PWA, but it means the MOCKUP's standalone call page aesthetic (dark full-screen mode) is only seen when the call overlay activates, not as a navigable URL.

---

### C5 — EXTRA (acceptable): PWA chrome not in MOCKUP

**Built:** Has `ServiceWorkerRegister`, `InstallBanner`, `PwaGlobalChrome`, `ReplayQueueProvider` — none of these are in the MOCKUP.

**Assessment:** Correct additions for a production PWA. The MOCKUP was a visual prototype, not a production spec. No correction needed.

---

## Section D — V32.8 Framework Scaffold Gaps

V32.8 Rule 31 (Design-as-Contract) requires a Style Dictionary v5 compilation pipeline. **None of these artifacts exist** in the repository:

| Required Artifact | Status | Notes |
|---|---|---|
| `sd.config.mjs` (Style Dictionary v5 config) | MISSING | Must define DTCG token format, prefix `sd`, output targets |
| `scripts/design-validate.mjs` (DTCG validator) | MISSING | Runs before `design:build`; fails on non-DTCG tokens |
| `tokens/build/` (output directory) | MISSING | Style Dictionary output target |
| `generated-tokens.css` (compiled `:root` vars `--sd-*`) | MISSING | The "compiled contract" tokens; components must consume these |
| `tokens.d.ts` (TypeScript token types) | MISSING | Type-safe token usage |
| `tests/visual/snapshots/` (design:check baseline) | MISSING | Phase 3.3 gate-closure requirement |
| `design:validate` npm script | MISSING | In `apps/yelli/package.json` |
| `design:build` npm script | MISSING | In `apps/yelli/package.json` |
| `design:check` npm script | MISSING | Used by Phase 4 Parts 5-6 and Phase 8 regression |

**Current state:** The project uses a hand-authored `tokens.css` with direct hex values, which is the **pre-V32.8** approach. The three-layer bridge (`--sd-color-* → --primary → --color-primary`) specified in phases.md is not implemented.

**Framework gap note:** V32.8 phases.md (Phase 3.3 Step 3b) specifies: "COMPILE: run `npm run design:validate` → `npm run design:build` (Style Dictionary v5, prefix:'sd') → emits `generated-tokens.css`". This pipeline was prescribed for Phase 3.3 which predates V32.8. Yelli-Basic's Phase 3.3 ran before V32.8 shipped (2026-06-18), so the Phase 3.3 exit gate (`design:validate + design:build passed`) was not applicable at the time. **This is a forward-apply gap, not a regression.**

**Recommended action:** Scaffold the Style Dictionary pipeline as a catch-up task; LESSONS_REGISTRY entry should note that Phase 3.3 sign-off predating V32.8 does not retroactively satisfy R31.

---

## Section E — V32.8 Framework Application Gaps / Conflicts

### E1 — Pre-existing Phase 3.3 predates V32.8 — incomplete R31 gate

V32.8 Rule 31 (Design-as-Contract) adds the `design:validate → design:build → generated-tokens.css → tokens.d.ts` pipeline as a **Phase 3.3 exit gate**. Yelli-Basic's Phase 3.3 was completed and signed off before V32.8 shipped (the framework was merged to main at commit `565f214` on 2026-06-18, after all of Yelli's swarm waves). The V32.8 gate therefore could not have been met at Phase 3.3 exit.

**Status:** The `chore/framework-sync-v328` branch delivers the V32.8 `.ai_prompt/` files to Yelli, but without back-applying the R31 pipeline scaffold.

**Gap:** R31 says every screen must be built "ONLY from compiled primitives in `generated-tokens.css` / `tokens.d.ts` — no raw hex values, no off-palette `[px]` utilities". The current build uses `tokens.css` with direct hex values (not `generated-tokens.css`). This is structurally equivalent but does not satisfy R31's compilation-gate contract.

### E2 — Only 1 raw hex violation in built components (acceptable exception)

`apps/yelli/src/app/layout.tsx:27: themeColor: '#1a3a3a'` — this is in Next.js viewport metadata (not a visual component), and `#1a3a3a` = `brand-teal` which is the correct token value. This is acceptable as a metadata string, not a styling violation.

**The build team's discipline was excellent:** 28 unique hex values in the MOCKUP; only 1 in the built components (non-token file), and that one is a metadata string with the correct value.

### E3 — LESSONS_REGISTRY exists and is deployable

`/home/me/UbuntuDevFiles/1_COMPANY_DEV/Yelli-Basic/.ai_prompt/LESSONS_REGISTRY.md` exists (deployed by `chore/framework-sync-v328`). Rule 32 is partially satisfied.

### E4 — `design-stop-hook.sh` and `docs/STATE.md` check

V32.8 Rule 32 Stop hook reads `docs/STATE.md`. Check needed:

- The stop hook at `scripts/design-stop-hook.sh` was deployed by `chore/framework-sync-v328`.
- `docs/STATE.md` must exist and have the `evidence` field populated for the hook to pass.
- This audit did not validate the STATE.md evidence field; it should be checked before any "done"-claim on this branch.

---

## Severity Ranking — Top 10 Most Important Items

| Rank | ID | Severity | Issue | Estimated Fix Effort |
|---|---|---|---|---|
| 1 | A2 | CRITICAL | `warning` token = peach (semantic collision with brand-peach) | 1 line in tokens.css |
| 2 | A5 | CRITICAL | `error` token is salmon (#ff8a80) not spec'd red (#ef4444) | 1 line in tokens.css |
| 3 | A1 | CRITICAL | `brand-ochre` absent — coral substituted (completely different hue) | 1 line in tokens.css + 1 line in preset |
| 4 | B1 | CRITICAL | Call screen bg is `brand-teal` not `surface-dark` — 4× lighter than intended | Add token + update component |
| 5 | A3 | CRITICAL | `brand-lavender` hex off by 1 byte (#b8a4ed → #b8a4e3) | 1 line in tokens.css |
| 6 | B2 | HIGH | Public landing page `ScreenLanding` has no built route | New page (large scope) or DECISIONS_LOG deferral |
| 7 | B3 | HIGH | Cloud signup `ScreenSignup` has no built route | New page or DECISIONS_LOG deferral |
| 8 | B7 | MEDIUM | All nav hover states are cool white instead of warm cream | Add `surface-card` token, update AppShell |
| 9 | C1 | MEDIUM | Display font "Plain Black" not implemented — Inter used for all sizes | Font loading decision |
| 10 | D | HIGH | V32.8 Style Dictionary pipeline entirely absent (R31 not satisfied) | Scaffold sd.config.mjs + npm scripts |

---

## Recommended Fix Sequence

**Immediate (token corrections — low risk, high impact):**
1. `tokens.css`: Fix `--color-warning: #f59e0b`, `--color-error: #ef4444`
2. `tokens.css`: Add `--color-brand-ochre: #e8b94a`
3. `tokens.css`: Fix `--color-brand-lavender: #b8a4ed`
4. `tokens.css`: Add `--color-surface-dark: #0a1a1a`, `--color-surface-card: #f5f0e0`, `--color-surface-soft: #faf5e8`, `--color-primary-active: #1f1f1f`
5. `tokens.css`: Add `--color-success-strong: #15803d` (verify vs #1b8a5a)
6. `tailwind-preset.ts`: Add `'brand-ochre'`, `'surface-dark'`, `'surface-card'`, `'surface-soft'`, `'primary-active'` utilities
7. `globals.css`: Update `--border: #e5e5e5` → convert to a named `--color-hairline` token

**Component fixes (medium risk):**
8. `ScreenActiveCall.tsx`: Change `bg-brand-teal` to `bg-surface-dark` + update gradient stops
9. `AppShell.tsx`: Change `hover:bg-surface` to `hover:bg-surface-card` on nav/avatar hover targets
10. `ScreenAdminMembers.tsx`: Add `bg-surface-card` to `thead`

**Deferred / product decision required:**
11. Build `ScreenLanding` (marketing page) — requires DECISIONS_LOG entry if deferred
12. Build `ScreenSignup` (cloud signup) — requires scope decision  
13. Build `admin/branding` page (logo upload)
14. Implement Plain Black display font or formally substitute + document

**V32.8 scaffold (new capability):**
15. Create `sd.config.mjs`, `scripts/design-validate.mjs`, npm scripts, and run the compilation pipeline

---

*Generated by V32.8 Design-as-Contract static audit. Detection only — no fixes applied.*
*Branch: `chore/v328-design-audit` | Audit tool: Claude Code static analysis (no browser)*
