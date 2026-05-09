import { useState } from "react";
import { Download } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import CashFlowTable from "../components/charts/CashFlowTable";
import NominalRealToggle from "../components/shared/NominalRealToggle";

function exportCSV(rows: ReturnType<typeof buildRows>) {
  const header = "Year,Age S1,Age S2,Income,Federal Tax,Expenses,Contributions,Withdrawals,Net Flow,Portfolio Balance\n";
  const body = rows.map((r) =>
    [r.year, r.s1, r.s2, r.income, r.tax, r.expenses, r.contributions, r.withdrawals, r.netFlow, r.balance].join(",")
  ).join("\n");
  const blob = new Blob([header + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cash-flow.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function buildRows(projections: ReturnType<typeof useAppStore.getState>["results"][string]["annualProjections"]) {
  return projections.map((p) => ({
    year: p.year,
    s1: p.age_spouse1,
    s2: p.age_spouse2,
    income: p.earnedIncome,
    tax: p.federalTax,
    expenses: p.totalExpenses,
    contributions: p.contributions,
    withdrawals: p.withdrawals,
    netFlow: p.earnedIncome - p.federalTax - p.totalExpenses + p.contributions - p.withdrawals,
    balance: p.portfolioEndBalance,
  }));
}

export default function CashFlowView() {
  const { results, investmentAssumptions, ui, scenarios } = useAppStore();
  const [displayMode, setDisplayMode] = useState<"nominal" | "real">("nominal");
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  const activeResults = ui.activeScenarioIds
    .map((id) => results[id])
    .filter((r): r is NonNullable<typeof r> => r !== undefined);

  const selectedId = activeScenarioId ?? activeResults[0]?.scenarioId ?? null;
  const selectedResult = selectedId ? results[selectedId] : undefined;
  const projections = selectedResult?.annualProjections ?? [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-slate-900">Cash Flow</h1>
        <div className="flex items-center gap-3">
          {activeResults.length > 1 && (
            <select
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedId ?? ""}
              onChange={(e) => setActiveScenarioId(e.target.value)}
            >
              {activeResults.map((r) => {
                const sc = scenarios.find((s) => s.id === r.scenarioId);
                return <option key={r.scenarioId} value={r.scenarioId}>{sc?.label ?? r.scenarioId}</option>;
              })}
            </select>
          )}
          <NominalRealToggle value={displayMode} onChange={setDisplayMode} />
          {projections.length > 0 && (
            <button
              onClick={() => exportCSV(buildRows(projections))}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              <Download size={14} /> Export CSV
            </button>
          )}
        </div>
      </div>

      {projections.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-3xl mb-3">📋</div>
          <div>Run a simulation to see year-by-year cash flow data.</div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <CashFlowTable
            projections={projections}
            displayMode={displayMode}
            inflationRate={investmentAssumptions.inflationRate}
          />
        </div>
      )}
    </div>
  );
}
