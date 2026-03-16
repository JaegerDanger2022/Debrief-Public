interface BreakthroughEvent {
  date: string;
  description: string;
  metric: string;
}

export default function BreakthroughTimeline({ events }: { events: BreakthroughEvent[] }) {
  if (events.length === 0) return <p className="text-brand-muted font-mono text-sm">No breakthroughs recorded yet.</p>;

  return (
    <div className="flex flex-col gap-4">
      {events.map((e, i) => (
        <div key={i} className="flex gap-4 items-start border-l-2 border-brand-accent pl-4">
          <span className="font-mono text-xs text-brand-muted w-24 shrink-0">{e.date}</span>
          <div>
            <p className="font-bold text-sm">{e.description}</p>
            <p className="text-xs text-brand-muted font-mono">{e.metric}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
