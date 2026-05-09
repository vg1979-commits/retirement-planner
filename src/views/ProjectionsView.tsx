import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import PortfolioChart from "../components/charts/PortfolioChart";
import SuccessGauge from "../components/shared/SuccessGauge";
import NominalRealToggle from "../components/shared/NominalRealToggle";

export default function ProjectionsView() {
  const { results, scenarios, expenses, ui } = useAppStore();
  const [displayMode, setDisplayMode] = useState<"nominal" | "real">("nominal");

  const activeResults = ui.activeScenarioIds
    .map((id) => results[id])
    .filter((r): r is NonNullable<typeof r> => r !== undefined);

  const activeScenarios = scenarios.filter((s) => ui.activeScenarioIds.includes(s.id));

  // Use the first active result's median projections for the year axis
  const baseProjections = activeResults[0]?.annualProjections ?? [];

  const hasResults = activeResults.length > 0;

  return (
    <div className="p-6 h-full flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Projections</h1>
        <NominalRealToggle value={displayMode} onChange={setDisplayMode} />
      </div>

      {!hasResults && (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <div className="text-4xl mb-3">📊</div>
            <div className="text-base font-medium">Set up your inputs and click Run Simulation</div>
            <div className="text-sm mt-1 text-slate-300">Results will appear here once the simulation completes.</div>
          </div>
        </div>
      )}

      {hasResults && (
        <>
          {/* Portfolio chart */}
          <div className="bg-white rounded-lg border border-slate-200 p-5" style={{ height: 380 }}>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Portfolio Balance (P25–P75 band with median)</h2>
            <div style={{ height: 310 }}>
              <PortfolioChart
                results={activeResults}
                projections={baseProjections}
                scenarios={activeScenarios}
                displayMode={displayMode}
                inflationRate={expenses.inflationRate}
              />
            </div>
          </div>

          {/* Success gauges */}
          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Probability of Success</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {activeResults.map((result) => {
                const sc = scenarios.find((s) => s.id === result.scenarioId);
                return (
                  <SuccessGauge
                    key={result.scenarioId}
                    successRate={result.successRate}
                    label={sc?.label}
                    numSimulations={result.numSimulations}
                  />
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
