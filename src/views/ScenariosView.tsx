import { useState } from "react";
import { Plus } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import type { Scenario } from "../types";
import ScenarioCard from "../components/scenarios/ScenarioCard";
import ScenarioEditor from "../components/scenarios/ScenarioEditor";
import SlideOver from "../components/shared/SlideOver";
import PortfolioChart from "../components/charts/PortfolioChart";
import NominalRealToggle from "../components/shared/NominalRealToggle";

function newId() {
  return `scenario-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function ScenariosView() {
  const { scenarios, results, expenses, ui, setActiveScenarios, upsertScenario, removeScenario } = useAppStore();
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<Scenario | undefined>(undefined);
  const [displayMode, setDisplayMode] = useState<"nominal" | "real">("nominal");

  function openNew() { setEditing(undefined); setSlideOpen(true); }
  function openEdit(sc: Scenario) { setEditing(sc); setSlideOpen(true); }

  function duplicate(sc: Scenario) {
    upsertScenario({
      ...sc,
      id: newId(),
      label: `${sc.label} (copy)`,
    });
  }

  function toggleScenario(id: string) {
    if (ui.activeScenarioIds.includes(id)) {
      setActiveScenarios(ui.activeScenarioIds.filter((s) => s !== id));
    } else {
      setActiveScenarios([...ui.activeScenarioIds, id]);
    }
  }

  const activeResults = ui.activeScenarioIds
    .map((id) => results[id])
    .filter((r): r is NonNullable<typeof r> => r !== undefined);

  const activeScenarios = scenarios.filter((s) => ui.activeScenarioIds.includes(s.id));
  const baseProjections = activeResults[0]?.annualProjections ?? [];

  return (
    <div className="p-6 h-full flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Scenarios</h1>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
        >
          <Plus size={14} /> New Scenario
        </button>
      </div>

      <div className="flex gap-5 flex-1 min-h-0">
        {/* Left panel: scenario list */}
        <div className="w-72 flex-shrink-0 space-y-3 overflow-y-auto pr-1">
          {scenarios.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg">
              No scenarios yet. Create one to compare alternatives.
            </div>
          ) : (
            scenarios.map((sc) => (
              <ScenarioCard
                key={sc.id}
                scenario={sc}
                result={results[sc.id]}
                active={ui.activeScenarioIds.includes(sc.id)}
                onToggle={() => toggleScenario(sc.id)}
                onEdit={() => openEdit(sc)}
                onDuplicate={() => duplicate(sc)}
                onDelete={() => removeScenario(sc.id)}
              />
            ))
          )}
        </div>

        {/* Right panel: comparison chart */}
        <div className="flex-1 bg-white rounded-lg border border-slate-200 p-5 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Scenario Comparison</h2>
            <NominalRealToggle value={displayMode} onChange={setDisplayMode} />
          </div>
          <div className="flex-1 min-h-0" style={{ minHeight: 300 }}>
            {activeResults.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                Select scenarios and run a simulation to compare.
              </div>
            ) : (
              <PortfolioChart
                results={activeResults}
                projections={baseProjections}
                scenarios={activeScenarios}
                displayMode={displayMode}
                inflationRate={expenses.inflationRate}
              />
            )}
          </div>

          {/* Success rate row */}
          {activeResults.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex gap-4 flex-wrap">
              {activeResults.map((r) => {
                const sc = scenarios.find((s) => s.id === r.scenarioId);
                const pct = Math.round(r.successRate * 100);
                const color = pct >= 90 ? "text-emerald-600" : pct >= 75 ? "text-blue-600" : pct >= 50 ? "text-amber-600" : "text-red-600";
                return (
                  <div key={r.scenarioId} className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: sc?.color ?? "#64748b" }} />
                    <span className="text-sm text-slate-600">{sc?.label}</span>
                    <span className={`text-sm font-bold ${color}`}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <SlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        title={editing ? "Edit Scenario" : "New Scenario"}
      >
        <ScenarioEditor initial={editing} onSave={() => setSlideOpen(false)} />
      </SlideOver>
    </div>
  );
}
