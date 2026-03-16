"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/home",     label: "Home",       icon: "⌂" },
  { href: "/vibe",     label: "Vocal Vibe", icon: "◎" },
  { href: "/history",  label: "History",    icon: "≡" },
  { href: "/ledger",   label: "Ledger",     icon: "◱" },
  { href: "/settings", label: "Settings",   icon: "⚙" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside
      className="w-56 flex flex-col border-r border-white/40"
      style={{
        minHeight: "100vh",
        backgroundImage: "var(--gradient-sidebar-surface)",
        backgroundColor: "rgba(215, 228, 244, 0.9)",
        backdropFilter: "blur(18px)",
      }}
    >
      {/* Brand */}
      <div className="px-5 pt-7 pb-6">
        <img src="/logo.svg" alt="Debrief" width={32} height={32} />
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-2 flex-1">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13.5px] font-medium transition-all duration-150 ${
                active
                  ? "text-[#1D1D1F] shadow-[0_6px_18px_rgba(107,130,164,0.12)]"
                  : "text-[#3A3A3C] hover:bg-white/[0.34] hover:text-[#1D1D1F]"
              }`}
              style={{
                background: active ? "rgba(255,255,255,0.34)" : "transparent",
                border: active ? "1px solid rgba(255,255,255,0.42)" : "1px solid transparent",
                backdropFilter: active ? "blur(10px)" : undefined,
              }}
            >
              <span className="text-[15px] opacity-60 w-4 text-center leading-none">{icon}</span>
              <span style={{ letterSpacing: "-0.01em" }}>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer hint */}
      <div className="px-5 pb-6">
        <p className="text-[11px] text-[#6E6E73] leading-relaxed" style={{ letterSpacing: "0.01em" }}>
          Debrief &copy; 2025
        </p>
      </div>
    </aside>
  );
}
