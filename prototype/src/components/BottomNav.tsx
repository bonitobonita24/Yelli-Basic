interface BottomNavProps {
  go: (screen: string) => void;
  currentScreen: string;
}

function BottomNav({ go, currentScreen }: BottomNavProps) {
  const items: Array<[string, string, string]> = [
    ["app",            "Directory", "👥"],
    ["admin-members",  "Members",   "🧑‍💼"],
    ["branding",       "Branding",  "🎨"],
    ["settings",       "You",       "⚙️"],
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

export default BottomNav;
