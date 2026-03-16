"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { sessionsApi } from "@/lib/api/sessions";
import SessionTagSelector from "@/components/session/SessionTagSelector";
import type { SessionTag } from "@/types/session";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [tag, setTag] = useState<SessionTag | null>(null);

  async function handleStart() {
    setLoading(true);
    try {
      const res = await sessionsApi.create({ tag });
      router.push(`/session?id=${res.data.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      {/* Page heading */}
      <h1
        className="text-[28px] font-semibold text-[#1D1D1F] mb-1"
        style={{ letterSpacing: "-0.02em" }}
      >
        Start a Session
      </h1>
      <p className="text-[14px] text-[#6E6E73] mb-8 leading-relaxed">
        Choose a context tag, then speak. Nova will listen and capture your intent.
      </p>

      {/* Tag selector */}
      <SessionTagSelector selected={tag} onSelect={setTag} />

      {/* CTA */}
      <button
        onClick={handleStart}
        disabled={loading}
        className="mt-8 w-full py-5 bg-[#1D1D1F] text-white text-[16px] font-semibold rounded-2xl transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
        style={{ letterSpacing: "-0.01em" }}
      >
        {loading ? "Starting…" : "Start Processing"}
      </button>
    </div>
  );
}
