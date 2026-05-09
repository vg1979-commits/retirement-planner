import { useState } from "react";
import { Download, AlertTriangle } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import TaxBarChart from "../components/charts/TaxBarChart";
import type { AnnualProjection, RothConversionTargetBracket, Scenario } from "../types";

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// ─── Roth Planner sub-tab ─────────────────────────────────────────────────────

function exportRothCSV(rows: AnnualProjection[]) {
  const header = "Year,Age S1,Age S2,Traditional Balance,RMD,Conversion Amount,Tax Cost,Marginal Rate,Rationale,IRMAA\n";
  const body = rows.map((p) => [
    p.year,
    p.age_spouse1,
    p.age_spouse2,
    Math.round(p.traditionalBalanceStart),
    Math.round(p.rmdAmount),
    Math.round(p.rothConversionAmount),
    Math.round(p.rothConversionTaxCost),
    `${(p.marginalRate * 100).toFixed(0)}%`,
    `"${(p.conversionRationale ?? "").replace(/"/g, '""')}"`,
    p.irmaaWarning ? "Yes" : "",
  ].join(",")).join("\n");
  const blob = new Blob([header + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "roth-conversion-plan.csv";
  a.click();
  URL.revokeObjectURL(url);
}

interface RothPlannerProps {
  scenario: Scenario;
  projections: AnnualProjection[];
  summary: {
    totalConverted: number;
    estimatedTaxSavings: number;
    conversionWindowStart: number | null;
    conversionWindowEnd: number | null;
    traditionalBalanceAtRMDAge: number;
    narrativeSummary: string;
  };
  onUpdate: (patch: Partial<Pick<Scenario, "enableRothOptimizer" | "rothConversionTargetBracket">>) => void;
}

function RothPlanner({ scenario, projections, summary, onUpdate }: RothPlannerProps) {
  const optimizerEnabled = scenario.enableRothOptimizer ?? true;
  const targetBracket: RothConversionTargetBracket = scenario.rothConversionTargetBracket ?? "22pct";

  // Show only retirement years (the planner only matters from retirement onward).
  // Pre-retirement rows are noisy ($0 conversions, working income) and would dilute the table.
  const planningRows = projections.filter((p) => p.earnedIncome === 0);

  const bracketOptions: { value: RothConversionTargetBracket; label: string }[] = [
    { value: "12pct", label: "12% (Conservative)" },
    { value: "22pct", label: "22% (Moderate, default)" },
    { value: "24pct", label: "24% (Aggressive)" },
  ];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center gap-6 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={optimizerEnabled}
            onChange={(e) => onUpdate({ enableRothOptimizer: e.target.checked })}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="font-medium">Enable Roth Conversion Optimizer</span>
        </label>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Target Bracket:</span>
          <div className="inline-flex rounded-md border border-slate-300 overflow-hidden">
            {bracketOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onUpdate({ rothConversionTargetBracket: opt.value })}
                disabled={!optimizerEnabled}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  targetBracket === opt.value
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                } ${!optimizerEnabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-400 ml-auto">
          Changes take effect on the next simulation run.
        </p>
      </div>

      {/* Summary bar */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">Estimated Tax Savings</div>
            <div className={`text-2xl font-bold ${summary.estimatedTaxSavings >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              {summary.estimatedTaxSavings >= 0 ? "" : "−"}{fmt.format(Math.abs(summary.estimatedTaxSavings))}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">Total Converted</div>
            <div className="text-2xl font-bold text-slate-800">{fmt.format(summary.totalConverted)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">Conversion Window</div>
            <div className="text-2xl font-bold text-slate-800">
              {summary.conversionWindowStart !== null && summary.conversionWindowEnd !== null
                ? `${summary.conversionWindowStart}–${summary.conversionWindowEnd}`
                : "—"}
            </div>
          </div>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">{summary.narrativeSummary}</p>
      </div>

      {/* Year-by-year table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {planningRows.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            No post-retirement years yet — adjust retirement age or run a simulation.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Year</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Age</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">Traditional Balance</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">RMD</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">Conversion Amount</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">Tax Cost</th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">Marginal Rate</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Rationale</th>
                  <th className="text-center px-3 py-2 font-medium text-slate-600">IRMAA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {planningRows.map((p) => {
                  const hasConversion = p.rothConversionAmount > 0;
                  return (
                    <tr key={p.year} className={hasConversion ? "bg-blue-50/30 hover:bg-blue-50/60" : "hover:bg-slate-50"}>
                      <td className="px-3 py-2 font-medium text-slate-800">{p.year}</td>
                      <td className="px-3 py-2 text-slate-500">{p.age_spouse1}/{p.age_spouse2}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700">
                        {fmt.format(p.traditionalBalanceStart)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-600">
                        {p.rmdAmount > 0 ? fmt.format(p.rmdAmount) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-blue-700 font-medium">
                        {hasConversion ? fmt.format(p.rothConversionAmount) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-red-600">
                        {p.rothConversionTaxCost > 0 ? fmt.format(p.rothConversionTaxCost) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {(p.marginalRate * 100).toFixed(0)}%
                      </td>
                      <td className="px-3 py-2 text-slate-600 text-xs">
                        {p.conversionRationale ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {p.irmaaWarning && (
                          <span title="MAGI exceeds IRMAA threshold — Medicare premium surcharges apply" className="inline-flex items-center text-amber-600">
                            <AlertTriangle size={14} />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {summary.traditionalBalanceAtRMDAge > 0 && (
          <div className={`text-sm px-3 py-2 rounded-md ${
            summary.traditionalBalanceAtRMDAge > 2_000_000
              ? "bg-amber-50 border border-amber-200 text-amber-800"
              : "bg-slate-50 border border-slate-200 text-slate-600"
          }`}>
            <span className="font-medium">Without conversions:</span> projected traditional balance at age 73 is{" "}
            <span className="font-mono font-semibold">{fmt.format(summary.traditionalBalanceAtRMDAge)}</span>
            {summary.traditionalBalanceAtRMDAge > 2_000_000 && " — large RMDs ahead"}
          </div>
        )}
        {planningRows.length > 0 && (
          <button
            onClick={() => exportRothCSV(planningRows)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-md hover:bg-slate-50 transition-colors ml-auto"
          >
            <Download size={14} /> Export CSV
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export default function TaxView() {
  const { results, scenarios, ui, upsertScenario } = useAppStore();
  const [subTab, setSubTab] = useState<"timeline" | "roth">("timeline");

  const activeResults = ui.activeScenarioIds
    .map((id) => results[id])
    .filter((r): r is NonNullable<typeof r> => r !== undefined);

  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const selectedId = activeScenarioId ?? activeResults[0]?.scenarioId ?? null;
  const selectedResult = selectedId ? results[selectedId] : undefined;
  const selectedScenario = selectedId ? scenarios.find((s) => s.id === selectedId) : undefined;
  const projections = selectedResult?.annualProjections ?? [];

  const hasResults = projections.length > 0;

  function updateScenarioRothSettings(
    patch: Partial<Pick<Scenario, "enableRothOptimizer" | "rothConversionTargetBracket">>
  ) {
    if (!selectedScenario) return;
    upsertScenario({ ...selectedScenario, ...patch });
  }

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

      {hasResults && subTab === "roth" && selectedResult && selectedScenario && (
        <RothPlanner
          scenario={selectedScenario}
          projections={projections}
          summary={selectedResult.rothConversionSummary}
          onUpdate={updateScenarioRothSettings}
        />
      )}
    </div>
  );
}
