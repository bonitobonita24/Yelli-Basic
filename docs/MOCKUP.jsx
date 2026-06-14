/**
 * MOCKUP.jsx — Yelli Phase 2.8 visual mockup (mobile-first revision)
 *
 * Mobile-first global contract locked in PRODUCT.md Step 10.
 *   - Base = 375px portrait. Every layout designed from there UP.
 *   - md: (768px) and lg: (1024px) ADD desktop affordances; never recover from a desktop layout.
 *   - 44×44 touch targets minimum.
 *   - Tables render as card lists at <md; <table> at md:+.
 *   - Modals become bottom-sheets at <md, centered at md:+.
 *   - Tenant top bar collapses to hamburger + bottom-nav at <md.
 *
 * Tokens come from DESIGN.md (Clay system + Step 10 mobile-first principles).
 */

import React, { useState } from "react";

/* ------------------------------------------------------------------ */
/* DESIGN TOKENS                                                       */
/* ------------------------------------------------------------------ */

const T = {
  canvas: "#fffaf0", surfaceSoft: "#faf5e8", surfaceCard: "#f5f0e0", surfaceStrong: "#ebe6d6",
  surfaceDark: "#0a1a1a", surfaceDarkElevated: "#1a2a2a",
  hairline: "#e5e5e5", hairlineSoft: "#f0f0f0",
  ink: "#0a0a0a", primaryActive: "#1f1f1f", bodyStrong: "#1a1a1a", body: "#3a3a3a",
  muted: "#6a6a6a", mutedSoft: "#9a9a9a", onPrimary: "#ffffff",
  brandPink: "#ff4d8b", brandTeal: "#1a3a3a", brandLavender: "#b8a4ed",
  brandPeach: "#ffb084", brandOchre: "#e8b94a", brandMint: "#a4d4c5", brandCoral: "#ff6b5a",
  success: "#22c55e", successStrong: "#15803d",
  warning: "#f59e0b", warningStrong: "#b45309",
  error: "#ef4444", errorStrong: "#b91c1c",
};

/* ------------------------------------------------------------------ */
/* DUMMY DATA                                                          */
/* ------------------------------------------------------------------ */

const TENANT = {
  slug: "maes", legalName: "Maes Dental Clinic", brandedName: "Maes Intercom",
  logoLetter: "M", plan: "Starter",
};

const ME = {
  name: "Maria Mendoza", email: "maria@maesdental.ph",
  role: "admin", callRole: "both",
};

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

const RESERVED_SLUGS = [
  "www","api","app","admin","staging","dev","_pwbt","pwbt","status",
  "blog","docs","mail","smtp","mx","support","help","auth","cdn",
];

/* ------------------------------------------------------------------ */
/* PRIMITIVES                                                          */
/* ------------------------------------------------------------------ */

