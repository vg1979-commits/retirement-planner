import { Pencil, Trash2, Copy } from "lucide-react";
import type { Scenario, SimulationResult } from "../../types";

interface Props {
  scenario: Scenario;
  result?: SimulationResult;
  active: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function colorDot(hex: string) {
  return <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: hex }} />;
}

function successColor(rate?: number): string {
  if (rate === undefined) return "text-slate-400";
  if (rate >= 0.9) return "text-emerald-600";
  if (rate >= 0.75) return "text-blue-600";
  if (rate >= 0.5) return "text-amber-600";
  return "text-red-600";
}

export default function ScenarioCard({ scenario, result, active, onToggle, onEdit, onDuplicate, onDelete }: Props) {
  const pct = result ? Math.round(result.successRate * 100) : null;

  return (
    <div className={`rounded-lg border p-4 transition-all ${active ? "border-blue-300 bg-blue-50/50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={active}
          onChange={onToggle}
          className="mt-0.5 accent-blue-600"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {colorDot(scenario.color)}
            <span className="text-sm font-semibold text-slate-800 truncate">{scenario.label}</span>
          </div>

          {scenario.retirementAgeOverride && (
            <div className="text-xs text-slate-500 mb-0.5">
              Retire: S1 @ {scenario.retirementAgeOverride.spouse1 ?? "default"} · S2 @ {scenario.retirementAgeOverride.spouse2 ?? "default"}
            </div>
          )}
          {scenario.annualSpendingOverride !== undefined && (
            <div className="text-xs text-slate-500 mb-0.5">
              Spending: ${(scenario.annualSpendingOverride / 1000).toFixed(0)}K/yr
            </div>
          )}

          {pct !== null && (
            <div className={`text-lg font-bold mt-1 ${successColor(result?.successRate)}`}>
              {pct}% <span className="text-xs font-normal text-slate-400">success</span>
            </div>
          )}
          {pct === null && (
            <div className="text-xs text-slate-400 mt-1 italic">Not yet simulated</div>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={onEdit} title="Edit" className="text-slate-400 hover:text-blue-600 transition-colors"><Pencil size={13} /></button>
          <button onClick={onDuplicate} title="Duplicate" className="text-slate-400 hover:text-slate-700 transition-colors"><Copy size={13} /></button>
          <button onClick={onDelete} title="Delete" className="text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  );
}
