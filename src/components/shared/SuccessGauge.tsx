
interface Props {
  successRate: number; // 0–1
  label?: string;
  numSimulations?: number;
}

function colorClass(rate: number) {
  if (rate >= 0.9) return "bg-emerald-50 border-emerald-200 text-emerald-700";
  if (rate >= 0.75) return "bg-blue-50 border-blue-200 text-blue-700";
  if (rate >= 0.5) return "bg-amber-50 border-amber-200 text-amber-700";
  return "bg-red-50 border-red-200 text-red-700";
}

function bigColorClass(rate: number) {
  if (rate >= 0.9) return "text-emerald-600";
  if (rate >= 0.75) return "text-blue-600";
  if (rate >= 0.5) return "text-amber-600";
  return "text-red-600";
}

export default function SuccessGauge({ successRate, label, numSimulations = 1000 }: Props) {
  const pct = Math.round(successRate * 100);
  return (
    <div className={`rounded-xl border-2 p-5 ${colorClass(successRate)} text-center`}>
      <div className={`text-5xl font-bold mb-1 ${bigColorClass(successRate)}`}>{pct}%</div>
      <div className="text-sm font-medium opacity-80">Probability of Success</div>
      {label && <div className="text-xs opacity-60 mt-1">{label}</div>}
      <div className="text-xs opacity-50 mt-2">Based on {numSimulations.toLocaleString()} simulations</div>
    </div>
  );
}
