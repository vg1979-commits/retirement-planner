import React, { useState } from "react";

interface Props {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function CurrencyInput({ value, onChange, label, placeholder, className = "", disabled }: Props) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState("");

  const display = focused ? raw : fmt.format(value);

  function handleFocus() {
    setRaw(value === 0 ? "" : String(value));
    setFocused(true);
  }

  function handleBlur() {
    setFocused(false);
    const parsed = parseInt(raw.replace(/[^0-9-]/g, ""), 10);
    if (!isNaN(parsed)) onChange(parsed);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRaw(e.target.value);
  }

  return (
    <div className={className}>
      {label && <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>}
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder ?? "$0"}
        disabled={disabled}
        className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
      />
    </div>
  );
}
