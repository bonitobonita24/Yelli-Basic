"use client";

import { useState } from "react";
import { TENANT, ME } from "@/lib/dummy-tenant";

interface TenantTopBarProps {
  go: (screen: string) => void;
  currentScreen: string;
}

function TenantTopBar({ go, currentScreen }: TenantTopBarProps) {
  const [open, setOpen] = useState(false);
  const linkBase = "text-[14px] font-medium px-3 py-1.5 rounded-[8px]";
  const linkActive = "bg-[#f5f0e0] text-[#0a0a0a]";
  const linkIdle = "text-[#3a3a3a] hover:text-[#0a0a0a]";
  const items: Array<[string, string]> = [
    ["app", "Directory"], ["members", "Members"], ["branding", "Branding"], ["orgSettings", "Org Settings"],
  ];
  return (
    <>
      <header className="w-full h-16 px-4 md:px-6 flex items-center justify-between bg-[#fffaf0] border-b border-[#e5e5e5]">
        <button onClick={() => go("app")} className="flex items-center gap-2 h-11 -ml-2 px-2 min-w-0">
          <div className="w-9 h-9 rounded-[8px] bg-[#1a3a3a] text-white grid place-items-center font-semibold flex-shrink-0">{TENANT.logoLetter}</div>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-[14px] font-semibold text-[#0a0a0a] truncate">{TENANT.brandedName}</span>
            <span className="text-[12px] text-[#6a6a6a] truncate">{TENANT.slug}.yelli.app</span>
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

export default TenantTopBar;
