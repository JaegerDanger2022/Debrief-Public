"use client";
import { useEffect, useState } from "react";
import { sessionsApi } from "@/lib/api/sessions";
import { insightsApi } from "@/lib/api/insights";
import type { Session, InsightSummary } from "@/types/session";
import WpmChart from "@/components/charts/WpmChart";
import PitchStabilityChart from "@/components/charts/PitchStabilityChart";
import BreakthroughTimeline from "@/components/charts/BreakthroughTimeline";

interface SessionInsight {
  session: Session;
  insight: InsightSummary;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
      <h3
        className="text-[11px] font-semibold text-[#6E6E73] uppercase mb-4"
        style={{ letterSpacing: "0.06em" }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function VibePage() {
  const [data, setData] = useState<SessionInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { data: sessions } = await sessionsApi.list();
        const complete = sessions.filter((s) => s.status === "complete");
        const settled = await Promise.allSettled(
          complete.map((s) =>
            insightsApi.getBySession(s.id).then((r) => ({ session: s, insight: r.data }))
          )
        );
        setData(
          settled
            .filter((r): r is PromiseFulfilledResult<SessionInsight> => r.status === "fulfilled")
            .map((r) => r.value)
        );
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const sorted = [...data].sort(
    (a, b) => new Date(a.session.started_at).getTime() - new Date(b.session.started_at).getTime()
  );

  const wpmData = sorted.flatMap((si) =>
    si.insight.payload.acoustic_telemetry.map((pt) => ({
      date: new Date(si.session.started_at).toLocaleDateString(),
      wpm: pt.wpm,
    }))
  );

  const pitchData = sorted.flatMap((si) =>
    si.insight.payload.acoustic_telemetry
      .filter((pt) => pt.pitch_hz > 0)
      .map((pt) => ({
        date: new Date(si.session.started_at).toLocaleDateString(),
        stability: pt.pitch_hz,
      }))
  );

  const breakthroughEvents = sorted
    .filter((si) => si.insight.core_breakthrough)
    .map((si) => ({
      date: new Date(si.session.started_at).toLocaleDateString(),
      description: si.insight.payload.state_shift_summary,
      metric: si.insight.payload.identified_triggers.join(", ") || "-",
    }));

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1
        className="text-[28px] font-semibold text-[#1D1D1F] mb-1"
        style={{ letterSpacing: "-0.02em" }}
      >
        Vocal Vibe
      </h1>
      <p className="text-[14px] text-[#6E6E73] mb-8 leading-relaxed">
        Acoustic telemetry and breakthrough patterns across all sessions.
      </p>

      {loading && <p className="text-[13px] text-[#6E6E73] animate-pulse">Loading...</p>}
      {error && <p className="text-[13px] text-[#FF3B30]">Failed to load session data.</p>}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartCard title="Speaking Pace (WPM)">
            {wpmData.length > 0
              ? <WpmChart data={wpmData} />
              : <p className="text-[13px] text-[#6E6E73]">No data yet.</p>}
          </ChartCard>
          <ChartCard title="Pitch Stability">
            {pitchData.length > 0
              ? <PitchStabilityChart data={pitchData} />
              : <p className="text-[13px] text-[#6E6E73]">No data yet.</p>}
          </ChartCard>
          <div className="col-span-full">
            <ChartCard title="Breakthrough Timeline">
              <BreakthroughTimeline events={breakthroughEvents} />
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  );
}
