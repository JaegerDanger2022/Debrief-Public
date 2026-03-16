"use client";
import { useEffect, useState } from "react";
import { ledgerApi } from "@/lib/api/ledger";
import type { LedgerItem, LedgerStatus } from "@/types/ledger";

const STATUS_CONFIG: Record<LedgerStatus, { label: string; bg: string; text: string }> = {
  pending:  { label: "Pending",  bg: "bg-[#FF9F0A]/[0.10]", text: "text-[#C77700]" },
  enriched: { label: "Enriched", bg: "bg-[#007AFF]/[0.08]",  text: "text-[#007AFF]" },
  resolved: { label: "Resolved", bg: "bg-[#34C759]/[0.10]",  text: "text-[#1A7F37]" },
};

export default function LedgerPage() {
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    ledgerApi
      .list()
      .then((r) => setItems(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  async function handleResolve(item: LedgerItem) {
    setResolving(item.id);
    try {
      const updated = await ledgerApi.resolve(
        item.id,
        item.platform === "desktop" && !!item.tab_id,
      );
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated.data : i)));
    } finally {
      setResolving(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1
        className="text-[28px] font-semibold text-[#1D1D1F] mb-1"
        style={{ letterSpacing: "-0.02em" }}
      >
        Ledger
      </h1>
      <p className="text-[14px] text-[#6E6E73] mb-8 leading-relaxed">
        Captured highlights and browser context from Chrome Extension and Mobile Share Sheet.
      </p>

      {loading && <p className="text-[13px] text-[#6E6E73] animate-pulse">Loading…</p>}
      {error && <p className="text-[13px] text-[#FF3B30]">Failed to load ledger.</p>}

      {!loading && !error && items.length === 0 && (
        <p className="text-[14px] text-[#6E6E73] leading-relaxed">
          No captures yet. Use the Chrome Extension (Ctrl+Shift+U) or the mobile Share Sheet to capture a highlight.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const status = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[14px] font-semibold text-[#1D1D1F] truncate"
                    style={{ letterSpacing: "-0.01em" }}
                    title={item.url}
                  >
                    {item.page_title ?? item.url}
                  </p>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] text-[#6E6E73] hover:text-[#007AFF] truncate block transition-colors"
                  >
                    {item.url}
                  </a>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-medium text-[#6E6E73] px-2 py-0.5 bg-black/[0.04] rounded-full">
                    {item.platform}
                  </span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                    {status.label}
                  </span>
                </div>
              </div>

              {/* Selection */}
              {item.selection_text && (
                <blockquote className="border-l-2 border-[#007AFF]/40 pl-3 mb-3 text-[13px] text-[#3A3A3C] leading-relaxed italic line-clamp-3">
                  {item.selection_text}
                </blockquote>
              )}

              {/* Intent */}
              {item.intent_description && (
                <p className="text-[13px] text-[#1D1D1F] leading-relaxed mb-3">
                  <span className="text-[11px] font-semibold text-[#6E6E73] uppercase mr-1.5" style={{ letterSpacing: "0.05em" }}>
                    Intent
                  </span>
                  {item.intent_description}
                </p>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between mt-1">
                <p className="text-[11px] text-[#6E6E73]">
                  {new Date(item.created_at).toLocaleString()}
                </p>
                {item.status !== "resolved" && (
                  <button
                    onClick={() => handleResolve(item)}
                    disabled={resolving === item.id}
                    className="text-[12px] font-semibold text-[#007AFF] px-3 py-1.5 bg-[#007AFF]/[0.07] rounded-xl hover:bg-[#007AFF]/[0.12] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {resolving === item.id ? "Resolving…" : "Mark Resolved"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
