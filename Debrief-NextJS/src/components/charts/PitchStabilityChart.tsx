"use client";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function PitchStabilityChart({ data }: { data: { date: string; stability: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data}>
        <XAxis dataKey="date" tick={{ fontFamily: "monospace", fontSize: 11 }} />
        <YAxis tick={{ fontFamily: "monospace", fontSize: 11 }} />
        <Tooltip />
        <Area type="monotone" dataKey="stability" stroke="#0A0A0A" fill="#0A0A0A" fillOpacity={0.1} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