function MockupBanner() {
  return (
    <div className="sticky top-0 z-50 w-full bg-[#f59e0b] text-[#0a0a0a] text-[12px] sm:text-[13px] font-semibold tracking-wide flex items-center justify-center gap-2 py-2 px-3 border-b border-[#0a0a0a]/15 text-center">
      <span className="text-[16px] flex-shrink-0">📐</span>
      <span>PHASE 2.8 MOBILE-FIRST MOCKUP — base 375px → md/lg enhance. Not live.</span>
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

/* ------------------------------------------------------------------ */
/* MARKETING NAV — hamburger sheet at base, full links at md+         */
/* ------------------------------------------------------------------ */

function MarketingNav({ go }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <nav className="w-full h-16 px-4 md:px-12 flex items-center justify-between bg-[#fffaf0]">
        <button onClick={() => go("landing")} className="flex items-center gap-2 h-11 -ml-2 px-2">
          <div className="w-8 h-8 rounded-[8px] bg-[#0a0a0a] text-white grid place-items-center font-semibold text-[14px]">Y</div>
          <span className="text-[18px] font-semibold tracking-[-0.02em] text-[#0a0a0a]">Yelli</span>
        </button>
        <div className="hidden md:flex items-center gap-8 text-[14px] font-medium text-[#3a3a3a]">
          <a className="hover:text-[#0a0a0a] cursor-pointer" onClick={() => go("pricing")}>Pricing</a>
          <a className="hover:text-[#0a0a0a] cursor-pointer" onClick={() => go("legalPrivacy")}>Docs</a>
          <a className="hover:text-[#0a0a0a] cursor-pointer">Customers</a>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => go("login")} className="hidden sm:inline-flex h-11 px-3 text-[14px] font-medium text-[#0a0a0a] hover:underline">Sign in</button>
          <ButtonPrimary onClick={() => go("signup")} className="hidden sm:inline-flex">Start free</ButtonPrimary>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Open menu"
            className="md:hidden w-11 h-11 rounded-[12px] grid place-items-center hover:bg-[#f5f0e0]"
          >
            <span className="text-[20px]">{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </nav>
      {open && (
        <div className="md:hidden border-t border-[#e5e5e5] bg-[#fffaf0] px-4 py-4 space-y-2">
          <button onClick={() => { setOpen(false); go("pricing"); }} className="w-full h-11 px-3 rounded-[12px] text-left text-[14px] font-medium text-[#0a0a0a] hover:bg-[#f5f0e0]">Pricing</button>
          <button onClick={() => { setOpen(false); go("legalPrivacy"); }} className="w-full h-11 px-3 rounded-[12px] text-left text-[14px] font-medium text-[#0a0a0a] hover:bg-[#f5f0e0]">Docs</button>
          <button className="w-full h-11 px-3 rounded-[12px] text-left text-[14px] font-medium text-[#0a0a0a] hover:bg-[#f5f0e0]">Customers</button>
          <div className="pt-3 border-t border-[#e5e5e5] grid grid-cols-2 gap-3">
            <ButtonSecondary onClick={() => { setOpen(false); go("login"); }} className="w-full">Sign in</ButtonSecondary>
            <ButtonPrimary onClick={() => { setOpen(false); go("signup"); }} className="w-full">Start free</ButtonPrimary>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* TENANT TOP BAR — hamburger at base; horizontal links at md+        */
/* ------------------------------------------------------------------ */

function TenantTopBar({ go, currentScreen }) {
  const [open, setOpen] = useState(false);
  const linkBase = "text-[14px] font-medium px-3 py-1.5 rounded-[8px]";
  const linkActive = "bg-[#f5f0e0] text-[#0a0a0a]";
  const linkIdle = "text-[#3a3a3a] hover:text-[#0a0a0a]";
  const items = [
    ["app", "Directory"], ["members", "Members"], ["branding", "Branding"], ["orgSettings", "Org Settings"],
  ];
  return (
    <>
      <header className="w-full h-16 px-4 md:px-6 flex items-center justify-between bg-[#fffaf0] border-b border-[#e5e5e5]">
        <button onClick={() => go("app")} className="flex items-center gap-2 h-11 -ml-2 px-2 min-w-0">
          <div className="w-9 h-9 rounded-[8px] bg-[#1a3a3a] text-white grid place-items-center font-semibold flex-shrink-0">{TENANT.logoLetter}</div>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-[14px] font-semibold text-[#0a0a0a] truncate">{TENANT.brandedName}</span>
            <span className="text-[12px] text-[#6a6a6a] truncate">{TENANT.slug}.yelli-basic.powerbyte.app</span>
          </div>
        </button>
        <nav className="hidden md:flex items-center gap-1">
          {items.map(([k, lbl]) => (
            <a key={k} onClick={() => go(k)} className={`${linkBase} ${currentScreen === k ? linkActive : linkIdle} cursor-pointer`}>{lbl}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={() => go("settings")} className="flex items-center gap-2 h-11 px-2 rounded-[12px] hover:bg-[#f5f0e0]">
            <div className="w-9 h-9 rounded-full bg-[#b8a4ed] grid place-items-center text-[12px] font-semibold text-[#0a0a0a]">MM</div>
            <span className="hidden sm:inline text-[14px] font-medium text-[#0a0a0a]">{ME.name.split(" ")[0]}</span>
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Open menu"
            className="md:hidden w-11 h-11 rounded-[12px] grid place-items-center hover:bg-[#f5f0e0]"
          >
            <span className="text-[20px]">{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </header>
      {open && (
        <div className="md:hidden border-b border-[#e5e5e5] bg-[#fffaf0] px-4 py-3 space-y-1">
          {items.map(([k, lbl]) => (
            <button key={k} onClick={() => { setOpen(false); go(k); }} className={`w-full h-11 px-3 rounded-[12px] text-left text-[14px] font-medium ${currentScreen === k ? "bg-[#f5f0e0] text-[#0a0a0a]" : "text-[#3a3a3a] hover:bg-[#f5f0e0]"}`}>{lbl}</button>
          ))}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* BOTTOM NAV — tenant pages only, visible at <md                     */
/* ------------------------------------------------------------------ */

function BottomNav({ go, currentScreen }) {
  const items = [
    ["app",      "Directory", "👥"],
    ["members",  "Members",   "🧑‍💼"],
    ["branding", "Branding",  "🎨"],
    ["settings", "You",       "⚙️"],
  ];
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#fffaf0] border-t border-[#e5e5e5] grid grid-cols-4">
      {items.map(([k, lbl, icon]) => {
        const active = currentScreen === k;
        return (
          <button
            key={k}
            onClick={() => go(k)}
            className={`flex flex-col items-center justify-center h-16 gap-0.5 ${active ? "text-[#0a0a0a]" : "text-[#6a6a6a]"}`}
          >
            <span className="text-[18px] leading-none">{icon}</span>
            <span className="text-[12px] font-semibold leading-none">{lbl}</span>
            {active && <span className="w-8 h-0.5 rounded-full bg-[#0a0a0a] mt-0.5" />}
          </button>
        );
      })}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* SCREEN 1 — LANDING                                                   */
/* ------------------------------------------------------------------ */

function ScreenLanding({ go }) {
  return (
    <div className="min-h-screen bg-[#fffaf0]">
      <MarketingNav go={go} />

      {/* Hero — mobile-first: copy first, illustration card BELOW. md: bigger type. xl: side-by-side */}
      <section className="px-4 md:px-12 py-12 md:py-24">
        <div className="max-w-[1280px] mx-auto grid md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-7">
            <h1 className="text-[36px] sm:text-[40px] md:text-[56px] xl:text-[72px] leading-[1.05] tracking-[-0.025em] font-medium text-[#0a0a0a]">
              Video calls for the people across the room.
            </h1>
            <p className="mt-6 text-[16px] leading-[1.55] text-[#3a3a3a] max-w-[560px]">
              Yelli is 1-on-1 intercom for clinics, shops, and offices —
              over your LAN or our cloud, both keep video peer-to-peer.
              White-label your name and logo in 30 seconds.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
              <ButtonPrimary onClick={() => go("signup")} className="w-full sm:w-auto">Start free — no card</ButtonPrimary>
              <ButtonSecondary onClick={() => go("pricing")} className="w-full sm:w-auto">See pricing</ButtonSecondary>
            </div>
            <p className="mt-6 text-[13px] text-[#6a6a6a]">
              Self-host on your network with Yelli LAN · zero per-seat fees · open-source core
            </p>
          </div>
          <div className="md:col-span-5">
            <div className="aspect-square rounded-[24px] bg-[#faf5e8] grid place-items-center p-8 md:p-12 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#b8a4ed]/30 via-[#ffb084]/20 to-[#a4d4c5]/30" />
              <div className="relative z-10 grid grid-cols-2 gap-3 md:gap-4 w-full">
                <div className="aspect-square rounded-[24px] bg-[#0a0a0a] grid place-items-center text-white text-[32px] md:text-[40px]">📞</div>
                <div className="aspect-square rounded-[24px] bg-[#ff4d8b] grid place-items-center text-white text-[32px] md:text-[40px]">📹</div>
                <div className="aspect-square rounded-[24px] bg-[#e8b94a] grid place-items-center text-[#0a0a0a] text-[32px] md:text-[40px]">👥</div>
                <div className="aspect-square rounded-[24px] bg-[#1a3a3a] grid place-items-center text-white text-[32px] md:text-[40px]">🔒</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature cards — 1-up at base, 2-up at md, 3-up at lg */}
      <section className="px-4 md:px-12 pb-12 md:pb-24">
        <div className="max-w-[1280px] mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <article className="rounded-[24px] bg-[#ff4d8b] text-white p-6 md:p-8">
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

          <article className="rounded-[24px] bg-[#1a3a3a] text-white p-6 md:p-8">
            <h3 className="text-[18px] font-semibold mb-3">Cloud edition</h3>
            <p className="text-[14px] leading-[1.55] opacity-95">
              Multi-tenant SaaS hosted by Powerbyte. Cross-network calls,
              email invites, daily backups. Your own subdomain.
            </p>
            <div className="mt-6 rounded-[16px] bg-white text-[#0a0a0a] p-4 text-[12px] font-mono break-all">
              <span className="text-[#6a6a6a]">https://</span>
              <span className="font-semibold">your-org</span>
              <span className="text-[#6a6a6a]">.yelli-basic.powerbyte.app</span>
            </div>
          </article>

          <article className="rounded-[24px] bg-[#b8a4ed] text-[#0a0a0a] p-6 md:p-8 md:col-span-2 lg:col-span-1">
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

      {/* CTA band — stacks at base */}
      <section className="px-4 md:px-12 pb-12 md:pb-16">
        <div className="max-w-[1280px] mx-auto rounded-[24px] bg-[#faf5e8] p-8 md:p-24 grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          <div>
            <h2 className="text-[32px] md:text-[40px] leading-[1.1] tracking-[-0.01em] font-medium text-[#0a0a0a]">
              Set up your org in under a minute.
            </h2>
            <p className="mt-4 text-[16px] text-[#3a3a3a]">No credit card. 14-day trial. Cancel anytime.</p>
            <div className="mt-6">
              <ButtonPrimary onClick={() => go("signup")} className="w-full sm:w-auto">Create your org</ButtonPrimary>
            </div>
          </div>
          <div className="aspect-[4/3] rounded-[24px] bg-[#ffb084] grid place-items-center text-[#0a0a0a]" style={{ fontSize: 64 }}>🏔️</div>
        </div>
      </section>

      <AppFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SCREEN 2 — SIGNUP (mobile-first form)                                */
/* ------------------------------------------------------------------ */

function ScreenSignup({ go }) {
  const [slug, setSlug] = useState("");
  const isReserved = RESERVED_SLUGS.includes(slug.toLowerCase());
  const isValid = /^[a-z][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length >= 3 && slug.length <= 30 && !isReserved;

  return (
    <div className="min-h-screen bg-[#fffaf0]">
      <MarketingNav go={go} />
      <section className="px-4 md:px-12 py-12 md:py-16">
        <div className="max-w-[480px] mx-auto">
          <h1 className="text-[32px] md:text-[40px] leading-[1.1] tracking-[-0.015em] font-medium text-[#0a0a0a]">Create your org</h1>
          <p className="mt-3 text-[16px] text-[#3a3a3a]">14-day trial · no card · own your subdomain</p>

          <form className="mt-10 space-y-5" onSubmit={(e) => { e.preventDefault(); }}>
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
                  className="flex-1 min-w-0 h-11 px-4 rounded-l-[12px] bg-[#fffaf0] border border-[#e5e5e5] focus:border-[#0a0a0a] focus:outline-none text-[16px] text-[#0a0a0a] font-mono"
                />
                <span className="h-11 px-3 inline-flex items-center rounded-r-[12px] bg-[#f5f0e0] border border-l-0 border-[#e5e5e5] text-[13px] text-[#3a3a3a] font-mono whitespace-nowrap">.yelli-basic.powerbyte.app</span>
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
                <div className="mt-2 text-[12px] text-[#15803d] font-medium">✓ {slug}.yelli-basic.powerbyte.app is available</div>
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
              <input type="checkbox" className="mt-1 w-5 h-5" />
              <span>I agree to the <a onClick={() => go("legalTerms")} className="underline cursor-pointer">Terms</a> and <a onClick={() => go("legalPrivacy")} className="underline cursor-pointer">Privacy Policy</a>.</span>
            </label>

            <div className="rounded-[12px] border border-[#e5e5e5] bg-[#faf5e8] px-4 py-3 flex items-center gap-3">
              <div className="w-6 h-6 rounded-[6px] border border-[#0a0a0a]" />
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
      <section className="px-4 md:px-12 py-12 md:py-16">
        <div className="max-w-[420px] mx-auto">
          <h1 className="text-[32px] md:text-[40px] leading-[1.1] tracking-[-0.015em] font-medium text-[#0a0a0a]">Sign in</h1>
          <p className="mt-3 text-[16px] text-[#3a3a3a]">Welcome back. Enter your org credentials.</p>

          <form className="mt-10 space-y-5" onSubmit={(e) => { e.preventDefault(); go("app"); }}>
            <div>
              <label className="block text-[13px] font-semibold text-[#0a0a0a] mb-2">Work email</label>
              <input type="email" defaultValue="maria@maesdental.ph" className="w-full h-11 px-4 rounded-[12px] bg-[#fffaf0] border border-[#e5e5e5] focus:border-[#0a0a0a] focus:outline-none text-[16px] text-[#0a0a0a]" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[13px] font-semibold text-[#0a0a0a]">Password</label>
                <a onClick={() => go("forgot")} className="text-[12px] text-[#0a0a0a] underline cursor-pointer h-11 inline-flex items-center">Forgot?</a>
              </div>
              <input type="password" className="w-full h-11 px-4 rounded-[12px] bg-[#fffaf0] border border-[#e5e5e5] focus:border-[#0a0a0a] focus:outline-none text-[16px] text-[#0a0a0a]" />
            </div>

            <div className="rounded-[12px] border border-[#e5e5e5] bg-[#faf5e8] px-4 py-3 flex items-center gap-3">
              <div className="w-6 h-6 rounded-[6px] border border-[#0a0a0a]" />
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
/* SCREEN 4 — APP (Idle / Directory) — single-column at base           */
/* ------------------------------------------------------------------ */

function ScreenApp({ go, overlay, setOverlay, myCallRole, setMyCallRole }) {
  const canInitiate = myCallRole === "caller" || myCallRole === "both";
  const visibleMembers = MEMBERS.filter((m) => m.status !== "archived");
  const onlineMembers = visibleMembers.filter((m) => m.status === "online" || m.status === "idle");

  return (
    <div className="min-h-screen bg-[#fffaf0] flex flex-col pb-20 md:pb-0">
      <TenantTopBar go={go} currentScreen="app" />

      <div className="text-[12px] text-[#6a6a6a] text-center py-1.5 px-4 bg-[#faf5e8] border-b border-[#e5e5e5]">
        Same screen serves LAN (anonymous) + Cloud (auth) + LAN account mode.
      </div>

      {/* Mobile-first: CALL hero FIRST, then identity, then directory */}
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 md:px-12 py-6 md:py-12 grid md:grid-cols-12 gap-6 md:gap-8">

        {/* CALL hero — full-width at base; sits in right column on md+ */}
        <section className="md:col-span-8 md:order-2 space-y-4 md:space-y-6">
          {canInitiate ? (
            <div className="rounded-[24px] bg-[#1a3a3a] text-white p-8 md:p-12 grid place-items-center min-h-[260px] md:min-h-[280px] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#1a3a3a] via-[#1a3a3a] to-[#0a1a1a]" />
              <div className="relative z-10 text-center">
                <div className="text-[12px] font-semibold tracking-[0.16em] uppercase opacity-70">Ready to call</div>
                <button
                  onClick={() => go("call")}
                  className="mt-5 w-36 h-36 md:w-44 md:h-44 rounded-full bg-white text-[#0a0a0a] grid place-items-center hover:scale-[1.02] transition"
                >
                  <div className="text-[40px] md:text-[56px]">📞</div>
                  <div className="text-[14px] font-semibold tracking-[0.08em] mt-1">CALL</div>
                </button>
                <div className="mt-5 text-[13px] opacity-80">Tap a person below, then CALL</div>
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] bg-[#f5f0e0] border border-[#e5e5e5] p-8 md:p-12 grid place-items-center min-h-[200px]">
              <div className="text-center max-w-md">
                <div className="text-[12px] font-semibold tracking-[0.16em] uppercase text-[#6a6a6a]">Receiver-only device</div>
                <div className="mt-3 text-[18px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">CALL is hidden for this device</div>
                <div className="mt-2 text-[13px] text-[#6a6a6a] leading-[1.55]">An admin assigned you the <span className="font-semibold">receiver-only</span> call role. You'll see incoming calls; the CALL button is hidden per Step 3 enforcement.</div>
              </div>
            </div>
          )}

          {/* Directory */}
          <div className="rounded-[16px] border border-[#e5e5e5] bg-[#fffaf0]">
            <div className="px-4 md:px-6 py-4 border-b border-[#e5e5e5] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="text-[14px] font-semibold text-[#0a0a0a]">Directory</div>
                <div className="text-[12px] text-[#6a6a6a]">{onlineMembers.length} online · archived hidden</div>
              </div>
              <input type="search" placeholder="Search…" className="h-11 sm:h-9 px-3 rounded-[8px] border border-[#e5e5e5] bg-[#fffaf0] text-[14px] focus:outline-none focus:border-[#0a0a0a]" />
            </div>
            <ul className="divide-y divide-[#e5e5e5]">
              {visibleMembers.slice(0, 10).map((m) => {
                const disabled = m.status === "offline" || m.status === "suspended";
                return (
                  <li key={m.email} className={`flex items-center gap-3 md:gap-4 px-4 md:px-6 py-3 ${disabled ? "opacity-50" : ""}`}>
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${m.status === "online" ? "bg-[#22c55e]" : m.status === "idle" ? "bg-[#f59e0b]" : "bg-[#9a9a9a]"}`} />
                    <div className="w-10 h-10 rounded-full bg-[#b8a4ed] grid place-items-center text-[12px] font-semibold text-[#0a0a0a] flex-shrink-0">
                      {m.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-[#0a0a0a] truncate flex items-center gap-2 flex-wrap">
                        <span className="truncate">{m.name}</span>
                        {m.role === "admin" && <Pill tone="admin">Admin</Pill>}
                      </div>
                      <div className="text-[12px] text-[#6a6a6a] truncate">{m.device} · {m.lastSeen}{m.callRole === "receiver" ? " · Receiver only" : ""}</div>
                    </div>
                    {canInitiate && (
                      <button
                        disabled={disabled}
                        onClick={() => go("call")}
                        className="ml-1 h-11 px-4 rounded-[8px] bg-[#0a0a0a] text-white text-[13px] font-semibold disabled:bg-[#e5e5e5] disabled:text-[#9a9a9a] hover:bg-[#1f1f1f] flex-shrink-0"
                      >Call</button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Left rail — STACKS ABOVE main content on mobile (md:order-1 keeps it left on desktop) */}
        <aside className="md:col-span-4 md:order-1 space-y-4">
          <div className="rounded-[16px] border border-[#e5e5e5] bg-[#fffaf0] p-5 md:p-6">
            <div className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">You</div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[18px] font-semibold tracking-[-0.01em] text-[#0a0a0a] truncate">{ME.name}</span>
              <button onClick={() => setOverlay("namePicker")} className="text-[12px] text-[#6a6a6a] hover:text-[#0a0a0a] underline h-11 px-2 flex-shrink-0">Edit</button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Pill tone="admin">Admin</Pill>
              <Pill tone="online">Online</Pill>
              <CallRoleLabel role={myCallRole} />
            </div>
            <div className="mt-3 text-[12px] text-[#6a6a6a]">Device: Reception PC · WebSocket connected</div>

            <div className="mt-4 pt-4 border-t border-[#e5e5e5]">
              <div className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a] mb-2">Demo: view as</div>
              <div className="grid grid-cols-3 gap-2">
                {["both", "caller", "receiver"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setMyCallRole(r)}
                    className={`h-11 px-2 rounded-[8px] text-[12px] font-semibold border ${myCallRole === r ? "bg-[#0a0a0a] text-white border-[#0a0a0a]" : "bg-[#fffaf0] text-[#0a0a0a] border-[#e5e5e5] hover:border-[#0a0a0a]"}`}
                  >{r === "both" ? "Both" : r === "caller" ? "Caller" : "Receiver"}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-1 gap-3">
            <button onClick={() => setOverlay("pwa")} className="text-left rounded-[16px] border border-dashed border-[#0a0a0a]/30 bg-[#faf5e8] p-4 md:p-5 hover:bg-[#f5f0e0] min-h-[64px]">
              <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">Demo</div>
              <div className="mt-1 text-[13px] text-[#3a3a3a]">PWA install banner →</div>
            </button>
            <button onClick={() => setOverlay("offline")} className="text-left rounded-[16px] border border-dashed border-[#0a0a0a]/30 bg-[#faf5e8] p-4 md:p-5 hover:bg-[#f5f0e0] min-h-[64px]">
              <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">Demo</div>
              <div className="mt-1 text-[13px] text-[#3a3a3a]">Offline reconnecting banner →</div>
            </button>
            <button onClick={() => setOverlay("incomingCall")} className="text-left rounded-[16px] border border-dashed border-[#0a0a0a]/30 bg-[#faf5e8] p-4 md:p-5 hover:bg-[#f5f0e0] min-h-[64px]">
              <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">Demo</div>
              <div className="mt-1 text-[13px] text-[#3a3a3a]">Incoming call modal →</div>
            </button>
          </div>
        </aside>
      </main>

      <AppFooter />
      <BottomNav go={go} currentScreen="app" />

      {overlay === "incomingCall" && <OverlayIncomingCall onClose={() => setOverlay(null)} onAccept={() => { setOverlay(null); go("call"); }} />}
      {overlay === "namePicker" && <OverlayNamePicker onClose={() => setOverlay(null)} />}
      {overlay === "pwa" && <OverlayPwaBanner onClose={() => setOverlay(null)} />}
      {overlay === "offline" && <OverlayOfflineBanner onClose={() => setOverlay(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SCREEN 5 — ACTIVE CALL — portrait-optimized                          */
/* ------------------------------------------------------------------ */

function ScreenActiveCall({ go }) {
  return (
    <div className="min-h-screen bg-[#0a1a1a] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a3a3a] via-[#0a1a1a] to-[#0a0a0a]" />
      <div className="absolute inset-0 grid place-items-center">
        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-[#ffb084] grid place-items-center text-[#0a0a0a]" style={{ fontSize: 56 }}>
          {MEMBERS[1].name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
        </div>
      </div>

      <div className="absolute top-0 left-0 right-0 px-4 md:px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => go("app")} className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-[18px] flex-shrink-0">←</button>
          <div className="flex flex-col min-w-0">
            <span className="text-[14px] md:text-[16px] font-semibold truncate">{MEMBERS[1].name}</span>
            <span className="text-[12px] text-white/70 truncate">{MEMBERS[1].device}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 backdrop-blur flex-shrink-0">
          <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="text-[13px] font-mono">02:14</span>
        </div>
      </div>

      <div className="absolute bottom-32 right-4 md:right-6 w-28 h-40 md:w-40 md:h-56 rounded-[16px] overflow-hidden border-2 border-white/30 bg-gradient-to-br from-[#b8a4ed] to-[#ff4d8b] grid place-items-center text-[40px] z-10">
        🙂
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 grid place-items-center z-10">
        <div className="flex items-center gap-2 md:gap-3 px-3 py-3 rounded-full bg-black/40 backdrop-blur-lg border border-white/10">
          <button className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-white/15 hover:bg-white/25 grid place-items-center text-[18px]" title="Mute">🎤</button>
          <button className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-white/15 hover:bg-white/25 grid place-items-center text-[18px]" title="Camera">📷</button>
          <button onClick={() => go("app")} className="w-14 h-11 md:w-16 md:h-12 rounded-full bg-[#ef4444] hover:bg-[#b91c1c] grid place-items-center text-[18px]" title="End call">📞</button>
          <button className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-white/15 hover:bg-white/25 grid place-items-center text-[18px]" title="Speaker">🔊</button>
          <button className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-white/15 hover:bg-white/25 grid place-items-center text-[18px]" title="Swap PiP">🔄</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SCREEN 6 — ADMIN MEMBERS — card list at <md, table at md:+          */
/* ------------------------------------------------------------------ */

function MemberCard({ m, isLastAdmin, setOverlay }) {
  return (
    <div className={`rounded-[16px] border border-[#e5e5e5] bg-[#fffaf0] p-4 ${m.status === "suspended" || m.status === "archived" ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-[#b8a4ed] grid place-items-center text-[12px] font-semibold text-[#0a0a0a] flex-shrink-0">
          {m.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-[#0a0a0a] truncate">{m.name}</div>
          <div className="text-[12px] text-[#6a6a6a] truncate font-mono">{m.email}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Pill tone={m.role}>{m.role === "admin" ? "Admin" : "Member"}</Pill>
            <CallRoleLabel role={m.callRole} />
            <Pill tone={m.status}>
              {m.status === "online" ? "Online" :
               m.status === "idle" ? "Idle" :
               m.status === "offline" ? "Offline · " + m.lastSeen :
               m.status === "archived" ? "Archived · " + m.lastSeen :
               "Suspended"}
            </Pill>
          </div>
          <div className="mt-2 text-[12px] text-[#6a6a6a]">{m.device}</div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-[#e5e5e5] grid grid-cols-2 gap-2">
        <button
          onClick={() => setOverlay({ kind: "roleAssign", member: m })}
          disabled={isLastAdmin}
          title={isLastAdmin ? "Last admin can't be demoted — transfer first" : ""}
          className="h-11 rounded-[8px] border border-[#e5e5e5] text-[13px] font-semibold text-[#0a0a0a] hover:border-[#0a0a0a] disabled:text-[#9a9a9a] disabled:cursor-not-allowed disabled:hover:border-[#e5e5e5]"
        >{m.role === "admin" ? "Demote" : "Promote"}</button>
        <button
          onClick={() => setOverlay({ kind: "callRoleAssign", member: m })}
          className="h-11 rounded-[8px] border border-[#e5e5e5] text-[13px] font-semibold text-[#0a0a0a] hover:border-[#0a0a0a]"
        >Set call role</button>
        <button className="h-11 rounded-[8px] border border-[#e5e5e5] text-[13px] font-semibold text-[#0a0a0a] hover:border-[#0a0a0a]">Suspend</button>
        <button
          disabled={isLastAdmin}
          title={isLastAdmin ? "Last admin can't be removed — transfer first" : "Remove"}
          className="h-11 rounded-[8px] border border-[#ef4444]/30 text-[13px] font-semibold text-[#b91c1c] hover:border-[#ef4444] disabled:text-[#9a9a9a] disabled:border-[#e5e5e5] disabled:cursor-not-allowed"
        >Remove</button>
      </div>
    </div>
  );
}

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
    <div className="min-h-screen bg-[#fffaf0] flex flex-col pb-20 md:pb-0">
      <TenantTopBar go={go} currentScreen="members" />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 md:px-12 py-6 md:py-12">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-6 md:mb-8 gap-4">
          <div>
            <h1 className="text-[32px] md:text-[40px] leading-[1.1] tracking-[-0.015em] font-medium text-[#0a0a0a]">Members</h1>
            <p className="mt-1 text-[13px] md:text-[14px] text-[#6a6a6a]">{MEMBERS.length} members · {adminCount} admins · Last-admin guard active</p>
          </div>
          <div className="flex gap-2">
            <ButtonSecondary className="flex-1 md:flex-none">Export CSV</ButtonSecondary>
            <ButtonPrimary className="flex-1 md:flex-none">Invite member</ButtonPrimary>
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
              className={`h-11 px-3 rounded-full text-[13px] font-semibold ${filter === k ? "bg-[#f5f0e0] text-[#0a0a0a]" : "text-[#3a3a3a] hover:bg-[#f5f0e0]"}`}
            >{label}</button>
          ))}
        </div>

        <div className="mb-4">
          <input type="search" placeholder="Search members…" className="w-full h-11 px-4 rounded-[12px] border border-[#e5e5e5] bg-[#fffaf0] text-[14px] focus:outline-none focus:border-[#0a0a0a]" />
        </div>

        {/* Card list — mobile-first (<md) */}
        <div className="md:hidden space-y-3">
          {filtered.map((m) => (
            <MemberCard key={m.email} m={m} isLastAdmin={m.role === "admin" && adminCount === 1} setOverlay={setOverlay} />
          ))}
        </div>

        {/* Table — md:+ */}
        <div className="hidden md:block rounded-[16px] border border-[#e5e5e5] bg-[#fffaf0] overflow-hidden">
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
                    <td className="px-6 py-3"><Pill tone={m.role}>{m.role === "admin" ? "Admin" : "Member"}</Pill></td>
                    <td className="px-6 py-3"><CallRoleLabel role={m.callRole} /></td>
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
                      >{m.role === "admin" ? "Demote" : "Promote"}</button>
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

        <div className="mt-4 text-[12px] text-[#6a6a6a] flex items-start gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] mt-1.5 flex-shrink-0" />
          <span>Every promote / demote / call-role / suspend / remove writes an AuditLog entry. Devices auto-archive after 90 days offline.</span>
        </div>
      </main>

      <AppFooter />
      <BottomNav go={go} currentScreen="members" />

      {overlay?.kind === "roleAssign" && <OverlayRoleAssign member={overlay.member} onClose={() => setOverlay(null)} />}
      {overlay?.kind === "callRoleAssign" && <OverlayCallRoleAssign member={overlay.member} onClose={() => setOverlay(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SCREEN 7 — ADMIN BRANDING                                            */
/* ------------------------------------------------------------------ */

function ScreenAdminBranding({ go }) {
  return (
    <div className="min-h-screen bg-[#fffaf0] flex flex-col pb-20 md:pb-0">
      <TenantTopBar go={go} currentScreen="branding" />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 md:px-12 py-6 md:py-12 grid lg:grid-cols-12 gap-8 lg:gap-12">
        <div className="lg:col-span-7 space-y-6 md:space-y-8">
          <div>
            <h1 className="text-[32px] md:text-[40px] leading-[1.1] tracking-[-0.015em] font-medium text-[#0a0a0a]">Branding</h1>
            <p className="mt-1 text-[13px] md:text-[14px] text-[#6a6a6a]">White-label header text and logo. Footer is not editable.</p>
          </div>

          <section className="space-y-6">
            <div>
              <label className="block text-[13px] font-semibold text-[#0a0a0a] mb-2">App display name</label>
              <input
                type="text"
                defaultValue={TENANT.brandedName}
                className="w-full h-11 px-4 rounded-[12px] bg-[#fffaf0] border border-[#e5e5e5] focus:border-[#0a0a0a] focus:outline-none text-[16px] text-[#0a0a0a]"
              />
              <div className="mt-2 text-[12px] text-[#6a6a6a]">Shown in the top bar, incoming-call notifications, and PWA install banner.</div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#0a0a0a] mb-2">Logo</label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                <div className="w-24 h-24 rounded-[16px] bg-[#1a3a3a] text-white grid place-items-center text-[32px] font-semibold flex-shrink-0">{TENANT.logoLetter}</div>
                <div>
                  <ButtonSecondary className="w-full sm:w-auto">Upload PNG / SVG</ButtonSecondary>
                  <div className="mt-2 text-[12px] text-[#6a6a6a]">Max 512KB · square · transparent background recommended</div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#0a0a0a] mb-2">Primary accent</label>
              <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                {[T.brandTeal, T.brandPink, T.brandLavender, T.brandPeach, T.brandOchre, T.ink].map((c) => (
                  <button key={c} className="w-12 h-12 rounded-[12px] border-2 border-transparent hover:border-[#0a0a0a]" style={{ background: c }} />
                ))}
              </div>
              <div className="mt-2 text-[12px] text-[#6a6a6a]">Shown on CALL button, status pills, and brand chrome.</div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <ButtonPrimary className="w-full sm:w-auto">Save changes</ButtonPrimary>
              <ButtonSecondary className="w-full sm:w-auto">Discard</ButtonSecondary>
            </div>
          </section>

          <section className="rounded-[16px] border border-[#e5e5e5] bg-[#faf5e8] p-5 md:p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-[12px] bg-[#e8b94a] grid place-items-center text-[18px] flex-shrink-0">🔑</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-[14px] font-semibold text-[#0a0a0a]">LAN admin passphrase</div>
                  <Pill tone="warning">LAN only</Pill>
                </div>
                <div className="mt-2 text-[13px] text-[#3a3a3a] leading-[1.55]">
                  On LAN deployments, this section shows a passphrase reset CTA. Argon2id hash on{" "}
                  <code className="bg-[#fffaf0] px-1.5 py-0.5 rounded-[6px] text-[12px]">Tenant.adminPassphraseHash</code>.{" "}
                  Resets are host-side via{" "}
                  <code className="bg-[#fffaf0] px-1.5 py-0.5 rounded-[6px] text-[12px]">./scripts/reset-admin-passphrase.sh</code>.
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Live preview — stacks BELOW form on <lg, sits beside on lg:+ */}
        <aside className="lg:col-span-5">
          <div className="lg:sticky lg:top-24 space-y-4">
            <div className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">Live preview</div>
            <div className="rounded-[16px] border border-[#e5e5e5] overflow-hidden bg-white">
              <div className="h-16 px-4 flex items-center gap-2 bg-[#fffaf0] border-b border-[#e5e5e5]">
                <div className="w-8 h-8 rounded-[8px] bg-[#1a3a3a] text-white grid place-items-center font-semibold text-[14px]">{TENANT.logoLetter}</div>
                <span className="text-[14px] font-semibold text-[#0a0a0a]">{TENANT.brandedName}</span>
              </div>
              <div className="h-48 md:h-56 grid place-items-center bg-[#1a3a3a]">
                <div className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-white grid place-items-center text-[#0a0a0a]">
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
      <BottomNav go={go} currentScreen="branding" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SCREEN 8 — PERSONAL SETTINGS                                         */
/* ------------------------------------------------------------------ */

function ScreenSettings({ go }) {
  return (
    <div className="min-h-screen bg-[#fffaf0] flex flex-col pb-20 md:pb-0">
      <TenantTopBar go={go} currentScreen="settings" />

      <main className="flex-1 max-w-[720px] w-full mx-auto px-4 md:px-12 py-6 md:py-12 space-y-8 md:space-y-12">
        <div>
          <h1 className="text-[32px] md:text-[40px] leading-[1.1] tracking-[-0.015em] font-medium text-[#0a0a0a]">Your settings</h1>
          <p className="mt-1 text-[13px] md:text-[14px] text-[#6a6a6a]">Per-account preferences.</p>
        </div>

        <section className="rounded-[16px] border border-[#e5e5e5] bg-[#fffaf0] p-5 md:p-6 space-y-6">
          <div className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">Profile</div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <div className="w-16 h-16 rounded-full bg-[#b8a4ed] grid place-items-center text-[18px] font-semibold text-[#0a0a0a] flex-shrink-0">MM</div>
            <div className="min-w-0">
              <div className="text-[18px] font-semibold tracking-[-0.01em] text-[#0a0a0a] truncate">{ME.name}</div>
              <div className="text-[13px] text-[#6a6a6a] font-mono truncate">{ME.email}</div>
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
          <ButtonPrimary className="w-full sm:w-auto">Save profile</ButtonPrimary>
        </section>

        <section className="rounded-[16px] border border-[#e5e5e5] bg-[#fffaf0] p-5 md:p-6 space-y-4">
          <div className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">Notifications</div>
          <Toggle label="Incoming-call sound" defaultOn />
          <Toggle label="Browser notifications (Web Push)" defaultOn />
          <Toggle label="Email digest (weekly)" />
        </section>

        <section className="rounded-[16px] border border-[#e5e5e5] bg-[#fffaf0] p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6a6a6a]">Your devices</div>
            <span className="text-[12px] text-[#6a6a6a]">2 active</span>
          </div>
          <ul className="divide-y divide-[#e5e5e5]">
            <li className="py-3 flex items-center gap-4">
              <div className="text-[24px] flex-shrink-0">💻</div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-[#0a0a0a] truncate">Reception PC</div>
                <div className="text-[12px] text-[#6a6a6a] truncate">Chrome 131 · Windows · in use now</div>
              </div>
              <Pill tone="online">Active</Pill>
            </li>
            <li className="py-3 flex items-center gap-4">
              <div className="text-[24px] flex-shrink-0">📱</div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-[#0a0a0a] truncate">iPhone</div>
                <div className="text-[12px] text-[#6a6a6a] truncate">Safari · iOS 17 · last seen 2h ago</div>
              </div>
              <button className="h-11 px-3 text-[12px] font-semibold text-[#b91c1c] hover:underline">Sign out</button>
            </li>
          </ul>
        </section>
      </main>

      <AppFooter />
      <BottomNav go={go} currentScreen="settings" />
    </div>
  );
}

function Toggle({ label, defaultOn = false }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <label className="flex items-center justify-between cursor-pointer min-h-[44px]">
      <span className="text-[14px] text-[#0a0a0a] flex-1 pr-3">{label}</span>
      <button onClick={() => setOn((v) => !v)} type="button" className={`w-12 h-7 rounded-full relative transition flex-shrink-0 ${on ? "bg-[#0a0a0a]" : "bg-[#e5e5e5]"}`}>
        <span className={`absolute top-0.5 ${on ? "left-[22px]" : "left-0.5"} w-6 h-6 rounded-full bg-white transition-all`} />
      </button>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* OVERLAYS — bottom-sheet at <md, centered modal at md:+              */
/* ------------------------------------------------------------------ */

function ModalShell({ children, onClose, maxWidth = "max-w-md" }) {
  return (
    <div className="fixed inset-0 z-[70] bg-[#0a0a0a]/60 backdrop-blur-sm grid place-items-end md:place-items-center p-0 md:p-4" onClick={onClose}>
      <div
        className={`w-full ${maxWidth} max-h-[85vh] overflow-y-auto rounded-t-[24px] md:rounded-[24px] bg-[#fffaf0] border-t md:border border-[#e5e5e5]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle at <md only */}
        <div className="md:hidden w-12 h-1.5 bg-[#e5e5e5] rounded-full mx-auto mt-3" />
        {children}
      </div>
    </div>
  );
}

function OverlayIncomingCall({ onClose, onAccept }) {
  return (
    <ModalShell onClose={onClose}>
      <div className="p-6 md:p-8 text-center">
        <div className="text-[12px] font-semibold tracking-[0.12em] uppercase text-[#6a6a6a]">Incoming call</div>
        <div className="mt-6 w-24 h-24 mx-auto rounded-full bg-[#ffb084] grid place-items-center text-[32px] font-semibold text-[#0a0a0a]">RS</div>
        <div className="mt-4 text-[24px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">{MEMBERS[1].name}</div>
        <div className="text-[13px] text-[#6a6a6a]">{MEMBERS[1].device}</div>
        <div className="mt-8 flex items-center justify-center gap-6">
          <button onClick={onClose} aria-label="Reject" className="w-16 h-16 rounded-full bg-[#ef4444] hover:bg-[#b91c1c] text-white" style={{ fontSize: 24 }}>✕</button>
          <button onClick={onAccept} aria-label="Accept" className="w-16 h-16 rounded-full bg-[#22c55e] hover:bg-[#15803d] text-white" style={{ fontSize: 24 }}>📞</button>
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
      <div className="p-6 md:p-8">
        <h3 className="text-[24px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">What should we call you?</h3>
        <p className="mt-2 text-[13px] text-[#6a6a6a]">This is the name your colleagues see when you appear in the directory.</p>
        <input maxLength={30} defaultValue={ME.name.split(" ")[0]} placeholder="e.g. Maria" className="mt-6 w-full h-11 px-4 rounded-[12px] bg-[#fffaf0] border border-[#e5e5e5] focus:border-[#0a0a0a] focus:outline-none text-[16px] text-[#0a0a0a]" />
        <div className="mt-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3">
          <ButtonSecondary onClick={onClose} className="w-full sm:w-auto">Cancel</ButtonSecondary>
          <ButtonPrimary onClick={onClose} className="w-full sm:w-auto">Save</ButtonPrimary>
        </div>
      </div>
    </ModalShell>
  );
}

function OverlayRoleAssign({ member, onClose }) {
  const promoting = member.role === "member";
  return (
    <ModalShell onClose={onClose}>
      <div className="p-6 md:p-8">
        <h3 className="text-[24px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">
          {promoting ? "Promote to admin?" : "Demote to member?"}
        </h3>
        <p className="mt-2 text-[14px] text-[#3a3a3a]">
          <span className="font-semibold">{member.name}</span>{" "}
          will {promoting ? "gain" : "lose"} access to Members, Branding, and Org Settings.
        </p>
        <div className="mt-6 rounded-[12px] bg-[#f5f0e0] p-4 text-[13px] text-[#3a3a3a] leading-[1.55] break-all">
          <div className="font-semibold text-[#0a0a0a] mb-1">Audit log will record:</div>
          <code className="text-[12px] font-mono text-[#6a6a6a]">
            actor=maria@maesdental.ph · action={promoting ? "member.role.promote" : "member.role.demote"} · target={member.email}
          </code>
        </div>
        <div className="mt-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3">
          <ButtonSecondary onClick={onClose} className="w-full sm:w-auto">Cancel</ButtonSecondary>
          <ButtonPrimary onClick={onClose} className="w-full sm:w-auto">{promoting ? "Promote" : "Demote"}</ButtonPrimary>
        </div>
      </div>
    </ModalShell>
  );
}

function OverlayCallRoleAssign({ member, onClose }) {
  const [next, setNext] = useState(member.callRole);
  return (
    <ModalShell onClose={onClose}>
      <div className="p-6 md:p-8">
        <h3 className="text-[24px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">Set call role</h3>
        <p className="mt-2 text-[14px] text-[#3a3a3a]">
          Choose what <span className="font-semibold">{member.name}</span> is allowed to do. Server rejects forbidden initiations.
        </p>
        <div className="mt-6 space-y-2">
          {[
            { v: "both",     label: "Caller + Receiver", desc: "Can initiate and receive calls (default for admins)" },
            { v: "caller",   label: "Caller",            desc: "Can initiate; receives no incoming-call ring" },
            { v: "receiver", label: "Receiver only",     desc: "Receives calls; CALL hidden in their UI (default)" },
          ].map((opt) => (
            <button
              key={opt.v}
              onClick={() => setNext(opt.v)}
              className={`w-full text-left rounded-[12px] border p-4 min-h-[44px] ${next === opt.v ? "border-[#0a0a0a] bg-[#f5f0e0]" : "border-[#e5e5e5] hover:border-[#0a0a0a]"}`}
            >
              <div className="text-[14px] font-semibold text-[#0a0a0a]">{opt.label}</div>
              <div className="text-[12px] text-[#6a6a6a] mt-1">{opt.desc}</div>
            </button>
          ))}
        </div>
        <div className="mt-6 rounded-[12px] bg-[#f5f0e0] p-4 text-[12px] font-mono text-[#6a6a6a] break-all">
          action=device.role.assign · target={member.email} · from={member.callRole} → to={next}
        </div>
        <div className="mt-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3">
          <ButtonSecondary onClick={onClose} className="w-full sm:w-auto">Cancel</ButtonSecondary>
          <ButtonPrimary onClick={onClose} className="w-full sm:w-auto">Save</ButtonPrimary>
        </div>
      </div>
    </ModalShell>
  );
}

function OverlayPwaBanner({ onClose }) {
  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-1.5rem)] max-w-md rounded-[24px] bg-[#0a0a0a] text-white p-5 md:p-6 flex flex-col sm:flex-row items-start gap-4 border border-white/10">
      <div className="flex items-start gap-4 flex-1">
        <div className="w-12 h-12 rounded-[12px] bg-[#ff4d8b] grid place-items-center text-[18px] flex-shrink-0">📲</div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold">Install {TENANT.brandedName}</div>
          <div className="text-[13px] text-white/70 mt-1 leading-[1.5]">Faster startup, ringing notifications, full-screen calls.</div>
          <div className="text-[12px] text-white/50 mt-2 leading-[1.5]">2nd visit · Dismiss snoozes 30d · iOS Safari fallback walkthrough</div>
        </div>
      </div>
      <div className="flex gap-2 w-full sm:w-auto sm:flex-col flex-shrink-0">
        <button className="flex-1 sm:flex-none h-11 px-4 rounded-[8px] bg-white text-[#0a0a0a] text-[13px] font-semibold">Install</button>
        <button onClick={onClose} className="flex-1 sm:flex-none h-11 px-4 rounded-[8px] text-white/70 hover:text-white text-[12px]">Not now</button>
      </div>
    </div>
  );
}

function OverlayOfflineBanner({ onClose }) {
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-1.5rem)] max-w-md rounded-[16px] bg-[#f59e0b]/95 text-[#0a0a0a] border border-[#f59e0b] px-5 py-3 flex items-center gap-3">
      <span className="w-2.5 h-2.5 rounded-full bg-[#0a0a0a] animate-pulse flex-shrink-0" />
      <div className="flex-1 text-[13px] font-medium">Reconnecting… queued mutations will replay.</div>
      <button onClick={onClose} className="text-[12px] font-semibold underline h-11 px-2 flex-shrink-0">Dismiss</button>
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
      <main className="flex-1 grid place-items-center px-4 md:px-6 py-12 md:py-24">
        <div className="max-w-md w-full rounded-[24px] border border-dashed border-[#e5e5e5] bg-[#faf5e8] p-8 md:p-12 text-center">
          <div className="text-[12px] font-semibold tracking-[0.12em] uppercase text-[#9a9a9a]">{breadcrumb}</div>
          <h2 className="mt-3 text-[28px] md:text-[32px] font-medium tracking-[-0.01em] text-[#0a0a0a]">{title}</h2>
          <p className="mt-3 text-[14px] text-[#6a6a6a] leading-[1.55]">{note}</p>
          <div className="mt-6 inline-block px-3 py-1 rounded-full bg-[#fffaf0] border border-[#e5e5e5] text-[12px] font-semibold uppercase tracking-[0.1em] text-[#6a6a6a]">Tier 2 — placeholder</div>
          <div className="mt-6">
            <ButtonSecondary onClick={() => go("app")} className="w-full sm:w-auto">Back to app</ButtonSecondary>
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
    { label: "T1", items: [
      ["landing","Landing"], ["signup","Signup"], ["login","Login"],
      ["app","App"], ["call","Call"], ["members","Members"],
      ["branding","Branding"], ["settings","Settings"],
    ]},
    { label: "T2", items: [
      ["pricing","Pricing"], ["legalPrivacy","Privacy"], ["legalTerms","Terms"],
      ["forgot","Forgot"], ["reset","Reset"], ["verify","Verify"],
      ["invite","Invite"], ["tenantSuspended","Suspended"],
      ["pwbtRoot","_pwbt"], ["pwbtTenants","_pwbtT"], ["pwbtImport","_pwbtI"],
      ["orgSettings","Org"], ["lanSetup","LANS"], ["lanLogin","LANL"],
    ]},
  ];

  return (
    <div className="font-sans antialiased text-[#0a0a0a] bg-[#fffaf0] min-h-screen" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <MockupBanner />

      <div className="sticky top-[36px] z-[45] w-full bg-[#0a0a0a] text-white text-[12px] overflow-x-auto">
        <div className="max-w-[1280px] mx-auto flex items-center gap-4 px-3 py-2 whitespace-nowrap">
          {JUMPER_GROUPS.map((g) => (
            <div key={g.label} className="flex items-center gap-1">
              <span className="text-white/40 uppercase tracking-[0.08em] text-[12px] font-semibold mr-1">{g.label}</span>
              {g.items.map(([key, lbl]) => (
                <button
                  key={key}
                  onClick={() => go(key)}
                  className={`px-2.5 py-1.5 rounded-[6px] font-medium ${screen === key ? "bg-white text-[#0a0a0a]" : "text-white/80 hover:bg-white/10"}`}
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

      {screen === "pricing"         && <ScreenStub go={go} lanContext breadcrumb="yelli-basic.powerbyte.app / pricing"          title="Pricing"               note="3-tier card grid: Starter (free for LAN OSS) · Cloud Starter · Cloud Growth. Stacks 1-up on mobile." />}
      {screen === "legalPrivacy"    && <ScreenStub go={go} lanContext breadcrumb="yelli-basic.powerbyte.app / legal / privacy"  title="Privacy policy"        note="Long-form privacy doc. Single-column 720px body, mobile-first reading column. PH DPA-aligned + GDPR opt-in." />}
      {screen === "legalTerms"      && <ScreenStub go={go} lanContext breadcrumb="yelli-basic.powerbyte.app / legal / terms"    title="Terms of service"      note="Standard B2B SaaS terms. Same layout as privacy. Sibling page — both under /legal/." />}
      {screen === "forgot"          && <ScreenStub go={go} lanContext breadcrumb="yelli-basic.powerbyte.app / forgot-password"  title="Forgot password"       note="Single-field email input + Turnstile. V25 anti-enumeration: always returns 'check your inbox'." />}
      {screen === "reset"           && <ScreenStub go={go} lanContext breadcrumb="yelli-basic.powerbyte.app / reset-password"   title="Reset password"        note="Token-gated landing. New password + confirm. Token-expiry banner past 1h." />}
      {screen === "verify"          && <ScreenStub go={go} lanContext breadcrumb="yelli-basic.powerbyte.app / verify-email"     title="Verify email"          note="Token-gated success/error page. Redirects to /app on success." />}
      {screen === "invite"          && <ScreenStub go={go} lanContext breadcrumb="yelli-basic.powerbyte.app / invite"           title="Accept invitation"     note="Shows inviting org + role being assigned. CTA: 'Set password & join'." />}
      {screen === "tenantSuspended" && <ScreenStub go={go} lanContext breadcrumb="<slug>.yelli-basic.powerbyte.app / suspended" title="Org is suspended"      note="Shown when Tenant.isSuspended=true. All authenticated routes redirect here. Contact billing CTA + Powerbyte support email." />}
      {screen === "pwbtRoot"        && <ScreenStub go={go} breadcrumb="_pwbt"                                   title="Powerbyte Super-Admin" note="Root landing for /_pwbt/. Quick links to Tenants and Import. Separate tRPC router + dedicated Prisma client (V25). Mobile-first card list, same as Members." />}
      {screen === "pwbtTenants"     && <ScreenStub go={go} breadcrumb="_pwbt / tenants"                         title="Powerbyte: Tenants"    note="Super-Admin tenant list. Mobile-first card list at <md; table at md:+." />}
      {screen === "pwbtImport"      && <ScreenStub go={go} breadcrumb="_pwbt / import"                          title="LAN tenant import"     note="Upload yelli-lan-export-*.tar.gz, pick target slug, preview entities, confirm. Single Prisma transaction; full rollback on failure." />}
      {screen === "orgSettings"     && <ScreenStub go={go} breadcrumb="admin / settings"                        title="Org settings"          note="Tenant-level prefs: timezone, default new-member role, request data export, request tenant deletion (7-day soft delete)." />}
      {screen === "lanSetup"        && <ScreenStub go={go} lanContext breadcrumb="LAN host / setup"             title="LAN first-run wizard"  note="One-time host-side wizard: set Argon2id admin passphrase, upload logo, display name, generate self-signed cert. Step cards stack vertically on mobile." />}
      {screen === "lanLogin"        && <ScreenStub go={go} lanContext breadcrumb="LAN host / admin/login"       title="LAN admin login"       note="Anonymous-mode admin gate. Single passphrase input matched against Argon2id hash on Tenant.adminPassphraseHash. Rate-limited 5/min/IP. Sets yelli_admin_session HttpOnly cookie." />}
    </div>
  );
}
