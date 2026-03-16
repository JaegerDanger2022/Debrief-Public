"use client";
export default function LiveTranscript({ chunks }: { chunks: string[] }) {
  return (
    <div className="mt-8 max-w-md w-full max-h-32 overflow-y-auto text-left">
      {chunks.map((chunk, i) => (
        <span key={i} className="font-mono text-sm text-brand-muted">
          {chunk}{" "}
        </span>
      ))}
    </div>
  );
}
