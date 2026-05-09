
interface Props {
  value: "nominal" | "real";
  onChange: (v: "nominal" | "real") => void;
}

export default function NominalRealToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-md border border-slate-300 overflow-hidden text-sm">
      {(["nominal", "real"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-3 py-1 font-medium transition-colors ${
            value === v ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {v === "nominal" ? "Nominal $" : "Real $"}
        </button>
      ))}
    </div>
  );
}
