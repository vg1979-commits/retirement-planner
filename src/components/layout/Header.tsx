import { useRef } from "react";
import { Play, Square, Download, Upload } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { useToast } from "../../hooks/useToast";
import Toast from "../shared/Toast";
import {
  buildSaveFile,
  downloadJson,
  saveFilename,
  readJsonFile,
  parseSaveFile,
} from "../../utils/saveFile";

function formatLastRun(iso: string | null): string {
  if (!iso) return "Never run";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function Header() {
  const { ui, simulationProgress, runSimulations, cancelSimulation, importState, household, accounts, incomeStreams, expenses, investmentAssumptions, scenarios } = useAppStore();
  const { toasts, show, dismiss } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Save ──
  function handleSave() {
    const planState = { household, accounts, incomeStreams, expenses, investmentAssumptions, scenarios };
    const file = buildSaveFile(planState);
    const filename = saveFilename();
    downloadJson(file, filename);
    show(`Plan saved — ${filename}`, "success");
  }

  // ── Import ──
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = ""; // reset so same file can be re-selected
    if (!file) return;

    let raw: unknown;
    try {
      raw = await readJsonFile(file);
    } catch {
      show("Could not read the file. Make sure it is a valid JSON file.", "error");
      return;
    }

    const result = parseSaveFile(raw);
    if (!result.ok) {
      show(result.error, "error");
      return;
    }

    if (result.versionWarning) {
      show(`This file was saved with an older version of the app (v${(raw as { version?: string }).version ?? "?"}). Some fields may not load correctly.`, "warning");
    }

    const hasData = accounts.length > 0 || incomeStreams.length > 0 || household.name !== "";
    if (hasData) {
      const confirmed = window.confirm("Loading this file will replace your current inputs. Continue?");
      if (!confirmed) return;
    }

    importState(result.state);
    if (!result.versionWarning) {
      show("Plan loaded successfully", "success");
    }
  }

  function triggerImport() {
    fileInputRef.current?.click();
  }

  return (
    <>
      <header className="h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-white font-semibold text-lg tracking-tight">Retirement Planner</span>
          <span className="text-slate-400 text-sm hidden sm:block">·</span>
          <span className="text-slate-400 text-sm hidden sm:block">
            Last run: {formatLastRun(ui.lastRunAt)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Save & Import */}
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors"
            title="Save plan to file"
          >
            <Download size={14} />
            Save
          </button>
          <button
            onClick={triggerImport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors"
            title="Import plan from file"
          >
            <Upload size={14} />
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportFile}
          />

          {/* Simulation progress bar */}
          {ui.isSimulating && (
            <div className="flex items-center gap-2 text-slate-300 text-sm ml-1">
              <div className="w-32 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round(simulationProgress * 100)}%` }}
                />
              </div>
              <span>{Math.round(simulationProgress * 100)}%</span>
            </div>
          )}

          {/* Run / Cancel */}
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
              onClick={() => runSimulations()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              <Play size={14} />
              Run Simulation
            </button>
          )}
        </div>
      </header>

      <Toast toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
