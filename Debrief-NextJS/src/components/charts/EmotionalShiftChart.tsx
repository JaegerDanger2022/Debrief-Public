"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function EmotionalShiftChart({ data }: { data: { topic: string; intensity: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <XAxis dataKey="topic" tick={{ fontFamily: "monospace", fontSize: 11 }} />
        <YAxis tick={{ fontFamily: "monospace", fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="intensity" fill="#FF3B00" />
      </BarChart>
    </ResponsiveContainer>
  );
}
