import { useState } from "react";

interface Props {
  value: number; // stored as decimal e.g. 0.07
  onChange: (value: number) => void;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
}

export default function PercentInput({ value, onChange, label, min = 0, max = 1, className = "", disabled }: Props) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState("");

  const pct = (value * 100).toFixed(1);
  const display = focused ? raw : `${pct}%`;

  function handleFocus() {
    setRaw((value * 100).toFixed(1));
    setFocused(true);
  }

  function handleBlur() {
    setFocused(false);
    const parsed = parseFloat(raw.replace(/[^0-9.-]/g, ""));
    if (!isNaN(parsed)) onChange(Math.min(max, Math.max(min, parsed / 100)));
  }

  return (
    <div className={className}>
      {label && <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>}
      <input
        type="text"
        inputMode="decimal"
        value={display}
        onChange={(e) => setRaw(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
      />
    </div>
  );
}
