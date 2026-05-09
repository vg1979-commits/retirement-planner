import React, { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import AccountTable from "../components/inputs/AccountTable";
import IncomeTable from "../components/inputs/IncomeTable";
import AllocationSliders from "../components/inputs/AllocationSliders";
import CurrencyInput from "../components/shared/CurrencyInput";
import PercentInput from "../components/shared/PercentInput";

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
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Birth Year</label>
              <input
                type="number"
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={data.birthYear}
                onChange={(e) => set("birthYear", parseInt(e.target.value))}
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
                onChange={(e) => set("targetRetirementAge", parseInt(e.target.value))}
              />
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-400">
            Current age: {currentYear - data.birthYear} · Retires in {data.birthYear + data.targetRetirementAge - currentYear} years
          </div>
        </SectionCard>
      ))}

      <SectionCard title="Children">
        <div className="space-y-5">
          {household.children.map((child, idx) => (
            <div key={idx}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Child {idx + 1} Name
                  </label>
                  <input
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={child.name}
                    onChange={(e) => {
                      const next = [...household.children];
                      next[idx] = { ...child, name: e.target.value };
                      updateHousehold({ children: next });
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Birth Year</label>
                  <input
                    type="number"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={child.birthYear}
                    onChange={(e) => {
                      const birthYear = parseInt(e.target.value);
                      const next = [...household.children];
                      next[idx] = { ...child, birthYear, currentAge: currentYear - birthYear };
                      updateHousehold({ children: next });
                    }}
                  />
                </div>
              </div>
              <div className="mt-1.5 text-xs text-slate-400">Age {currentYear - child.birthYear}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Planning Horizon">
        <div className="max-w-xs">
          <label className="block text-xs font-medium text-slate-600 mb-1">Model through age (older spouse)</label>
          <input
            type="number"
            className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={household.planningHorizon.endAge}
            onChange={(e) => updateHousehold({ planningHorizon: { endAge: parseInt(e.target.value) } })}
          />
        </div>
      </SectionCard>
    </div>
  );
}

function ExpensesTab() {
  const { expenses, updateExpenses } = useAppStore();

  return (
    <div className="space-y-4">
      <SectionCard title="Spending">
        <div className="grid grid-cols-2 gap-4">
          <CurrencyInput
            label="Current Annual Spending"
            value={expenses.currentAnnualSpending}
            onChange={(v) => updateExpenses({ currentAnnualSpending: v })}
          />
          <CurrencyInput
            label="Retirement Annual Spending (today's $)"
            value={expenses.retirementAnnualSpending}
            onChange={(v) => updateExpenses({ retirementAnnualSpending: v })}
          />
          <PercentInput
            label="Inflation Rate"
            value={expenses.inflationRate}
            onChange={(v) => updateExpenses({ inflationRate: v })}
          />
        </div>
      </SectionCard>

      {expenses.categories && expenses.categories.length > 0 && (
        <SectionCard title="Category Breakdown">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 font-medium text-slate-600">Category</th>
                  <th className="text-right py-2 font-medium text-slate-600">Working</th>
                  <th className="text-right py-2 font-medium text-slate-600">Retirement</th>
                  <th className="text-center py-2 font-medium text-slate-600">Active in Retirement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {expenses.categories.map((cat, idx) => (
                  <tr key={idx}>
                    <td className="py-2 text-slate-700">{cat.label}</td>
                    <td className="py-2 text-right font-mono text-slate-600">
                      ${(cat.annualAmount / 1000).toFixed(0)}K
                    </td>
                    <td className="py-2 text-right font-mono text-slate-500">
                      {cat.activeInRetirement ? `$${((cat.retirementAmount ?? cat.annualAmount) / 1000).toFixed(0)}K` : "—"}
                    </td>
                    <td className="py-2 text-center">
                      <span className={`text-xs font-medium ${cat.activeInRetirement ? "text-emerald-600" : "text-slate-400"}`}>
                        {cat.activeInRetirement ? "Yes" : "No"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
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

      <SectionCard title="Return Assumptions">
        <div className="grid grid-cols-2 gap-4">
          <PercentInput label="Equity Mean Return" value={a.equityMeanReturn} onChange={(v) => updateAssumptions({ equityMeanReturn: v })} />
          <PercentInput label="Equity Volatility (σ)" value={a.equityStdDev} onChange={(v) => updateAssumptions({ equityStdDev: v })} />
          <PercentInput label="Bond Mean Return" value={a.bondMeanReturn} onChange={(v) => updateAssumptions({ bondMeanReturn: v })} />
          <PercentInput label="Bond Volatility (σ)" value={a.bondStdDev} onChange={(v) => updateAssumptions({ bondStdDev: v })} />
          <PercentInput label="Cash Return" value={a.cashReturn} onChange={(v) => updateAssumptions({ cashReturn: v })} />
          <PercentInput label="Equity/Bond Correlation" value={a.correlationEquityBond} min={-1} max={1} onChange={(v) => updateAssumptions({ correlationEquityBond: v })} />
        </div>

        <button
          onClick={() => updateAssumptions({
            equityMeanReturn: 0.07, equityStdDev: 0.15,
            bondMeanReturn: 0.035, bondStdDev: 0.06,
            cashReturn: 0.045, correlationEquityBond: -0.10,
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
