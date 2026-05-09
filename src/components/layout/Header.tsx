import { Play, Square } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";

function formatLastRun(iso: string | null): string {
  if (!iso) return "Never run";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function Header() {
  const { ui, simulationProgress, runSimulations, cancelSimulation } = useAppStore();

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-white font-semibold text-lg tracking-tight">Retirement Planner</span>
        <span className="text-slate-400 text-sm hidden sm:block">·</span>
        <span className="text-slate-400 text-sm hidden sm:block">
          Last run: {formatLastRun(ui.lastRunAt)}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {ui.isSimulating && (
          <div className="flex items-center gap-2 text-slate-300 text-sm">
            <div className="w-32 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.round(simulationProgress * 100)}%` }}
              />
            </div>
            <span>{Math.round(simulationProgress * 100)}%</span>
          </div>
        )}

        {ui.isSimulating ? (
          <button
            onClick={cancelSimulation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
          >
            <Square size={14} />
            Cancel
          </button>
        ) : (
          <button
            onClick={() => runSimulations(1000)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            <Play size={14} />
            Run Simulation
          </button>
        )}
      </div>
    </header>
  );
}
