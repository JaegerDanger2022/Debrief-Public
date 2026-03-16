"use client";
import { use, useEffect, useState } from "react";
import { insightsApi } from "@/lib/api/insights";
import type { InsightSummary } from "@/types/session";
import WpmChart from "@/components/charts/WpmChart";
import PitchStabilityChart from "@/components/charts/PitchStabilityChart";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
      <h2
        className="text-[11px] font-semibold text-[#6E6E73] uppercase mb-4"
        style={{ letterSpacing: "0.06em" }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

export default function SessionDetailPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const [data, setData] = useState<InsightSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    insightsApi.getBySession(sessionId)
      .then((r) => setData(r.data))
      .catch(() => setIsError(true))
      .finally(() => setIsLoading(false));
  }, [sessionId]);

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1
        className="text-[28px] font-semibold text-[#1D1D1F] mb-1"
        style={{ letterSpacing: "-0.02em" }}
      >
        Session Detail
      </h1>
      <p className="text-[12px] text-[#6E6E73] font-mono mb-8">{sessionId}</p>

      {isLoading && <p className="text-[13px] text-[#6E6E73] animate-pulse">Loading insights…</p>}
      {isError && (
        <p className="text-[13px] text-[#FF3B30]">No insight available for this session.</p>
      )}

      {data && (
        <div className="space-y-4">
          {/* State shift summary */}
          <Card title="State Shift">
            <p className="text-[14px] text-[#1D1D1F] leading-relaxed">
              {data.payload.state_shift_summary}
            </p>
          </Card>

          {/* Core breakthrough badge */}
          {data.core_breakthrough && (
            <div className="flex items-center gap-3 px-5 py-4 bg-[#007AFF] rounded-2xl shadow-[0_4px_16px_rgba(0,122,255,0.28)]">
              <span className="text-[18px]">⚡</span>
              <span
                className="text-[14px] font-semibold text-white"
                style={{ letterSpacing: "-0.01em" }}
              >
                Core Breakthrough Detected
              </span>
            </div>
          )}

          {/* Action items */}
          {data.payload.action_items.length > 0 && (
            <Card title="Action Items">
              <ul className="space-y-2">
                {data.payload.action_items.map((item, i) => (
                  <li key={i} className="flex gap-3 text-[14px] text-[#1D1D1F] leading-relaxed">
                    <span className="text-[#6E6E73] font-mono text-[12px] mt-0.5 w-4 shrink-0">
                      {i + 1}.
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Identified triggers */}
          {data.payload.identified_triggers.length > 0 && (
            <Card title="Identified Triggers">
              <div className="flex flex-wrap gap-2">
                {data.payload.identified_triggers.map((t, i) => (
                  <span
                    key={i}
                    className="text-[12px] font-medium text-[#1D1D1F] px-3 py-1.5 bg-[#F5F5F7] rounded-full"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* Acoustic telemetry */}
          {data.payload.acoustic_telemetry.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card title="Speaking Pace (WPM)">
                <WpmChart
                  data={data.payload.acoustic_telemetry.map((pt) => ({
                    date: `${pt.timestamp}ms`,
                    wpm: pt.wpm,
                  }))}
                />
              </Card>
              <Card title="Pitch Stability">
                <PitchStabilityChart
                  data={data.payload.acoustic_telemetry
                    .filter((pt) => pt.pitch_hz > 0)
                    .map((pt) => ({
                      date: `${pt.timestamp}ms`,
                      stability: pt.pitch_hz,
                    }))}
                />
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
