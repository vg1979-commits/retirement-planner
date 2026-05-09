import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import type { IncomeStream, IncomeType } from "../../types";
import SlideOver from "../shared/SlideOver";
import CurrencyInput from "../shared/CurrencyInput";
import PercentInput from "../shared/PercentInput";

const TYPE_LABELS: Record<IncomeType, string> = {
  w2_salary: "W2 Salary",
  rsu: "RSU",
  bonus: "Bonus",
  rental: "Rental",
  other: "Other",
};

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function newId() {
  return `inc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function IncomeForm({ initial, onSave }: { initial?: IncomeStream; onSave: () => void }) {
  const { upsertIncomeStream } = useAppStore();
  const [form, setForm] = useState<IncomeStream>(
    initial ?? {
      id: newId(),
      owner: "spouse1",
      type: "w2_salary",
      label: "",
      annualAmount: 0,
      startYear: new Date().getFullYear(),
      endYear: new Date().getFullYear() + 10,
      growthRate: 0.03,
      taxTreatment: "ordinary_income",
    }
  );

  function set<K extends keyof IncomeStream>(key: K, value: IncomeStream[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (!form.label.trim()) return;
    upsertIncomeStream(form);
    onSave();
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Label</label>
        <input
          className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={form.label}
          onChange={(e) => set("label", e.target.value)}
          placeholder="e.g. Spouse 1 W2 Salary"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Owner</label>
          <select
            className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.owner}
            onChange={(e) => set("owner", e.target.value as IncomeStream["owner"])}
          >
            <option value="spouse1">Spouse 1</option>
            <option value="spouse2">Spouse 2</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
          <select
            className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.type}
            onChange={(e) => set("type", e.target.value as IncomeType)}
          >
            {(Object.keys(TYPE_LABELS) as IncomeType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>

      <CurrencyInput label="Annual Amount" value={form.annualAmount} onChange={(v) => set("annualAmount", v)} />
      <PercentInput label="Annual Growth Rate" value={form.growthRate} onChange={(v) => set("growthRate", v)} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Start Year</label>
          <input
            type="number"
            className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.startYear}
            onChange={(e) => set("startYear", parseInt(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">End Year</label>
          <input
            type="number"
            className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.endYear}
            onChange={(e) => set("endYear", parseInt(e.target.value))}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Tax Treatment</label>
        <select
          className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={form.taxTreatment}
          onChange={(e) => set("taxTreatment", e.target.value as IncomeStream["taxTreatment"])}
        >
          <option value="ordinary_income">Ordinary Income</option>
          <option value="ltcg">Long-Term Capital Gains</option>
          <option value="tax_free">Tax-Free</option>
        </select>
      </div>

      <button
        onClick={handleSave}
        disabled={!form.label.trim()}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-md transition-colors"
      >
        {initial ? "Save Changes" : "Add Income Stream"}
      </button>
    </div>
  );
}

export default function IncomeTable() {
  const { incomeStreams, removeIncomeStream } = useAppStore();
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<IncomeStream | undefined>(undefined);

  function openNew() { setEditing(undefined); setSlideOpen(true); }
  function openEdit(s: IncomeStream) { setEditing(s); setSlideOpen(true); }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Income Streams</h3>
        <button
          onClick={openNew}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
        >
          <Plus size={13} /> Add Income
        </button>
      </div>

      {incomeStreams.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg">
          No income streams. Add your salaries, bonuses, or RSUs.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Label</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Owner</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Type</th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">Annual Amount</th>
                <th className="text-center px-3 py-2 font-medium text-slate-600">Years</th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">Growth</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {incomeStreams.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">{s.label}</td>
                  <td className="px-3 py-2 text-slate-500 capitalize">{s.owner.replace("spouse", "Spouse ")}</td>
                  <td className="px-3 py-2 text-slate-500">{TYPE_LABELS[s.type]}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-800">{fmt.format(s.annualAmount)}</td>
                  <td className="px-3 py-2 text-center text-slate-600">{s.startYear}–{s.endYear}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{(s.growthRate * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button onClick={() => openEdit(s)} className="text-slate-400 hover:text-blue-600 transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => removeIncomeStream(s.id)} className="text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SlideOver open={slideOpen} onClose={() => setSlideOpen(false)} title={editing ? "Edit Income Stream" : "Add Income Stream"}>
        <IncomeForm initial={editing} onSave={() => setSlideOpen(false)} />
      </SlideOver>
    </div>
  );
}
