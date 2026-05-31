/**
 * MOCKUP.jsx — Yelli Phase 2.8 visual mockup (audit-pass revision)
 *
 * Purpose: Visual check of PRODUCT.md interpretation BEFORE Phase 2 architecture
 *          spec. Not live. No real data. No persistence. Tokens come from
 *          DESIGN.md (Clay system, locked Step 8 + audit-pass token additions).
 *
 * Tier 1 (8 screens, full fidelity):
 *   1. landing       — Cloud public marketing (yelli.app)
 *   2. signup        — org signup w/ slug picker + 18 reserved names + Turnstile
 *   3. login         — Cloud auth entry
 *   4. app           — Idle / Directory (both LAN + Cloud; role-gated CALL)
 *   5. call          — Active call view (video + PiP + controls)
 *   6. members       — /admin/members (promote/demote + suspend + call-role +
 *                      Archived filter; last-admin guard on Remove + Demote)
 *   7. branding      — /admin/branding (logo + name override + LAN passphrase reset)
 *   8. settings      — Personal settings (profile + notifications + devices)
 *
 * Tier 2 (stubs): pricing, legal/privacy, legal/terms, forgot, reset, verify,
 *   invite, pwbtRoot, pwbtTenants, pwbtImport, orgSettings, lanSetup,
 *   lanLogin, tenantSuspended.
 */

import React, { useState } from "react";

/* ------------------------------------------------------------------ */
/* DESIGN TOKENS (DESIGN.md / Clay system — locked Step 8 + audit pass) */
/* ------------------------------------------------------------------ */

const T = {
  canvas: "#fffaf0",
  surfaceSoft: "#faf5e8",
  surfaceCard: "#f5f0e0",
  surfaceStrong: "#ebe6d6",
  surfaceDark: "#0a1a1a",
  surfaceDarkElevated: "#1a2a2a",
  hairline: "#e5e5e5",
  hairlineSoft: "#f0f0f0",
  ink: "#0a0a0a",
  primaryActive: "#1f1f1f",
  bodyStrong: "#1a1a1a",
  body: "#3a3a3a",
  muted: "#6a6a6a",
  mutedSoft: "#9a9a9a",
  onPrimary: "#ffffff",
  brandPink: "#ff4d8b",
  brandTeal: "#1a3a3a",
  brandLavender: "#b8a4ed",
  brandPeach: "#ffb084",
  brandOchre: "#e8b94a",
  brandMint: "#a4d4c5",
  brandCoral: "#ff6b5a",
  success: "#22c55e",
  successStrong: "#15803d",
  warning: "#f59e0b",
  warningStrong: "#b45309",
  error: "#ef4444",
  errorStrong: "#b91c1c",
};

/* ------------------------------------------------------------------ */
/* DUMMY DATA — Filipino dental clinic (collapsed to 4 family groups)  */
/* ------------------------------------------------------------------ */

const TENANT = {
  slug: "maes",
  legalName: "Maes Dental Clinic",
  brandedName: "Maes Intercom",
  logoLetter: "M",
  plan: "Starter",
};

// ME is Maria Mendoza (the user viewing this mockup) — admin, "both" callRole
const ME = {
  name: "Maria Mendoza",
  email: "maria@maesdental.ph",
  role: "admin",
  callRole: "both",
};

// 4 family groups: Mendoza, Salazar, Cruz, Bautista. callRole per device.
// status: online | idle | offline | suspended | archived (>90d offline)
const MEMBERS = [
  { name: "Maria Mendoza",       email: "maria@maesdental.ph",     role: "admin",  status: "online",   callRole: "both",     device: "Reception PC",        lastSeen: "now" },
  { name: "Dr. Ryan Salazar",    email: "ryan@maesdental.ph",      role: "admin",  status: "online",   callRole: "both",     device: "Operatory 1 iPad",    lastSeen: "now" },
  { name: "Dr. Janelle Salazar", email: "janelle@maesdental.ph",   role: "member", status: "online",   callRole: "receiver", device: "Operatory 2 iPad",    lastSeen: "now" },
  { name: "Joel Bautista",       email: "joel@maesdental.ph",      role: "member", status: "online",   callRole: "receiver", device: "Operatory 1 Asst",    lastSeen: "now" },
  { name: "Patricia Mendoza",    email: "patty@maesdental.ph",     role: "member", status: "idle",     callRole: "receiver", device: "Operatory 3 iPad",    lastSeen: "12m" },
  { name: "Marco Mendoza",       email: "marco@maesdental.ph",     role: "member", status: "online",   callRole: "caller",   device: "Front Desk Phone",    lastSeen: "now" },
  { name: "Aileen Cruz",         email: "aileen@maesdental.ph",    role: "member", status: "offline",  callRole: "caller",   device: "Insurance Laptop",    lastSeen: "1d" },
  { name: "Ferdinand Cruz",      email: "ferdi@maesdental.ph",     role: "member", status: "online",   callRole: "caller",   device: "Front Desk Phone #2", lastSeen: "now" },
  { name: "Lourdes Bautista",    email: "lulu@maesdental.ph",      role: "member", status: "offline",  callRole: "receiver", device: "Lab Mac",             lastSeen: "3d" },
  { name: "Rico Cruz",           email: "rico@maesdental.ph",      role: "member", status: "offline",  callRole: "receiver", device: "Stockroom Tablet",    lastSeen: "5d" },
  { name: "Anna Mendoza",        email: "anna@maesdental.ph",      role: "member", status: "online",   callRole: "caller",   device: "Reception Tablet",    lastSeen: "now" },
  { name: "Dr. Mike Bautista",   email: "mike@maesdental.ph",      role: "member", status: "suspended",callRole: "receiver", device: "—",                   lastSeen: "—" },
  { name: "Joseph Salazar",      email: "joseph@maesdental.ph",    role: "member", status: "idle",     callRole: "both",     device: "Manager Laptop",      lastSeen: "44m" },
  { name: "Cynthia Salazar",     email: "cynthia@maesdental.ph",   role: "member", status: "online",   callRole: "receiver", device: "Operatory 4 iPad",    lastSeen: "now" },
  { name: "Eduardo Cruz",        email: "eddie@maesdental.ph",     role: "member", status: "archived", callRole: "receiver", device: "Janitor Phone",       lastSeen: "95d" },
];

// PRODUCT.md Step 7 locks exactly 18 reserved subdomains
const RESERVED_SLUGS = [
  "www","api","app","admin","staging","dev","_pwbt","pwbt","status",
  "blog","docs","mail","smtp","mx","support","help","auth","cdn",
];

/* ------------------------------------------------------------------ */
/* PRIMITIVES                                                          */
/* ------------------------------------------------------------------ */

function MockupBanner() {
  return (
    <div className="sticky top-0 z-50 w-full bg-[#f59e0b] text-[#0a0a0a] text-[13px] font-semibold tracking-wide flex items-center justify-center gap-3 py-2 px-4 border-b border-[#0a0a0a]/15">
      <span className="text-[16px]">📐</span>
      <span>PHASE 2.8 MOCKUP — Yelli — Visual check of PRODUCT.md interpretation. Not live. No data persists.</span>
    </div>
  );
}

function ButtonPrimary({ children, onClick, className = "", type = "button", disabled = false }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center h-11 px-5 rounded-[12px] bg-[#0a0a0a] text-white text-[14px] font-semibold hover:bg-[#1f1f1f] transition disabled:bg-[#e5e5e5] disabled:text-[#9a9a9a] disabled:cursor-not-allowed ${className}`}
    >{children}</button>
  );
}

