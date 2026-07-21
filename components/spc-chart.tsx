"use client";

import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SpcChart } from "@/lib/analytics";

export function SpcChartView({ chart }: { chart: SpcChart }) {
  const data = chart.points.map((p, i) => ({ ...p, idx: i + 1 }));
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="eyebrow">Control chart · {chart.label}</span>
        <span className="readout text-xs text-muted">
          x̄ {chart.mean} · UCL {chart.ucl} · LCL {chart.lcl} · spec ≥ {chart.specMin}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={230}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
          <XAxis dataKey="idx" tick={{ fontSize: 11, fill: "#5B6B62" }} tickLine={false} axisLine={{ stroke: "#E7E5DE" }} />
          <YAxis
            domain={[Math.min(chart.lcl, chart.specMin) * 0.9, chart.ucl * 1.05]}
            tick={{ fontSize: 11, fill: "#5B6B62" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #E7E5DE", fontSize: 12 }}
            labelFormatter={(_, pl) => (pl?.[0]?.payload?.batchId ?? "") as string}
            formatter={(v: number) => [`${v} ${chart.unit}`, chart.label]}
          />
          <ReferenceLine y={chart.ucl} stroke="#E11D48" strokeDasharray="4 4" strokeOpacity={0.6} />
          <ReferenceLine y={chart.lcl} stroke="#E11D48" strokeDasharray="4 4" strokeOpacity={0.6} />
          <ReferenceLine y={chart.mean} stroke="#0F766E" strokeOpacity={0.5} />
          <ReferenceLine y={chart.specMin} stroke="#B45309" strokeDasharray="2 3" />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#0F766E"
            strokeWidth={2}
            dot={{ r: 3, fill: "#0F766E" }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-muted">
        Garis emas = batas spec ({chart.specMin} {chart.unit}). Perhatikan LCL bisa berada di bawah
        spec — batch “terkendali” belum tentu memenuhi spec, itulah gunanya gerbang mutu.
      </p>
    </div>
  );
}
