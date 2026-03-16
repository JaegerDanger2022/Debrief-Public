"use client";
const TAGS = ["Therapy", "Coaching", "Solo Vent"] as const;
type SessionTag = typeof TAGS[number];

interface SessionTagSelectorProps {
  selected: SessionTag | null;
  onSelect: (tag: SessionTag | null) => void;
}

export default function SessionTagSelector({ selected, onSelect }: SessionTagSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {TAGS.map((tag) => {
        const active = selected === tag;
        return (
          <button
            key={tag}
            onClick={() => onSelect(active ? null : tag)}
            className={`px-4 py-2 text-[13px] font-semibold rounded-full transition-all duration-150 ${
              active
                ? "bg-brand-black text-white shadow-[0_2px_8px_rgba(0,0,0,0.16)]"
                : "bg-white text-[#3A3A3C] shadow-[0_2px_8px_rgba(0,0,0,0.05)] hover:bg-black/5"
            }`}
            style={{ letterSpacing: "-0.01em" }}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
