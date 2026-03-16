"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function WpmChart({ data }: { data: { date: string; wpm: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <XAxis dataKey="date" tick={{ fontFamily: "monospace", fontSize: 11 }} />
        <YAxis tick={{ fontFamily: "monospace", fontSize: 11 }} />
        <Tooltip />
        <Line type="monotone" dataKey="wpm" stroke="#FF3B00" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
