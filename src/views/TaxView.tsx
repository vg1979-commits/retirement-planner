import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import TaxBarChart from "../components/charts/TaxBarChart";

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function TaxView() {
  const { results, scenarios, ui } = useAppStore();
  const [subTab, setSubTab] = useState<"timeline" | "roth">("timeline");

  const activeResults = ui.activeScenarioIds
    .map((id) => results[id])
    .filter((r): r is NonNullable<typeof r> => r !== undefined);

  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const selectedId = activeScenarioId ?? activeResults[0]?.scenarioId ?? null;
  const selectedResult = selectedId ? results[selectedId] : undefined;
  const projections = selectedResult?.annualProjections ?? [];

  const hasResults = projections.length > 0;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-slate-900">Taxes</h1>
        {activeResults.length > 1 && (
          <select
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-md"
            value={selectedId ?? ""}
            onChange={(e) => setActiveScenarioId(e.target.value)}
          >
            {activeResults.map((r) => {
              const sc = scenarios.find((s) => s.id === r.scenarioId);
              return <option key={r.scenarioId} value={r.scenarioId}>{sc?.label ?? r.scenarioId}</option>;
            })}
          </select>
        )}
      </div>

      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {(["timeline", "roth"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
              subTab === t ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "timeline" ? "Tax Timeline" : "Roth Conversion Planner"}
          </button>
        ))}
      </div>

      {!hasResults && (
        <div className="text-center py-16 text-slate-400">
          <div className="text-3xl mb-3">📊</div>
          <div>Run a simulation to see tax projections.</div>
        </div>
      )}

      {hasResults && subTab === "timeline" && (
        <div className="bg-white rounded-lg border border-slate-200 p-5" style={{ height: 400 }}>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Federal Tax &amp; Effective Rate by Year</h2>
          <div style={{ height: 330 }}>
            <TaxBarChart projections={projections} />
          </div>
        </div>
      )}

      {hasResults && subTab === "roth" && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="p-4 bg-amber-50 border-b border-amber-100 text-sm text-amber-800">
            Roth conversion opportunities shown below are illustrative — run the simulation to see updated projections.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Year</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Age S1/S2</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">Earned Income</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">Federal Tax</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">Effective Rate</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">Portfolio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projections
                  .filter((p) => p.earnedIncome === 0) // post-retirement conversion windows
                  .slice(0, 20)
                  .map((p) => (
                    <tr key={p.year} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-800">{p.year}</td>
                      <td className="px-3 py-2 text-slate-500">{p.age_spouse1}/{p.age_spouse2}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-600">{fmt.format(p.earnedIncome)}</td>
                      <td className="px-3 py-2 text-right font-mono text-red-600">{fmt.format(p.federalTax)}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{(p.effectiveTaxRate * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-800">{fmt.format(p.portfolioEndBalance)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {projections.filter((p) => p.earnedIncome === 0).length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">
              No post-retirement years yet — adjust retirement age to see conversion windows.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
