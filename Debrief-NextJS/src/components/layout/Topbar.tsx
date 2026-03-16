export default function Topbar() {
  return (
    <header
      className="sticky top-0 z-50 h-12 flex items-center justify-between px-6 backdrop-blur-md border-b border-white/40"
      style={{ background: "rgba(241, 246, 252, 0.52)" }}
    >
      <span
        className="text-[12px] font-medium text-[#6E6E73] uppercase"
        style={{ letterSpacing: "0.06em" }}
      >
        Dashboard
      </span>
      <div className="flex items-center gap-3">
        <span
          className="text-[11px] font-semibold text-[#007AFF] px-2.5 py-1 bg-[#007AFF]/[0.08] rounded-full"
          style={{ letterSpacing: "0.01em" }}
        >
          Pro
        </span>
        <div className="w-7 h-7 bg-[#1D1D1F] rounded-full flex items-center justify-center">
          <span className="text-white text-[11px] font-semibold">D</span>
        </div>
      </div>
    </header>
  );
}
