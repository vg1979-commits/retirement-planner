import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import AccountTable from "../components/inputs/AccountTable";
import IncomeTable from "../components/inputs/IncomeTable";
import AllocationSliders from "../components/inputs/AllocationSliders";
import CurrencyInput from "../components/shared/CurrencyInput";
import PercentInput from "../components/shared/PercentInput";
import type { ExpenseCategory } from "../types";

const TABS = ["People & Timeline", "Accounts", "Income", "Expenses", "Assumptions"] as const;
type Tab = (typeof TABS)[number];

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5">
      {title && <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>}
      {children}
    </div>
  );
}

function PeopleTab() {
  const { household, updateHousehold } = useAppStore();

  function setSpouse1<K extends keyof typeof household.spouse1>(key: K, value: (typeof household.spouse1)[K]) {
    updateHousehold({ spouse1: { ...household.spouse1, [key]: value } });
  }
  function setSpouse2<K extends keyof typeof household.spouse2>(key: K, value: (typeof household.spouse2)[K]) {
    updateHousehold({ spouse2: { ...household.spouse2, [key]: value } });
  }

  const currentYear = new Date().getFullYear();

  function addChild() {
    updateHousehold({
      children: [...household.children, { name: "", birthYear: currentYear - 10, currentAge: 10 }],
    });
  }

  function removeChild(idx: number) {
    updateHousehold({ children: household.children.filter((_, i) => i !== idx) });
  }

  function updateChild(idx: number, key: "name" | "birthYear", raw: string) {
    const next = [...household.children];
    if (key === "birthYear") {
      const birthYear = parseInt(raw) || 0;
      next[idx] = { ...next[idx], birthYear, currentAge: currentYear - birthYear };
    } else {
      next[idx] = { ...next[idx], name: raw };
    }
    updateHousehold({ children: next });
  }

  return (
    <div className="space-y-4">
      {[
        { label: "Spouse 1", data: household.spouse1, set: setSpouse1 },
        { label: "Spouse 2", data: household.spouse2, set: setSpouse2 },
      ].map(({ label, data, set }) => (
        <SectionCard key={label} title={label}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <input
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={data.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Alex"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Birth Year</label>
              <input
                type="number"
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={data.birthYear || ""}
                onChange={(e) => set("birthYear", parseInt(e.target.value) || 0)}
              />
            </div>
            <CurrencyInput
              label="Current Annual Income"
              value={data.currentAnnualIncome}
              onChange={(v) => set("currentAnnualIncome", v)}
            />
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Target Retirement Age</label>
              <input
                type="number"
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={data.targetRetirementAge}
                onChange={(e) => set("targetRetirementAge", parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
          {data.birthYear > 0 && (
            <div className="mt-3 text-xs text-slate-400">
              Current age: {currentYear - data.birthYear} · Retires in {data.birthYear + data.targetRetirementAge - currentYear} years
            </div>
          )}
        </SectionCard>
      ))}

      <SectionCard title="Children">
        <div className="space-y-3">
          {household.children.length === 0 && (
            <p className="text-sm text-slate-400 py-1">No children added yet.</p>
          )}
          {household.children.map((child, idx) => (
            <div key={idx} className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Child {idx + 1} Name
                </label>
                <input
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={child.name}
                  onChange={(e) => updateChild(idx, "name", e.target.value)}
                  placeholder="e.g. Jordan"
                />
              </div>
              <div className="w-32">
                <label className="block text-xs font-medium text-slate-600 mb-1">Birth Year</label>
                <input
                  type="number"
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={child.birthYear || ""}
                  onChange={(e) => updateChild(idx, "birthYear", e.target.value)}
                />
              </div>
              {child.birthYear > 0 && (
                <div className="w-16 pb-2 text-xs text-slate-400">
                  Age {currentYear - child.birthYear}
                </div>
              )}
              <button
                onClick={() => removeChild(idx)}
                className="pb-1.5 text-slate-400 hover:text-red-500 transition-colors"
                aria-label="Remove child"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <button
            onClick={addChild}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-300 hover:border-blue-400 rounded-md transition-colors"
          >
            <Plus size={13} /> Add Child
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Planning Horizon">
        <div className="max-w-xs">
          <label className="block text-xs font-medium text-slate-600 mb-1">Model through age (older spouse)</label>
          <input
            type="number"
            className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={household.planningHorizon.endAge}
            onChange={(e) => updateHousehold({ planningHorizon: { endAge: parseInt(e.target.value) || 95 } })}
          />
        </div>
      </SectionCard>
    </div>
  );
}

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function catId() {
  return `cat-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function ExpensesTab() {
  const { expenses, updateExpenses } = useAppStore();
  const { categories, copyCurrentToRetirement } = expenses;

  function updateCategory(id: string, key: "currentAmount" | "retirementAmount", value: number) {
    updateExpenses({
      categories: categories.map((c) => (c.id === id ? { ...c, [key]: value } : c)),
    });
  }

  function updateLabel(id: string, label: string) {
    updateExpenses({ categories: categories.map((c) => (c.id === id ? { ...c, label } : c)) });
  }

  function addCategory() {
    const blank: ExpenseCategory = {
      id: catId(),
      label: "",
      currentAmount: 0,
      retirementAmount: 0,
      isCustom: true,
    };
    updateExpenses({ categories: [...categories, blank] });
  }

  function removeCategory(id: string) {
    updateExpenses({ categories: categories.filter((c) => c.id !== id) });
  }

  function toggleCopy(checked: boolean) {
    updateExpenses({ copyCurrentToRetirement: checked });
  }

  return (
    <div className="space-y-4">
      <SectionCard>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={copyCurrentToRetirement}
            onChange={(e) => toggleCopy(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Copy Current Spending to Retirement Spending
          {copyCurrentToRetirement && (
            <span className="text-xs text-slate-400 ml-1">
              (retirement column is read-only while enabled)
            </span>
          )}
        </label>
      </SectionCard>

      <SectionCard title="Annual Spending by Category">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 font-medium text-slate-600">Category</th>
                <th className="text-right py-2 font-medium text-slate-600 w-48">Current Annual Spending</th>
                <th className="text-right py-2 font-medium text-slate-600 w-48">Retirement Annual Spending</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {categories.map((cat) => (
                <tr key={cat.id}>
                  <td className="py-1.5 pr-3">
                    {cat.isCustom ? (
                      <input
                        className="w-full px-2 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={cat.label}
                        onChange={(e) => updateLabel(cat.id, e.target.value)}
                        placeholder="Category name"
                      />
                    ) : (
                      <span className="text-slate-700">{cat.label}</span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-right">
                    <CurrencyInput
                      value={cat.currentAmount}
                      onChange={(v) => updateCategory(cat.id, "currentAmount", v)}
                    />
                  </td>
                  <td className="py-1.5 px-2 text-right">
                    {copyCurrentToRetirement ? (
                      <span className="block px-2 py-1 text-sm text-slate-400 bg-slate-50 border border-slate-200 rounded-md text-right font-mono">
                        {fmt.format(cat.currentAmount)}
                      </span>
                    ) : (
                      <CurrencyInput
                        value={cat.retirementAmount}
                        onChange={(v) => updateCategory(cat.id, "retirementAmount", v)}
                      />
                    )}
                  </td>
                  <td className="py-1.5 pl-2">
                    {cat.isCustom && (
                      <button
                        onClick={() => removeCategory(cat.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                        aria-label="Remove category"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <td className="py-2 pr-3 font-semibold text-slate-800">Total</td>
                <td className="py-2 px-2 text-right font-semibold text-slate-800 font-mono">
                  {fmt.format(expenses.currentAnnualSpending)}
                </td>
                <td className="py-2 px-2 text-right font-semibold text-slate-800 font-mono">
                  {fmt.format(expenses.retirementAnnualSpending)}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          <button
            onClick={addCategory}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-300 hover:border-blue-400 rounded-md transition-colors"
          >
            <Plus size={13} /> Add Category
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

function AssumptionsTab() {
  const { investmentAssumptions, updateAssumptions } = useAppStore();
  const a = investmentAssumptions;

  return (
    <div className="space-y-4">
      <SectionCard>
        <AllocationSliders
          label="Pre-Retirement Allocation"
          value={a.preRetirementAllocation}
          onChange={(v) => updateAssumptions({ preRetirementAllocation: v })}
        />
      </SectionCard>

      <SectionCard>
        <AllocationSliders
          label="Post-Retirement Allocation"
          value={a.postRetirementAllocation}
          onChange={(v) => updateAssumptions({ postRetirementAllocation: v })}
        />
      </SectionCard>

      <SectionCard title="Return & Inflation Assumptions">
        <div className="grid grid-cols-2 gap-4">
          <PercentInput label="Equity Mean Return" value={a.equityMeanReturn} onChange={(v) => updateAssumptions({ equityMeanReturn: v })} />
          <PercentInput label="Equity Volatility (σ)" value={a.equityStdDev} onChange={(v) => updateAssumptions({ equityStdDev: v })} />
          <PercentInput label="Bond Mean Return" value={a.bondMeanReturn} onChange={(v) => updateAssumptions({ bondMeanReturn: v })} />
          <PercentInput label="Bond Volatility (σ)" value={a.bondStdDev} onChange={(v) => updateAssumptions({ bondStdDev: v })} />
          <PercentInput label="Cash Return" value={a.cashReturn} onChange={(v) => updateAssumptions({ cashReturn: v })} />
          <PercentInput label="Equity/Bond Correlation" value={a.correlationEquityBond} min={-1} max={1} onChange={(v) => updateAssumptions({ correlationEquityBond: v })} />
          <PercentInput label="Inflation Rate" value={a.inflationRate} onChange={(v) => updateAssumptions({ inflationRate: v })} />
        </div>

        <button
          onClick={() => updateAssumptions({
            equityMeanReturn: 0.07, equityStdDev: 0.15,
            bondMeanReturn: 0.035, bondStdDev: 0.06,
            cashReturn: 0.045, correlationEquityBond: -0.10,
            inflationRate: 0.025,
          })}
          className="mt-4 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-300 rounded-md transition-colors"
        >
          Reset to defaults
        </button>
      </SectionCard>
    </div>
  );
}

export default function InputsView() {
  const [activeTab, setActiveTab] = useState<Tab>("People & Timeline");

  const content: Record<Tab, React.ReactNode> = {
    "People & Timeline": <PeopleTab />,
    "Accounts": <AccountTable />,
    "Income": <IncomeTable />,
    "Expenses": <ExpensesTab />,
    "Assumptions": <AssumptionsTab />,
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-slate-900 mb-5">Inputs</h1>

      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {content[activeTab]}
    </div>
  );
}
