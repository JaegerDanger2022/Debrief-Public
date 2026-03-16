"use client";
export default function BargeInIndicator({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-brand-accent text-white px-6 py-3 font-bold text-sm uppercase shadow-brutal animate-bounce">
      {message}
    </div>
  );
}