function ButtonSecondary({ children, onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center h-11 px-5 rounded-[12px] bg-[#fffaf0] text-[#0a0a0a] text-[14px] font-semibold border border-[#e5e5e5] hover:border-[#0a0a0a] transition ${className}`}
    >{children}</button>
  );
}

function ButtonDanger({ children, onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center h-11 px-5 rounded-[12px] bg-[#ef4444] text-white text-[14px] font-semibold hover:bg-[#b91c1c] transition ${className}`}
    >{children}</button>
  );
}

function Pill({ tone = "neutral", children }) {
  const map = {
    neutral:   "bg-[#f5f0e0] text-[#3a3a3a]",
    online:    "bg-[#22c55e]/10 text-[#15803d] border border-[#22c55e]/30",
    idle:      "bg-[#f59e0b]/10 text-[#b45309] border border-[#f59e0b]/30",
    offline:   "bg-[#e5e5e5] text-[#6a6a6a]",
    archived:  "bg-[#f0f0f0] text-[#6a6a6a] border border-[#e5e5e5]",
    suspended: "bg-[#ef4444]/10 text-[#b91c1c] border border-[#ef4444]/30",
    admin:     "bg-[#0a0a0a] text-white",
    member:    "bg-[#fffaf0] text-[#0a0a0a] border border-[#e5e5e5]",
    caller:    "bg-[#b8a4ed]/25 text-[#0a0a0a] border border-[#b8a4ed]/60",
    receiver:  "bg-[#a4d4c5]/30 text-[#0a0a0a] border border-[#a4d4c5]/70",
    both:      "bg-[#0a0a0a] text-white",
    warning:   "bg-[#f59e0b]/15 text-[#b45309] border border-[#f59e0b]/40",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold tracking-[0.02em] ${map[tone] || map.neutral}`}>
      {children}
    </span>
  );
}

function CallRoleLabel({ role }) {
  if (role === "both") return <Pill tone="both">Caller + Receiver</Pill>;
  if (role === "caller") return <Pill tone="caller">Caller</Pill>;
  return <Pill tone="receiver">Receiver only</Pill>;
}

function AppFooter() {
  return (
    <footer className="w-full py-6 text-center text-[12px] text-[#6a6a6a]">
      Developed by{" "}
      <a href="https://www.powerbyteitsolutions.com" target="_blank" rel="noopener noreferrer" className="text-[#0a0a0a] underline underline-offset-2 hover:text-[#1f1f1f]">
        Powerbyte IT Solutions
      </a>{" "}· © {new Date().getFullYear()}
    </footer>
  );
}

function MarketingNav({ go }) {
  return (
    <nav className="w-full h-16 px-6 lg:px-12 flex items-center justify-between bg-[#fffaf0]">
      <button onClick={() => go("landing")} className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-[8px] bg-[#0a0a0a] text-white grid place-items-center font-semibold text-[14px]">Y</div>
        <span className="text-[18px] font-semibold tracking-[-0.02em] text-[#0a0a0a]">Yelli</span>
      </button>
      <div className="hidden md:flex items-center gap-8 text-[14px] font-medium text-[#3a3a3a]">
        <a className="hover:text-[#0a0a0a] cursor-pointer" onClick={() => go("pricing")}>Pricing</a>
        <a className="hover:text-[#0a0a0a] cursor-pointer" onClick={() => go("legalPrivacy")}>Docs</a>
        <a className="hover:text-[#0a0a0a] cursor-pointer">Customers</a>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => go("login")} className="text-[14px] font-medium text-[#0a0a0a] hover:underline">Sign in</button>
        <ButtonPrimary onClick={() => go("signup")}>Start free</ButtonPrimary>
      </div>
    </nav>
  );
}

function TenantTopBar({ go, currentScreen }) {
  const linkBase = "text-[14px] font-medium px-3 py-1.5 rounded-[8px]";
  const linkActive = "bg-[#f5f0e0] text-[#0a0a0a]";
  const linkIdle = "text-[#3a3a3a] hover:text-[#0a0a0a]";
  return (
    <header className="w-full h-16 px-6 flex items-center justify-between bg-[#fffaf0] border-b border-[#e5e5e5]">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-[8px] bg-[#1a3a3a] text-white grid place-items-center font-semibold">{TENANT.logoLetter}</div>
        <div className="flex flex-col leading-tight">
          <span className="text-[14px] font-semibold text-[#0a0a0a]">{TENANT.brandedName}</span>
          <span className="text-[12px] text-[#6a6a6a]">{TENANT.slug}.yelli.app</span>
        </div>
      </div>
      <nav className="hidden md:flex items-center gap-1">
        <a onClick={() => go("app")} className={`${linkBase} ${currentScreen === "app" ? linkActive : linkIdle} cursor-pointer`}>Directory</a>
        <a onClick={() => go("members")} className={`${linkBase} ${currentScreen === "members" ? linkActive : linkIdle} cursor-pointer`}>Members</a>
        <a onClick={() => go("branding")} className={`${linkBase} ${currentScreen === "branding" ? linkActive : linkIdle} cursor-pointer`}>Branding</a>
        <a onClick={() => go("orgSettings")} className={`${linkBase} ${currentScreen === "orgSettings" ? linkActive : linkIdle} cursor-pointer`}>Org Settings</a>
      </nav>
      <div className="flex items-center gap-3">
        <button onClick={() => go("settings")} className="flex items-center gap-2 px-2 py-1 rounded-[8px] hover:bg-[#f5f0e0]">
          <div className="w-8 h-8 rounded-full bg-[#b8a4ed] grid place-items-center text-[12px] font-semibold text-[#0a0a0a]">MM</div>
          <span className="hidden sm:inline text-[14px] font-medium text-[#0a0a0a]">{ME.name.split(" ")[0]}</span>
        </button>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* SCREEN 1 — LANDING                                                   */
/* ------------------------------------------------------------------ */

function ScreenLanding({ go }) {
  return (
    <div className="min-h-screen bg-[#fffaf0]">
      <MarketingNav go={go} />

      <section className="px-6 lg:px-12 py-24">
        <div className="max-w-[1280px] mx-auto grid md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-7">
            <h1 className="text-[56px] md:text-[72px] leading-[1.0] tracking-[-0.025em] font-medium text-[#0a0a0a]">
              Video calls for the people across the room.
            </h1>
            <p className="mt-6 text-[16px] leading-[1.55] text-[#3a3a3a] max-w-[560px]">
              Yelli is 1-on-1 intercom for clinics, shops, and offices —
              over your LAN or our cloud, both keep video peer-to-peer.
              White-label your name and logo in 30 seconds.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonPrimary onClick={() => go("signup")}>Start free — no card</ButtonPrimary>
              <ButtonSecondary onClick={() => go("pricing")}>See pricing</ButtonSecondary>
            </div>
            <p className="mt-6 text-[13px] text-[#6a6a6a]">
              Self-host on your network with Yelli LAN · zero per-seat fees · open-source core
            </p>
          </div>
          <div className="md:col-span-5">
            <div className="aspect-square rounded-[24px] bg-[#faf5e8] grid place-items-center p-12 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#b8a4ed]/30 via-[#ffb084]/20 to-[#a4d4c5]/30" />
              <div className="relative z-10 grid grid-cols-2 gap-4 w-full">
                <div className="aspect-square rounded-[24px] bg-[#0a0a0a] grid place-items-center text-white text-[40px]">📞</div>
                <div className="aspect-square rounded-[24px] bg-[#ff4d8b] grid place-items-center text-white text-[40px]">📹</div>
                <div className="aspect-square rounded-[24px] bg-[#e8b94a] grid place-items-center text-[#0a0a0a] text-[40px]">👥</div>
                <div className="aspect-square rounded-[24px] bg-[#1a3a3a] grid place-items-center text-white text-[40px]">🔒</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 lg:px-12 pb-24">
        <div className="max-w-[1280px] mx-auto grid md:grid-cols-3 gap-6">
          <article className="rounded-[24px] bg-[#ff4d8b] text-white p-8">
            <h3 className="text-[18px] font-semibold mb-3">LAN edition</h3>
            <p className="text-[14px] leading-[1.55] opacity-95">
              Drop one container on the office PC. No internet hop, no monthly bill.
              Calls stay on your network — IT keeps the keys.
            </p>
            <div className="mt-6 rounded-[16px] bg-white text-[#0a0a0a] p-4 text-[12px] font-mono">
              <div className="text-[#6a6a6a]">$ ./Install-Yelli.cmd</div>
              <div className="text-[#15803d] mt-1">✓ Yelli LAN running at https://192.168.1.10:3000</div>
            </div>
          </article>

          <article className="rounded-[24px] bg-[#1a3a3a] text-white p-8">
            <h3 className="text-[18px] font-semibold mb-3">Cloud edition</h3>
            <p className="text-[14px] leading-[1.55] opacity-95">
              Multi-tenant SaaS hosted by Powerbyte. Cross-network calls,
              email invites, daily backups. Your own subdomain.
            </p>
            <div className="mt-6 rounded-[16px] bg-white text-[#0a0a0a] p-4 text-[12px] font-mono">
              <span className="text-[#6a6a6a]">https://</span>
              <span className="font-semibold">your-org</span>
              <span className="text-[#6a6a6a]">.yelli.app</span>
            </div>
          </article>

          <article className="rounded-[24px] bg-[#b8a4ed] text-[#0a0a0a] p-8">
            <h3 className="text-[18px] font-semibold mb-3">Feature parity</h3>
            <p className="text-[14px] leading-[1.55]">
              One codebase. Every feature works in both editions — calling,
              roles, branding, audit log, PWA install. Move from LAN to Cloud
              with one export script.
            </p>
            <div className="mt-6 flex items-center gap-2">
              <Pill tone="member">LAN</Pill>
              <span className="text-[18px]">↔</span>
              <Pill tone="admin">Cloud</Pill>
            </div>
          </article>
        </div>
      </section>

      <section className="px-6 lg:px-12 pb-16">
        <div className="max-w-[1280px] mx-auto rounded-[24px] bg-[#faf5e8] p-12 md:p-24 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-[40px] leading-[1.1] tracking-[-0.01em] font-medium text-[#0a0a0a]">
              Set up your org in under a minute.
            </h2>
            <p className="mt-4 text-[16px] text-[#3a3a3a]">No credit card. 14-day trial. Cancel anytime.</p>
            <div className="mt-6">
              <ButtonPrimary onClick={() => go("signup")}>Create your org</ButtonPrimary>
            </div>
          </div>
          <div className="aspect-[4/3] rounded-[24px] bg-[#ffb084] grid place-items-center text-[#0a0a0a]" style={{ fontSize: 80 }}>🏔️</div>
        </div>
      </section>

      <AppFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SCREEN 2 — SIGNUP                                                    */
/* ------------------------------------------------------------------ */

function ScreenSignup({ go }) {
  const [slug, setSlug] = useState("");
  const isReserved = RESERVED_SLUGS.includes(slug.toLowerCase());
  const isValid = /^[a-z][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length >= 3 && slug.length <= 30 && !isReserved;

  return (
    <div className="min-h-screen bg-[#fffaf0]">
      <MarketingNav go={go} />
      <section className="px-6 lg:px-12 py-16">
        <div className="max-w-[480px] mx-auto">
          <h1 className="text-[40px] leading-[1.1] tracking-[-0.015em] font-medium text-[#0a0a0a]">Create your org</h1>
          <p className="mt-3 text-[16px] text-[#3a3a3a]">14-day trial · no card · own your subdomain</p>

          <form className="mt-12 space-y-5" onSubmit={(e) => { e.preventDefault(); }}>
            <div>
              <label className="block text-[13px] font-semibold text-[#0a0a0a] mb-2">Organization name</label>
              <input
                type="text"
                placeholder="e.g. Maes Dental Clinic"
                defaultValue="Maes Dental Clinic"
                className="w-full h-11 px-4 rounded-[12px] bg-[#fffaf0] border border-[#e5e5e5] focus:border-[#0a0a0a] focus:outline-none text-[16px] text-[#0a0a0a]"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#0a0a0a] mb-2">Subdomain</label>
              <div className="flex items-stretch">
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="maes"
                  maxLength={30}
                  className="flex-1 h-11 px-4 rounded-l-[12px] bg-[#fffaf0] border border-[#e5e5e5] focus:border-[#0a0a0a] focus:outline-none text-[16px] text-[#0a0a0a] font-mono"
                />
                <span className="h-11 px-4 inline-flex items-center rounded-r-[12px] bg-[#f5f0e0] border border-l-0 border-[#e5e5e5] text-[14px] text-[#3a3a3a] font-mono">.yelli.app</span>
              </div>
              <div className="mt-2 text-[12px] text-[#6a6a6a] leading-[1.5]">
                3–30 chars · lowercase letters, digits, hyphens · must start with a letter ·{" "}
                <span className="font-semibold text-[#b45309]">cannot be changed after signup</span>
              </div>
              {slug.length > 0 && isReserved && (
                <div className="mt-2 text-[12px] text-[#b91c1c] font-medium">That subdomain is unavailable. Try another.</div>
              )}
              {slug.length > 0 && !isReserved && !isValid && (
                <div className="mt-2 text-[12px] text-[#b91c1c] font-medium">Doesn't match the format — letters/digits/hyphens only.</div>
              )}
              {isValid && (
                <div className="mt-2 text-[12px] text-[#15803d] font-medium">✓ {slug}.yelli.app is available</div>
              )}
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#0a0a0a] mb-2">Your work email</label>
              <input type="email" placeholder="you@yourorg.com" defaultValue="maria@maesdental.ph" className="w-full h-11 px-4 rounded-[12px] bg-[#fffaf0] border border-[#e5e5e5] focus:border-[#0a0a0a] focus:outline-none text-[16px] text-[#0a0a0a]" />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#0a0a0a] mb-2">Password</label>
              <input type="password" placeholder="At least 12 characters" className="w-full h-11 px-4 rounded-[12px] bg-[#fffaf0] border border-[#e5e5e5] focus:border-[#0a0a0a] focus:outline-none text-[16px] text-[#0a0a0a]" />
            </div>

            <label className="flex items-start gap-3 text-[13px] text-[#3a3a3a]">
              <input type="checkbox" className="mt-0.5" />
              <span>I agree to the <a onClick={() => go("legalTerms")} className="underline cursor-pointer">Terms</a> and <a onClick={() => go("legalPrivacy")} className="underline cursor-pointer">Privacy Policy</a>.</span>
            </label>

            {/* Cloudflare Turnstile (PRODUCT.md:378 — Turnstile on signup, login, password-reset) */}
            <div className="rounded-[12px] border border-[#e5e5e5] bg-[#faf5e8] px-4 py-3 flex items-center gap-3">
              <div className="w-5 h-5 rounded-[6px] border border-[#0a0a0a]" />
              <span className="text-[13px] text-[#3a3a3a]">I'm not a robot</span>
              <span className="ml-auto text-[12px] text-[#9a9a9a]">Cloudflare</span>
            </div>

            <div className="pt-2">
              <ButtonPrimary onClick={() => go("verify")} className="w-full">Create org</ButtonPrimary>
            </div>

            <p className="text-center text-[13px] text-[#6a6a6a]">
              Already have an account? <a onClick={() => go("login")} className="text-[#0a0a0a] font-semibold underline cursor-pointer">Sign in</a>
            </p>
          </form>
        </div>
      </section>
      <AppFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SCREEN 3 — LOGIN                                                     */
/* ------------------------------------------------------------------ */

function ScreenLogin({ go }) {
  return (
    <div className="min-h-screen bg-[#fffaf0]">
      <MarketingNav go={go} />
      <section className="px-6 lg:px-12 py-16">
        <div className="max-w-[420px] mx-auto">
          <h1 className="text-[40px] leading-[1.1] tracking-[-0.015em] font-medium text-[#0a0a0a]">Sign in</h1>
          <p className="mt-3 text-[16px] text-[#3a3a3a]">Welcome back. Enter your org credentials.</p>

          <form className="mt-12 space-y-5" onSubmit={(e) => { e.preventDefault(); go("app"); }}>
            <div>
              <label className="block text-[13px] font-semibold text-[#0a0a0a] mb-2">Work email</label>
              <input type="email" defaultValue="maria@maesdental.ph" className="w-full h-11 px-4 rounded-[12px] bg-[#fffaf0] border border-[#e5e5e5] focus:border-[#0a0a0a] focus:outline-none text-[16px] text-[#0a0a0a]" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[13px] font-semibold text-[#0a0a0a]">Password</label>
                <a onClick={() => go("forgot")} className="text-[12px] text-[#0a0a0a] underline cursor-pointer">Forgot?</a>
              </div>
              <input type="password" className="w-full h-11 px-4 rounded-[12px] bg-[#fffaf0] border border-[#e5e5e5] focus:border-[#0a0a0a] focus:outline-none text-[16px] text-[#0a0a0a]" />
            </div>

            <div className="rounded-[12px] border border-[#e5e5e5] bg-[#faf5e8] px-4 py-3 flex items-center gap-3">
              <div className="w-5 h-5 rounded-[6px] border border-[#0a0a0a]" />
              <span className="text-[13px] text-[#3a3a3a]">I'm not a robot</span>
              <span className="ml-auto text-[12px] text-[#9a9a9a]">Cloudflare</span>
            </div>

            <ButtonPrimary type="submit" className="w-full">Sign in</ButtonPrimary>

            <p className="text-center text-[13px] text-[#6a6a6a]">
              New here? <a onClick={() => go("signup")} className="text-[#0a0a0a] font-semibold underline cursor-pointer">Create an org</a>
            </p>
          </form>
        </div>
      </section>
      <AppFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SCREEN 4 — APP (Idle / Directory) — role-gated CALL                  */
/* ------------------------------------------------------------------ */

function ScreenApp({ go, overlay, setOverlay, myCallRole, setMyCallRole }) {
  const canInitiate = myCallRole === "caller" || myCallRole === "both";
  const visibleMembers = MEMBERS.filter((m) => m.status !== "archived");
  const onlineMembers = visibleMembers.filter((m) => m.status === "online" || m.status === "idle");

  return (
    <div className="min-h-screen bg-[#fffaf0] flex flex-col">
      <TenantTopBar go={go} currentScreen="app" />

      <div className="text-[12px] text-[#6a6a6a] text-center py-1.5 bg-[#faf5e8] border-b border-[#e5e5e5]">
        Same screen serves both Yelli LAN (anonymous mode) and Yelli Cloud (authenticated). LAN-account-mode is also supported.
      </div>

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 lg:px-12 py-12 grid md:grid-cols-12 gap-8">
        <aside className="md:col-span-4 space-y-4">
          <div className="rounded-[16px] border border-[#e5e5e5] bg-[#fffaf0] p-6">
            <div className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">Connection</div>
            <div className="mt-3 flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
              <span className="text-[14px] font-medium text-[#0a0a0a]">WebSocket connected</span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
              <span className="text-[14px] font-medium text-[#0a0a0a]">Idle · ready</span>
            </div>
          </div>

          <div className="rounded-[16px] border border-[#e5e5e5] bg-[#fffaf0] p-6">
            <div className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">You</div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[18px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">{ME.name}</span>
              <button onClick={() => setOverlay("namePicker")} className="text-[12px] text-[#6a6a6a] hover:text-[#0a0a0a] underline">Edit</button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Pill tone="admin">Admin</Pill>
              <Pill tone="online">Online</Pill>
              <CallRoleLabel role={myCallRole} />
            </div>
            <div className="mt-3 text-[12px] text-[#6a6a6a]">Device: Reception PC</div>

            {/* Demo toggle for the audit-pass: flip callRole to see hide-CALL enforcement */}
            <div className="mt-4 pt-4 border-t border-[#e5e5e5]">
              <div className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a] mb-2">Demo: view as</div>
              <div className="flex flex-wrap gap-2">
                {["both", "caller", "receiver"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setMyCallRole(r)}
                    className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border ${myCallRole === r ? "bg-[#0a0a0a] text-white border-[#0a0a0a]" : "bg-[#fffaf0] text-[#0a0a0a] border-[#e5e5e5] hover:border-[#0a0a0a]"}`}
                  >{r === "both" ? "Caller + Receiver" : r === "caller" ? "Caller" : "Receiver only"}</button>
                ))}
              </div>
            </div>
          </div>

          <button onClick={() => setOverlay("pwa")} className="w-full text-left rounded-[16px] border border-dashed border-[#0a0a0a]/30 bg-[#faf5e8] p-6 hover:bg-[#f5f0e0]">
            <div className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">Demo</div>
            <div className="mt-1 text-[13px] text-[#3a3a3a]">Show PWA install banner →</div>
          </button>

          <button onClick={() => setOverlay("offline")} className="w-full text-left rounded-[16px] border border-dashed border-[#0a0a0a]/30 bg-[#faf5e8] p-6 hover:bg-[#f5f0e0]">
            <div className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">Demo</div>
            <div className="mt-1 text-[13px] text-[#3a3a3a]">Show offline reconnecting banner →</div>
          </button>

          <button onClick={() => setOverlay("incomingCall")} className="w-full text-left rounded-[16px] border border-dashed border-[#0a0a0a]/30 bg-[#faf5e8] p-6 hover:bg-[#f5f0e0]">
            <div className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">Demo</div>
            <div className="mt-1 text-[13px] text-[#3a3a3a]">Show incoming call modal →</div>
          </button>
        </aside>

        <section className="md:col-span-8 space-y-6">
          {/* CALL hero gated by ME.callRole per Step 3 (hide-CALL enforcement) */}
          {canInitiate ? (
            <div className="rounded-[24px] bg-[#1a3a3a] text-white p-12 grid place-items-center min-h-[280px] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#1a3a3a] via-[#1a3a3a] to-[#0a1a1a]" />
              <div className="relative z-10 text-center">
                <div className="text-[12px] font-semibold tracking-[0.16em] uppercase opacity-70">Ready to call</div>
                <button
                  onClick={() => go("call")}
                  className="mt-6 w-44 h-44 rounded-full bg-white text-[#0a0a0a] grid place-items-center hover:scale-[1.02] transition"
                >
                  <div className="text-[56px]">📞</div>
                  <div className="text-[14px] font-semibold tracking-[0.08em] mt-1">CALL</div>
                </button>
                <div className="mt-6 text-[13px] opacity-80">Tap a person on the right, then CALL</div>
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] bg-[#f5f0e0] border border-[#e5e5e5] p-12 grid place-items-center min-h-[280px]">
              <div className="text-center max-w-md">
                <div className="text-[12px] font-semibold tracking-[0.16em] uppercase text-[#6a6a6a]">Receiver-only device</div>
                <div className="mt-3 text-[18px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">CALL is hidden for this device</div>
                <div className="mt-2 text-[13px] text-[#6a6a6a] leading-[1.55]">An admin assigned you the <span className="font-semibold">receiver-only</span> call role. You'll see incoming calls; the CALL button + per-row Call buttons are hidden per Step 3 enforcement. Ask an admin to change your role in Members.</div>
              </div>
            </div>
          )}

          <div className="rounded-[16px] border border-[#e5e5e5] bg-[#fffaf0]">
            <div className="px-6 py-4 border-b border-[#e5e5e5] flex items-center justify-between">
              <div>
                <div className="text-[14px] font-semibold text-[#0a0a0a]">Directory</div>
                <div className="text-[12px] text-[#6a6a6a]">{onlineMembers.length} online · archived devices hidden</div>
              </div>
              <input type="search" placeholder="Search…" className="h-9 px-3 rounded-[8px] border border-[#e5e5e5] bg-[#fffaf0] text-[13px] focus:outline-none focus:border-[#0a0a0a]" />
            </div>
            <ul className="divide-y divide-[#e5e5e5]">
              {visibleMembers.slice(0, 10).map((m) => {
                const disabled = m.status === "offline" || m.status === "suspended";
                return (
                  <li key={m.email} className={`flex items-center gap-4 px-6 py-3 ${disabled ? "opacity-50" : ""}`}>
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${m.status === "online" ? "bg-[#22c55e]" : m.status === "idle" ? "bg-[#f59e0b]" : "bg-[#9a9a9a]"}`} />
                    <div className="w-9 h-9 rounded-full bg-[#b8a4ed] grid place-items-center text-[12px] font-semibold text-[#0a0a0a]">
                      {m.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-[#0a0a0a] truncate">{m.name}</div>
                      <div className="text-[12px] text-[#6a6a6a] truncate">{m.device} · {m.lastSeen}</div>
                    </div>
                    {m.callRole === "receiver" && <Pill tone="receiver">Receiver only</Pill>}
                    {m.role === "admin" && <Pill tone="admin">Admin</Pill>}
                    {canInitiate && (
                      <button
                        disabled={disabled}
                        onClick={() => go("call")}
                        className="ml-3 h-9 px-4 rounded-[8px] bg-[#0a0a0a] text-white text-[12px] font-semibold disabled:bg-[#e5e5e5] disabled:text-[#9a9a9a] hover:bg-[#1f1f1f]"
                      >Call</button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </main>

      <AppFooter />

      {overlay === "incomingCall" && <OverlayIncomingCall onClose={() => setOverlay(null)} onAccept={() => { setOverlay(null); go("call"); }} />}
      {overlay === "namePicker" && <OverlayNamePicker onClose={() => setOverlay(null)} />}
      {overlay === "pwa" && <OverlayPwaBanner onClose={() => setOverlay(null)} />}
      {overlay === "offline" && <OverlayOfflineBanner onClose={() => setOverlay(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SCREEN 5 — ACTIVE CALL                                               */
/* ------------------------------------------------------------------ */

function ScreenActiveCall({ go }) {
  return (
    <div className="min-h-screen bg-[#0a1a1a] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a3a3a] via-[#0a1a1a] to-[#0a0a0a]" />
      <div className="absolute inset-0 grid place-items-center">
        <div className="w-40 h-40 rounded-full bg-[#ffb084] grid place-items-center text-[#0a0a0a]" style={{ fontSize: 64 }}>
          {MEMBERS[1].name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
        </div>
      </div>

      <div className="absolute top-0 left-0 right-0 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => go("app")} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-[18px]">←</button>
          <div className="flex flex-col">
            <span className="text-[16px] font-semibold">{MEMBERS[1].name}</span>
            <span className="text-[12px] text-white/70">{MEMBERS[1].device}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur">
          <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="text-[13px] font-mono">02:14</span>
        </div>
      </div>

      <div className="absolute bottom-32 right-6 w-32 h-44 md:w-40 md:h-56 rounded-[16px] overflow-hidden border-2 border-white/30 bg-gradient-to-br from-[#b8a4ed] to-[#ff4d8b] grid place-items-center text-[40px] z-10">
        🙂
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6 grid place-items-center z-10">
        <div className="flex items-center gap-3 px-4 py-3 rounded-full bg-black/40 backdrop-blur-lg border border-white/10">
          <button className="w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 grid place-items-center text-[18px]" title="Mute">🎤</button>
          <button className="w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 grid place-items-center text-[18px]" title="Camera">📷</button>
          <button onClick={() => go("app")} className="w-16 h-12 rounded-full bg-[#ef4444] hover:bg-[#b91c1c] grid place-items-center text-[18px]" title="End call">📞</button>
          <button className="w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 grid place-items-center text-[18px]" title="Speaker">🔊</button>
          <button className="w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 grid place-items-center text-[18px]" title="Swap PiP">🔄</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SCREEN 6 — ADMIN MEMBERS                                             */
/* ------------------------------------------------------------------ */

function ScreenAdminMembers({ go, overlay, setOverlay }) {
  const [filter, setFilter] = useState("all");
  const adminCount = MEMBERS.filter((m) => m.role === "admin" && m.status !== "suspended" && m.status !== "archived").length;

  const filtered = MEMBERS.filter((m) => {
    if (filter === "all") return m.status !== "archived";
    if (filter === "admins") return m.role === "admin";
    if (filter === "online") return m.status === "online";
    if (filter === "suspended") return m.status === "suspended";
    if (filter === "archived") return m.status === "archived";
    return true;
  });

  return (
    <div className="min-h-screen bg-[#fffaf0] flex flex-col">
      <TenantTopBar go={go} currentScreen="members" />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 lg:px-12 py-12">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-[40px] leading-[1.1] tracking-[-0.015em] font-medium text-[#0a0a0a]">Members</h1>
            <p className="mt-1 text-[14px] text-[#6a6a6a]">{MEMBERS.length} members · {adminCount} admins · Last-admin guard active</p>
          </div>
          <div className="flex gap-2">
            <ButtonSecondary>Export CSV</ButtonSecondary>
            <ButtonPrimary>Invite member</ButtonPrimary>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2 flex-wrap">
          {[
            ["all",       `All (${MEMBERS.filter((m) => m.status !== "archived").length})`],
            ["admins",    `Admins (${MEMBERS.filter((m) => m.role === "admin").length})`],
            ["online",    `Online (${MEMBERS.filter((m) => m.status === "online").length})`],
            ["suspended", `Suspended (${MEMBERS.filter((m) => m.status === "suspended").length})`],
            ["archived",  `Archived (${MEMBERS.filter((m) => m.status === "archived").length})`],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-full text-[13px] font-semibold cursor-pointer ${filter === k ? "bg-[#f5f0e0] text-[#0a0a0a]" : "text-[#3a3a3a] hover:bg-[#f5f0e0]"}`}
            >{label}</button>
          ))}
          <div className="ml-auto">
            <input type="search" placeholder="Search members…" className="h-9 px-3 rounded-[8px] border border-[#e5e5e5] bg-[#fffaf0] text-[13px] focus:outline-none focus:border-[#0a0a0a]" />
          </div>
        </div>

        <div className="rounded-[16px] border border-[#e5e5e5] bg-[#fffaf0] overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#f5f0e0]">
              <tr className="text-left text-[12px] font-semibold uppercase tracking-[0.06em] text-[#6a6a6a]">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3 hidden md:table-cell">Email</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Call role</th>
                <th className="px-6 py-3 hidden lg:table-cell">Device</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e5e5]">
              {filtered.map((m) => {
                const isLastAdmin = m.role === "admin" && adminCount === 1;
                return (
                  <tr key={m.email} className={m.status === "suspended" || m.status === "archived" ? "opacity-60" : ""}>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#b8a4ed] grid place-items-center text-[12px] font-semibold text-[#0a0a0a]">
                          {m.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </div>
                        <div className="text-[14px] font-semibold text-[#0a0a0a]">{m.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-3 hidden md:table-cell text-[13px] text-[#6a6a6a] font-mono">{m.email}</td>
                    <td className="px-6 py-3">
                      <Pill tone={m.role}>{m.role === "admin" ? "Admin" : "Member"}</Pill>
                    </td>
                    <td className="px-6 py-3">
                      <CallRoleLabel role={m.callRole} />
                    </td>
                    <td className="px-6 py-3 hidden lg:table-cell text-[13px] text-[#3a3a3a]">{m.device}</td>
                    <td className="px-6 py-3">
                      <Pill tone={m.status}>
                        {m.status === "online" ? "Online" :
                         m.status === "idle" ? "Idle" :
                         m.status === "offline" ? "Offline · " + m.lastSeen :
                         m.status === "archived" ? "Archived · " + m.lastSeen :
                         "Suspended"}
                      </Pill>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => setOverlay({ kind: "roleAssign", member: m })}
                        disabled={isLastAdmin}
                        title={isLastAdmin ? "Last admin can't be demoted — transfer first" : ""}
                        className="text-[12px] font-semibold text-[#0a0a0a] hover:underline px-2 disabled:text-[#9a9a9a] disabled:no-underline disabled:cursor-not-allowed"
                      >
                        {m.role === "admin" ? "Demote" : "Promote"}
                      </button>
                      <button
                        onClick={() => setOverlay({ kind: "callRoleAssign", member: m })}
                        className="text-[12px] font-semibold text-[#0a0a0a] hover:underline px-2"
                      >Set call role</button>
                      <button className="text-[12px] font-semibold text-[#0a0a0a] hover:underline px-2">Suspend</button>
                      <button
                        disabled={isLastAdmin}
                        title={isLastAdmin ? "Last admin can't be removed — transfer first" : "Remove"}
                        className="text-[12px] font-semibold text-[#b91c1c] hover:underline px-2 disabled:text-[#9a9a9a] disabled:no-underline disabled:cursor-not-allowed"
                      >Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-[12px] text-[#6a6a6a] flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
          Every promote / demote / call-role assign / suspend / remove writes an AuditLog entry. Devices auto-archive after 90 days offline.
        </div>
      </main>

      <AppFooter />

      {overlay?.kind === "roleAssign" && (
        <OverlayRoleAssign member={overlay.member} onClose={() => setOverlay(null)} />
      )}
      {overlay?.kind === "callRoleAssign" && (
        <OverlayCallRoleAssign member={overlay.member} onClose={() => setOverlay(null)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SCREEN 7 — ADMIN BRANDING                                            */
/* ------------------------------------------------------------------ */

function ScreenAdminBranding({ go }) {
  return (
    <div className="min-h-screen bg-[#fffaf0] flex flex-col">
      <TenantTopBar go={go} currentScreen="branding" />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 lg:px-12 py-12 grid lg:grid-cols-12 gap-12">
        <div className="lg:col-span-7 space-y-8">
          <div>
            <h1 className="text-[40px] leading-[1.1] tracking-[-0.015em] font-medium text-[#0a0a0a]">Branding</h1>
            <p className="mt-1 text-[14px] text-[#6a6a6a]">White-label header text and logo. Footer is not editable.</p>
          </div>

          <section className="space-y-6">
            <div>
              <label className="block text-[13px] font-semibold text-[#0a0a0a] mb-2">App display name</label>
              <input
                type="text"
                defaultValue={TENANT.brandedName}
                className="w-full h-11 px-4 rounded-[12px] bg-[#fffaf0] border border-[#e5e5e5] focus:border-[#0a0a0a] focus:outline-none text-[16px] text-[#0a0a0a]"
              />
              <div className="mt-2 text-[12px] text-[#6a6a6a]">Shown in the top bar, on incoming-call notifications, and on the PWA install banner.</div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#0a0a0a] mb-2">Logo</label>
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-[16px] bg-[#1a3a3a] text-white grid place-items-center text-[32px] font-semibold">{TENANT.logoLetter}</div>
                <div>
                  <ButtonSecondary>Upload PNG / SVG</ButtonSecondary>
                  <div className="mt-2 text-[12px] text-[#6a6a6a]">Max 512KB · square · transparent background recommended</div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#0a0a0a] mb-2">Primary accent</label>
              <div className="flex items-center gap-3">
                {[T.brandTeal, T.brandPink, T.brandLavender, T.brandPeach, T.brandOchre, T.ink].map((c) => (
                  <button key={c} className="w-12 h-12 rounded-[12px] border-2 border-transparent hover:border-[#0a0a0a]" style={{ background: c }} />
                ))}
              </div>
              <div className="mt-2 text-[12px] text-[#6a6a6a]">Shown on CALL button, status pills, and brand chrome.</div>
            </div>

            <div className="pt-2 flex gap-3">
              <ButtonPrimary>Save changes</ButtonPrimary>
              <ButtonSecondary>Discard</ButtonSecondary>
            </div>
          </section>

          <section className="mt-12 rounded-[16px] border border-[#e5e5e5] bg-[#faf5e8] p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-[12px] bg-[#e8b94a] grid place-items-center text-[18px]">🔑</div>
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-[#0a0a0a]">LAN admin passphrase</div>
                <div className="mt-1 text-[13px] text-[#3a3a3a]">
                  On LAN deployments, this section shows a passphrase reset CTA. Argon2id hash on{" "}
                  <code className="bg-[#fffaf0] px-1.5 py-0.5 rounded-[6px] text-[12px]">Tenant.adminPassphraseHash</code>.{" "}
                  Resets are host-side via{" "}
                  <code className="bg-[#fffaf0] px-1.5 py-0.5 rounded-[6px] text-[12px]">./scripts/reset-admin-passphrase.sh</code>.
                </div>
              </div>
              <Pill tone="warning">LAN only</Pill>
            </div>
          </section>
        </div>

        <aside className="lg:col-span-5">
          <div className="sticky top-24 space-y-4">
            <div className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">Live preview</div>
            <div className="rounded-[16px] border border-[#e5e5e5] overflow-hidden bg-white">
              <div className="h-16 px-4 flex items-center gap-2 bg-[#fffaf0] border-b border-[#e5e5e5]">
                <div className="w-8 h-8 rounded-[8px] bg-[#1a3a3a] text-white grid place-items-center font-semibold text-[14px]">{TENANT.logoLetter}</div>
                <span className="text-[14px] font-semibold text-[#0a0a0a]">{TENANT.brandedName}</span>
              </div>
              <div className="h-56 grid place-items-center bg-[#1a3a3a]">
                <div className="w-32 h-32 rounded-full bg-white grid place-items-center text-[#0a0a0a]">
                  <div className="text-[32px]">📞</div>
                </div>
              </div>
              <div className="py-3 text-center text-[12px] text-[#6a6a6a] bg-[#faf5e8]">
                Developed by Powerbyte IT Solutions · © {new Date().getFullYear()}
              </div>
            </div>
            <div className="text-[12px] text-[#6a6a6a] leading-[1.5]">
              Footer is locked at the app-shell level and cannot be changed by Tenant Admins.
            </div>
          </div>
        </aside>
      </main>

      <AppFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SCREEN 8 — PERSONAL SETTINGS                                         */
/* ------------------------------------------------------------------ */

function ScreenSettings({ go }) {
  return (
    <div className="min-h-screen bg-[#fffaf0] flex flex-col">
      <TenantTopBar go={go} currentScreen="settings" />

      <main className="flex-1 max-w-[720px] w-full mx-auto px-6 lg:px-12 py-12 space-y-12">
        <div>
          <h1 className="text-[40px] leading-[1.1] tracking-[-0.015em] font-medium text-[#0a0a0a]">Your settings</h1>
          <p className="mt-1 text-[14px] text-[#6a6a6a]">Per-account preferences.</p>
        </div>

        <section className="rounded-[16px] border border-[#e5e5e5] bg-[#fffaf0] p-6 space-y-6">
          <div className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">Profile</div>
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-[#b8a4ed] grid place-items-center text-[18px] font-semibold text-[#0a0a0a]">MM</div>
            <div>
              <div className="text-[18px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">{ME.name}</div>
              <div className="text-[13px] text-[#6a6a6a] font-mono">{ME.email}</div>
              <div className="mt-1 flex gap-2 flex-wrap"><Pill tone="admin">Admin</Pill><Pill tone="both">Caller + Receiver</Pill></div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#0a0a0a] mb-2">Display name</label>
              <input defaultValue={ME.name} className="w-full h-11 px-4 rounded-[12px] bg-[#fffaf0] border border-[#e5e5e5] focus:border-[#0a0a0a] focus:outline-none text-[16px] text-[#0a0a0a]" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#0a0a0a] mb-2">Email</label>
              <input defaultValue={ME.email} disabled className="w-full h-11 px-4 rounded-[12px] bg-[#f5f0e0] border border-[#e5e5e5] text-[16px] text-[#6a6a6a] font-mono cursor-not-allowed" />
            </div>
          </div>
          <ButtonPrimary>Save profile</ButtonPrimary>
        </section>

        <section className="rounded-[16px] border border-[#e5e5e5] bg-[#fffaf0] p-6 space-y-4">
          <div className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">Notifications</div>
          <Toggle label="Incoming-call sound" defaultOn />
          <Toggle label="Browser notifications (Web Push)" defaultOn />
          <Toggle label="Email digest (weekly)" />
        </section>

        <section className="rounded-[16px] border border-[#e5e5e5] bg-[#fffaf0] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">Your devices</div>
            <span className="text-[12px] text-[#6a6a6a]">2 active</span>
          </div>
          <ul className="divide-y divide-[#e5e5e5]">
            <li className="py-3 flex items-center gap-4">
              <div className="text-[24px]">💻</div>
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-[#0a0a0a]">Reception PC</div>
                <div className="text-[12px] text-[#6a6a6a]">Chrome 131 · Windows · in use now</div>
              </div>
              <Pill tone="online">Active</Pill>
            </li>
            <li className="py-3 flex items-center gap-4">
              <div className="text-[24px]">📱</div>
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-[#0a0a0a]">iPhone</div>
                <div className="text-[12px] text-[#6a6a6a]">Safari · iOS 17 · last seen 2h ago</div>
              </div>
              <button className="text-[12px] font-semibold text-[#b91c1c] hover:underline">Sign out</button>
            </li>
          </ul>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}

function Toggle({ label, defaultOn = false }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-[14px] text-[#0a0a0a]">{label}</span>
      <button onClick={() => setOn((v) => !v)} type="button" className={`w-12 h-6 rounded-full relative transition ${on ? "bg-[#0a0a0a]" : "bg-[#e5e5e5]"}`}>
        <span className={`absolute top-0.5 ${on ? "left-6" : "left-0.5"} w-5 h-5 rounded-full bg-white transition-all`} />
      </button>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* OVERLAYS                                                             */
/* ------------------------------------------------------------------ */

function ModalShell({ children, onClose, maxWidth = "max-w-md" }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[#0a0a0a]/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`w-full ${maxWidth} rounded-[24px] bg-[#fffaf0] border border-[#e5e5e5] overflow-hidden`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function OverlayIncomingCall({ onClose, onAccept }) {
  return (
    <ModalShell onClose={onClose}>
      <div className="p-8 text-center">
        <div className="text-[12px] font-semibold tracking-[0.12em] uppercase text-[#6a6a6a]">Incoming call</div>
        <div className="mt-6 w-24 h-24 mx-auto rounded-full bg-[#ffb084] grid place-items-center text-[32px] font-semibold text-[#0a0a0a]">RS</div>
        <div className="mt-4 text-[24px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">{MEMBERS[1].name}</div>
        <div className="text-[13px] text-[#6a6a6a]">{MEMBERS[1].device}</div>
        <div className="mt-8 flex items-center justify-center gap-6">
          <button onClick={onClose} className="w-16 h-16 rounded-full bg-[#ef4444] hover:bg-[#b91c1c] text-white" style={{ fontSize: 24 }}>✕</button>
          <button onClick={onAccept} className="w-16 h-16 rounded-full bg-[#22c55e] hover:bg-[#15803d] text-white" style={{ fontSize: 24 }}>📞</button>
        </div>
        <div className="mt-6 text-[12px] text-[#6a6a6a] leading-[1.5]">
          This is the <span className="font-semibold">in-app</span> modal. The native Web Push notification has <span className="font-semibold">tap-to-open only</span> (no action buttons) for uniform cross-platform behaviour.
        </div>
      </div>
    </ModalShell>
  );
}

function OverlayNamePicker({ onClose }) {
  return (
    <ModalShell onClose={onClose}>
      <div className="p-8">
        <h3 className="text-[24px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">What should we call you?</h3>
        <p className="mt-2 text-[13px] text-[#6a6a6a]">This is the name your colleagues see when you appear in the directory.</p>
        <input maxLength={30} defaultValue={ME.name.split(" ")[0]} placeholder="e.g. Maria" className="mt-6 w-full h-11 px-4 rounded-[12px] bg-[#fffaf0] border border-[#e5e5e5] focus:border-[#0a0a0a] focus:outline-none text-[16px] text-[#0a0a0a]" />
        <div className="mt-6 flex items-center justify-end gap-3">
          <ButtonSecondary onClick={onClose}>Cancel</ButtonSecondary>
          <ButtonPrimary onClick={onClose}>Save</ButtonPrimary>
        </div>
      </div>
    </ModalShell>
  );
}

function OverlayRoleAssign({ member, onClose }) {
  const promoting = member.role === "member";
  return (
    <ModalShell onClose={onClose}>
      <div className="p-8">
        <h3 className="text-[24px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">
          {promoting ? "Promote to admin?" : "Demote to member?"}
        </h3>
        <p className="mt-2 text-[14px] text-[#3a3a3a]">
          <span className="font-semibold">{member.name}</span>{" "}
          will {promoting ? "gain" : "lose"} access to Members, Branding, and Org Settings.
        </p>
        <div className="mt-6 rounded-[12px] bg-[#f5f0e0] p-4 text-[13px] text-[#3a3a3a] leading-[1.55]">
          <div className="font-semibold text-[#0a0a0a] mb-1">Audit log will record:</div>
          <code className="text-[12px] font-mono text-[#6a6a6a]">
            actor=maria@maesdental.ph · action={promoting ? "member.role.promote" : "member.role.demote"} · target={member.email}
          </code>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <ButtonSecondary onClick={onClose}>Cancel</ButtonSecondary>
          <ButtonPrimary onClick={onClose}>{promoting ? "Promote" : "Demote"}</ButtonPrimary>
        </div>
      </div>
    </ModalShell>
  );
}

function OverlayCallRoleAssign({ member, onClose }) {
  const [next, setNext] = useState(member.callRole);
  return (
    <ModalShell onClose={onClose}>
      <div className="p-8">
        <h3 className="text-[24px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">Set call role</h3>
        <p className="mt-2 text-[14px] text-[#3a3a3a]">
          Choose what <span className="font-semibold">{member.name}</span> is allowed to do. Server-rejects forbidden initiations (Step 3 enforcement).
        </p>
        <div className="mt-6 space-y-2">
          {[
            { v: "both",     label: "Caller + Receiver", desc: "Can initiate and receive calls (default for admins)" },
            { v: "caller",   label: "Caller",            desc: "Can initiate calls; receives no incoming-call ring" },
            { v: "receiver", label: "Receiver only",     desc: "Receives calls; CALL button hidden in their UI (default)" },
          ].map((opt) => (
            <button
              key={opt.v}
              onClick={() => setNext(opt.v)}
              className={`w-full text-left rounded-[12px] border p-4 ${next === opt.v ? "border-[#0a0a0a] bg-[#f5f0e0]" : "border-[#e5e5e5] hover:border-[#0a0a0a]"}`}
            >
              <div className="text-[14px] font-semibold text-[#0a0a0a]">{opt.label}</div>
              <div className="text-[12px] text-[#6a6a6a] mt-1">{opt.desc}</div>
            </button>
          ))}
        </div>
        <div className="mt-6 rounded-[12px] bg-[#f5f0e0] p-4 text-[12px] font-mono text-[#6a6a6a]">
          action=device.role.assign · target={member.email} · from={member.callRole} → to={next}
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <ButtonSecondary onClick={onClose}>Cancel</ButtonSecondary>
          <ButtonPrimary onClick={onClose}>Save</ButtonPrimary>
        </div>
      </div>
    </ModalShell>
  );
}

function OverlayPwaBanner({ onClose }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-md rounded-[24px] bg-[#0a0a0a] text-white p-6 flex items-start gap-4 border border-white/10">
      <div className="w-12 h-12 rounded-[12px] bg-[#ff4d8b] grid place-items-center text-[18px] flex-shrink-0">📲</div>
      <div className="flex-1">
        <div className="text-[14px] font-semibold">Install {TENANT.brandedName} on this device</div>
        <div className="text-[13px] text-white/70 mt-1 leading-[1.5]">Faster startup, ringing notifications, full-screen calls.</div>
        <div className="text-[12px] text-white/50 mt-2 leading-[1.5]">Shown on 2nd visit · Dismiss snoozes 30 days · iOS Safari sees a fallback walkthrough</div>
      </div>
      <div className="flex flex-col gap-2 flex-shrink-0">
        <button className="px-4 py-1.5 rounded-[8px] bg-white text-[#0a0a0a] text-[13px] font-semibold">Install</button>
        <button onClick={onClose} className="px-4 py-1.5 rounded-[8px] text-white/70 hover:text-white text-[12px]">Not now</button>
      </div>
    </div>
  );
}

function OverlayOfflineBanner({ onClose }) {
  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-md rounded-[16px] bg-[#f59e0b]/95 text-[#0a0a0a] border border-[#f59e0b] px-6 py-3 flex items-center gap-3">
      <span className="w-2.5 h-2.5 rounded-full bg-[#0a0a0a] animate-pulse" />
      <div className="flex-1 text-[13px] font-medium">Reconnecting… queued mutations will replay automatically.</div>
      <button onClick={onClose} className="text-[12px] font-semibold underline">Dismiss</button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TIER 2 — STUBS                                                       */
/* ------------------------------------------------------------------ */

function ScreenStub({ go, breadcrumb, title, note, lanContext = false }) {
  return (
    <div className="min-h-screen bg-[#fffaf0] flex flex-col">
      {lanContext ? <MarketingNav go={go} /> : <TenantTopBar go={go} currentScreen="" />}
      <main className="flex-1 grid place-items-center px-6 py-24">
        <div className="max-w-md w-full rounded-[24px] border border-dashed border-[#e5e5e5] bg-[#faf5e8] p-12 text-center">
          <div className="text-[12px] font-semibold tracking-[0.12em] uppercase text-[#9a9a9a]">{breadcrumb}</div>
          <h2 className="mt-3 text-[32px] font-medium tracking-[-0.01em] text-[#0a0a0a]">{title}</h2>
          <p className="mt-3 text-[14px] text-[#6a6a6a] leading-[1.55]">{note}</p>
          <div className="mt-6 inline-block px-3 py-1 rounded-full bg-[#fffaf0] border border-[#e5e5e5] text-[12px] font-semibold uppercase tracking-[0.1em] text-[#6a6a6a]">Tier 2 — placeholder</div>
          <div className="mt-6">
            <ButtonSecondary onClick={() => go("app")}>Back to app</ButtonSecondary>
          </div>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ROOT                                                                 */
/* ------------------------------------------------------------------ */

export default function Mockup() {
  const [screen, setScreen] = useState("landing");
  const [overlay, setOverlay] = useState(null);
  const [myCallRole, setMyCallRole] = useState("both");

  const go = (next) => { setOverlay(null); setScreen(next); };

  const JUMPER_GROUPS = [
    { label: "Tier 1", items: [
      ["landing","Landing"], ["signup","Signup"], ["login","Login"],
      ["app","App / Idle"], ["call","Call"], ["members","Members"],
      ["branding","Branding"], ["settings","Settings"],
    ]},
    { label: "Tier 2 stubs", items: [
      ["pricing","Pricing"], ["legalPrivacy","Privacy"], ["legalTerms","Terms"],
      ["forgot","Forgot pw"], ["reset","Reset pw"], ["verify","Verify email"],
      ["invite","Invite"], ["tenantSuspended","Suspended"],
      ["pwbtRoot","_pwbt root"], ["pwbtTenants","_pwbt Tenants"], ["pwbtImport","_pwbt Import"],
      ["orgSettings","Org settings"], ["lanSetup","LAN Setup"], ["lanLogin","LAN Admin Login"],
    ]},
  ];

  return (
    <div className="font-sans antialiased text-[#0a0a0a] bg-[#fffaf0] min-h-screen" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <MockupBanner />

      <div className="sticky top-[32px] z-40 w-full bg-[#0a0a0a] text-white text-[12px] overflow-x-auto">
        <div className="max-w-[1280px] mx-auto flex items-center gap-4 px-4 py-2 whitespace-nowrap">
          {JUMPER_GROUPS.map((g) => (
            <div key={g.label} className="flex items-center gap-1.5">
              <span className="text-white/40 uppercase tracking-[0.08em] text-[12px] font-semibold mr-1">{g.label}</span>
              {g.items.map(([key, lbl]) => (
                <button
                  key={key}
                  onClick={() => go(key)}
                  className={`px-2.5 py-1 rounded-[6px] font-medium ${screen === key ? "bg-white text-[#0a0a0a]" : "text-white/80 hover:bg-white/10"}`}
                >{lbl}</button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {screen === "landing"     && <ScreenLanding     go={go} />}
      {screen === "signup"      && <ScreenSignup      go={go} />}
      {screen === "login"       && <ScreenLogin       go={go} />}
      {screen === "app"         && <ScreenApp         go={go} overlay={overlay} setOverlay={setOverlay} myCallRole={myCallRole} setMyCallRole={setMyCallRole} />}
      {screen === "call"        && <ScreenActiveCall  go={go} />}
      {screen === "members"     && <ScreenAdminMembers go={go} overlay={overlay} setOverlay={setOverlay} />}
      {screen === "branding"    && <ScreenAdminBranding go={go} />}
      {screen === "settings"    && <ScreenSettings    go={go} />}

      {screen === "pricing"         && <ScreenStub go={go} lanContext breadcrumb="yelli.app / pricing"          title="Pricing"               note="3-tier card grid: Starter (free for LAN OSS) · Cloud Starter · Cloud Growth. Featured tier flips to brand-teal." />}
      {screen === "legalPrivacy"    && <ScreenStub go={go} lanContext breadcrumb="yelli.app / legal / privacy"  title="Privacy policy"        note="Long-form privacy doc. Single-column 720px body width. Last-updated stamp top-right. PH DPA-aligned + GDPR opt-in language." />}
      {screen === "legalTerms"      && <ScreenStub go={go} lanContext breadcrumb="yelli.app / legal / terms"    title="Terms of service"      note="Standard B2B SaaS terms. Same layout as privacy. Sibling page — both live under /legal/." />}
      {screen === "forgot"          && <ScreenStub go={go} lanContext breadcrumb="yelli.app / forgot-password"  title="Forgot password"       note="Single-field email input + Cloudflare Turnstile. V25 anti-enumeration: always returns 'check your inbox' regardless of whether the email exists." />}
      {screen === "reset"           && <ScreenStub go={go} lanContext breadcrumb="yelli.app / reset-password"   title="Reset password"        note="Token-gated landing. New password + confirm fields. Token-expiry banner if past 1h." />}
      {screen === "verify"          && <ScreenStub go={go} lanContext breadcrumb="yelli.app / verify-email"     title="Verify email"          note="Token-gated success/error page. Redirects to /app on success." />}
      {screen === "invite"          && <ScreenStub go={go} lanContext breadcrumb="yelli.app / invite"           title="Accept invitation"     note="Shows inviting org + role being assigned. CTA: 'Set password & join'." />}
      {screen === "tenantSuspended" && <ScreenStub go={go} lanContext breadcrumb="<slug>.yelli.app / suspended" title="Org is suspended"      note="Shown when Tenant.isSuspended=true. All authenticated routes redirect here. Contact billing CTA + Powerbyte support email. session.invalidate forces users into this state." />}
      {screen === "pwbtRoot"        && <ScreenStub go={go} breadcrumb="_pwbt"                                   title="Powerbyte Super-Admin" note="Root landing for /_pwbt/. Quick links to Tenants and Import. Runs on its own tRPC router + dedicated Prisma client (V25). Separate auth chain — no shared middleware with tenant-scoped routers." />}
      {screen === "pwbtTenants"     && <ScreenStub go={go} breadcrumb="_pwbt / tenants"                         title="Powerbyte: Tenants"    note="Super-Admin list of every Cloud tenant. Search, suspend, view billing state. Lives behind /_pwbt/ (V25)." />}
      {screen === "pwbtImport"      && <ScreenStub go={go} breadcrumb="_pwbt / import"                          title="LAN tenant import"     note="Upload a yelli-lan-export-*.tar.gz, pick target slug, preview entities, confirm. Single Prisma transaction; full rollback on failure." />}
      {screen === "orgSettings"     && <ScreenStub go={go} breadcrumb="admin / settings"                        title="Org settings"          note="Tenant-level prefs: timezone, default new-member role, request data export, request tenant deletion (7-day soft delete)." />}
      {screen === "lanSetup"        && <ScreenStub go={go} lanContext breadcrumb="LAN host / setup"             title="LAN first-run wizard"  note="One-time host-side wizard: set Argon2id admin passphrase, upload logo, set display name, generate self-signed cert. Locked behind host-side run, not exposed over LAN." />}
      {screen === "lanLogin"        && <ScreenStub go={go} lanContext breadcrumb="LAN host / admin/login"       title="LAN admin login"       note="Anonymous-mode admin gate. Single passphrase input matched against Argon2id hash on Tenant.adminPassphraseHash. Rate-limited 5/min/IP. Sets yelli_admin_session HttpOnly cookie (30-day rolling, SameSite=Lax, Secure when HTTPS)." />}
    </div>
  );
}
