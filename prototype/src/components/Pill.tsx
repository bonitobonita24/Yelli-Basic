import type React from "react";

type PillTone =
  | "neutral" | "online" | "idle" | "offline" | "archived" | "suspended"
  | "admin" | "member" | "caller" | "receiver" | "both" | "warning";

interface PillProps {
  tone?: PillTone;
  children: React.ReactNode;
}

function Pill({ tone = "neutral", children }: PillProps) {
  const map: Record<PillTone, string> = {
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

export default Pill;
