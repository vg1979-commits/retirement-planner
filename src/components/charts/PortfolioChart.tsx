import React from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { SimulationResult, AnnualProjection } from "../../types";

interface Props {
  results: SimulationResult[];
  projections: AnnualProjection[]; // median path (from base or first active scenario)
  scenarios: { id: string; label: string; color: string }[];
  displayMode: "nominal" | "real";
  inflationRate: number;
}

const fmtM = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

const fmtFull = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function PortfolioChart({ results, projections, scenarios, displayMode, inflationRate }: Props) {
  if (results.length === 0 || projections.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        Run a simulation to see results.
      </div>
    );
  }

  // Build per-year data from the first result's years, merging all scenarios
  const years = projections.map((p) => p.year);

  const deflate = (val: number, yearIndex: number): number => {
    if (displayMode === "nominal") return val;
    return val / Math.pow(1 + inflationRate, yearIndex);
  };

  const data = years.map((year, yi) => {
    const proj = projections[yi];
    const row: Record<string, number | string> = {
      year,
      age: proj.age_spouse1,
    };

    for (const result of results) {
      const p = result.percentiles;
      if (!p.p25[yi] && !p.p50[yi]) continue;
      const prefix = result.scenarioId;
      row[`${prefix}_p25`] = deflate(Math.max(0, p.p25[yi] ?? 0), yi);
      row[`${prefix}_p50`] = deflate(Math.max(0, p.p50[yi] ?? 0), yi);
      row[`${prefix}_p75`] = deflate(Math.max(0, p.p75[yi] ?? 0), yi);
      // recharts Area needs [bottom, top] — encode as p25 for floor, p75-p25 for height
      row[`${prefix}_band`] = deflate(Math.max(0, (p.p75[yi] ?? 0) - (p.p25[yi] ?? 0)), yi);
    }

    return row;
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="year"
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmtM}
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          width={60}
        />
        <Tooltip
          formatter={(value: number, name: string) => {
            if (name.endsWith("_band") || name.endsWith("_p25")) return null;
            return [fmtFull.format(value), name.includes("_p50") ? "Median" : name];
          }}
          labelFormatter={(label) => {
            const row = data.find((d) => d.year === label);
            return `${label} · Age ${row?.age ?? ""}`;
          }}
          contentStyle={{ fontSize: 12 }}
        />
        <Legend
          formatter={(value: string) => {
            const sc = scenarios.find((s) => value.startsWith(s.id));
            return sc ? sc.label : value;
          }}
        />

        {results.map((result) => {
          const sc = scenarios.find((s) => s.id === result.scenarioId);
          const color = sc?.color ?? "#2563eb";
          const prefix = result.scenarioId;
          return (
            <React.Fragment key={prefix}>
              {/* P25–P75 band */}
              <Area
                type="monotone"
                dataKey={`${prefix}_p25`}
                stackId={prefix}
                fill="transparent"
                stroke="none"
                legendType="none"
                tooltipType="none"
                dot={false}
                activeDot={false}
              />
              <Area
                type="monotone"
                dataKey={`${prefix}_band`}
                stackId={prefix}
                fill={color}
                fillOpacity={0.15}
                stroke="none"
                name={`${prefix}_band`}
                legendType="none"
                tooltipType="none"
                dot={false}
                activeDot={false}
              />
              {/* Median line */}
              <Line
                type="monotone"
                dataKey={`${prefix}_p50`}
                stroke={color}
                strokeWidth={2}
                dot={false}
                name={`${prefix}_p50`}
              />
            </React.Fragment>
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
