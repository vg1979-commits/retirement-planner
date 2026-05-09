import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import type { Scenario, OneTimeExpense } from "../../types";
import CurrencyInput from "../shared/CurrencyInput";

const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2", "#be185d", "#ca8a04"];

function newId() {
  return `scenario-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

interface Props {
  initial?: Scenario;
  onSave: () => void;
}

export default function ScenarioEditor({ initial, onSave }: Props) {
  const { upsertScenario, household } = useAppStore();

  const [form, setForm] = useState<Scenario>(
    initial ?? {
      id: newId(),
      label: "New Scenario",
      color: COLORS[0],
      retirementAgeOverride: {
        spouse1: household.spouse1.targetRetirementAge,
        spouse2: household.spouse2.targetRetirementAge,
      },
      annualSpendingOverride: undefined,
      additionalOneTimeExpenses: [],
    }
  );

  function setField<K extends keyof Scenario>(key: K, value: Scenario[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addOneTime() {
    setForm((prev) => ({
      ...prev,
      additionalOneTimeExpenses: [
        ...(prev.additionalOneTimeExpenses ?? []),
        { label: "", year: new Date().getFullYear() + 5, amount: 0 },
      ],
    }));
  }

  function updateOneTime(idx: number, patch: Partial<OneTimeExpense>) {
    setForm((prev) => {
      const next = [...(prev.additionalOneTimeExpenses ?? [])];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, additionalOneTimeExpenses: next };
    });
  }

  function removeOneTime(idx: number) {
    setForm((prev) => ({
      ...prev,
      additionalOneTimeExpenses: (prev.additionalOneTimeExpenses ?? []).filter((_, i) => i !== idx),
    }));
  }

  function handleSave() {
    if (!form.label.trim()) return;
    upsertScenario(form);
    onSave();
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Scenario Name</label>
        <input
          className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={form.label}
          onChange={(e) => setField("label", e.target.value)}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-2">Color</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setField("color", c)}
              className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? "border-slate-700 scale-110" : "border-transparent"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Retirement Ages</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Spouse 1</label>
            <input
              type="number"
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.retirementAgeOverride?.spouse1 ?? household.spouse1.targetRetirementAge}
              onChange={(e) => setField("retirementAgeOverride", { ...form.retirementAgeOverride, spouse1: parseInt(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Spouse 2</label>
            <input
              type="number"
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.retirementAgeOverride?.spouse2 ?? household.spouse2.targetRetirementAge}
              onChange={(e) => setField("retirementAgeOverride", { ...form.retirementAgeOverride, spouse2: parseInt(e.target.value) })}
            />
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Spending Override (optional)</div>
        <CurrencyInput
          value={form.annualSpendingOverride ?? 0}
          onChange={(v) => setField("annualSpendingOverride", v === 0 ? undefined : v)}
          placeholder="Leave blank to use default"
        />
        {form.annualSpendingOverride === undefined && (
          <p className="text-xs text-slate-400 mt-1">Using default retirement spending from inputs.</p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">One-Time Expenses</div>
          <button onClick={addOneTime} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
            <Plus size={12} /> Add
          </button>
        </div>

        <div className="space-y-2">
          {(form.additionalOneTimeExpenses ?? []).map((exp, idx) => (
            <div key={idx} className="flex gap-2 items-end">
              <div className="flex-1">
                <input
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Label"
                  value={exp.label}
                  onChange={(e) => updateOneTime(idx, { label: e.target.value })}
                />
              </div>
              <div className="w-20">
                <input
                  type="number"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Year"
                  value={exp.year}
                  onChange={(e) => updateOneTime(idx, { year: parseInt(e.target.value) })}
                />
              </div>
              <div className="w-24">
                <CurrencyInput value={exp.amount} onChange={(v) => updateOneTime(idx, { amount: v })} />
              </div>
              <button onClick={() => removeOneTime(idx)} className="text-slate-400 hover:text-red-600 pb-1.5"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={!form.label.trim()}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-md transition-colors"
      >
        {initial ? "Save Changes" : "Create Scenario"}
      </button>
    </div>
  );
}
