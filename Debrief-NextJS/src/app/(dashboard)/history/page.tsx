"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { sessionsApi } from "@/lib/api/sessions";
import type { Session } from "@/types/session";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    sessionsApi.list()
      .then((r) => setSessions(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1
        className="text-[28px] font-semibold text-[#1D1D1F] mb-1"
        style={{ letterSpacing: "-0.02em" }}
      >
        History
      </h1>
      <p className="text-[14px] text-[#6E6E73] mb-8 leading-relaxed">
        All past capture sessions.
      </p>

      {loading && (
        <p className="text-[13px] text-[#6E6E73] animate-pulse">Loading…</p>
      )}
      {error && (
        <p className="text-[13px] text-[#FF3B30]">Failed to load sessions.</p>
      )}
      {!loading && !error && sessions.length === 0 && (
        <p className="text-[14px] text-[#6E6E73]">No sessions yet.</p>
      )}

      <div className="flex flex-col gap-2">
        {sessions.map((s) => (
          <Link
            key={s.id}
            href={`/history/${s.id}`}
            className="group flex items-center justify-between p-4 bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all duration-200"
          >
            <div>
              <p
                className="text-[14px] font-semibold text-[#1D1D1F] mb-0.5"
                style={{ letterSpacing: "-0.01em" }}
              >
                {s.tag ?? "Untagged"}
              </p>
              <p className="text-[12px] text-[#6E6E73]">{formatDate(s.started_at)}</p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
                  s.status === "complete"
                    ? "bg-[#34C759]/[0.12] text-[#1A7F37]"
                    : "bg-black/[0.05] text-[#6E6E73]"
                }`}
                style={{ letterSpacing: "0.02em" }}
              >
                {s.status}
              </span>
              <span className="text-[#6E6E73] group-hover:text-[#1D1D1F] transition-colors text-[16px] leading-none">›</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
