import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { AnnualProjection } from "../../types";

interface Props {
  projections: AnnualProjection[];
}

const fmtM = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

const fmtFull = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function TaxBarChart({ projections }: Props) {
  if (projections.length === 0) {
    return <div className="flex items-center justify-center h-full text-slate-400 text-sm">Run a simulation to see tax data.</div>;
  }

  const data = projections.map((p) => ({
    year: p.year,
    federalTax: Math.round(p.federalTax),
    effectiveRate: Math.round(p.effectiveTaxRate * 1000) / 10,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 40, bottom: 0, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} />
        <YAxis yAxisId="left" tickFormatter={fmtM} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={60} />
        <YAxis yAxisId="right" orientation="right" unit="%" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} domain={[0, 40]} width={40} />
        <Tooltip
          formatter={(value: number, name: string) => {
            if (name === "Federal Tax") return [fmtFull.format(value), name];
            return [`${value}%`, name];
          }}
          contentStyle={{ fontSize: 12 }}
        />
        <Legend />
        <Bar yAxisId="left" dataKey="federalTax" name="Federal Tax" fill="#3b82f6" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="effectiveRate" name="Effective Rate" stroke="#f59e0b" strokeWidth={2} dot={false} unit="%" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
