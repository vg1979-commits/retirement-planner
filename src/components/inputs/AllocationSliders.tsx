import type { AssetAllocation } from "../../types";

interface Props {
  label: string;
  value: AssetAllocation;
  onChange: (v: AssetAllocation) => void;
}

function pct(v: number) { return (v * 100).toFixed(0) + "%"; }

export default function AllocationSliders({ label, value, onChange }: Props) {
  function setEquity(eq: number) {
    const remaining = 1 - eq;
    const bondRatio = value.bondPct + value.cashPct > 0
      ? value.bondPct / (value.bondPct + value.cashPct)
      : 0.75;
    const bond = Math.round(remaining * bondRatio * 100) / 100;
    const cash = Math.round((remaining - bond) * 100) / 100;
    onChange({ equityPct: eq, bondPct: bond, cashPct: cash });
  }

  function setBond(bond: number) {
    const cash = Math.max(0, Math.round((1 - value.equityPct - bond) * 100) / 100);
    onChange({ ...value, bondPct: bond, cashPct: cash });
  }

  function setCash(cash: number) {
    const bond = Math.max(0, Math.round((1 - value.equityPct - cash) * 100) / 100);
    onChange({ ...value, bondPct: bond, cashPct: cash });
  }

  const sum = Math.round((value.equityPct + value.bondPct + value.cashPct) * 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-700">{label}</h4>
        <span className={`text-xs font-mono ${sum === 100 ? "text-emerald-600" : "text-red-500"}`}>
          {sum}% total
        </span>
      </div>

      <div className="space-y-3">
        {[
          { key: "equityPct" as const, label: "Equity", color: "bg-blue-500", value: value.equityPct, set: setEquity },
          { key: "bondPct" as const, label: "Bonds", color: "bg-amber-500", value: value.bondPct, set: setBond },
          { key: "cashPct" as const, label: "Cash", color: "bg-slate-400", value: value.cashPct, set: setCash },
        ].map(({ key, label: l, color, value: v, set }) => (
          <div key={key} className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${color}`} />
            <span className="text-sm text-slate-600 w-14">{l}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(v * 100)}
              onChange={(e) => set(parseInt(e.target.value) / 100)}
              className="flex-1 accent-blue-600"
            />
            <span className="text-sm font-mono text-slate-700 w-10 text-right">{pct(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
