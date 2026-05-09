import { create } from "zustand";
import type {
  Account,
  AppState,
  ExpenseCategory,
  ExpenseProfile,
  HouseholdProfile,
  IncomeStream,
  InvestmentAssumptions,
  Scenario,
  SimulationResult,
  UIState,
} from "../types";
import { runSimulationsAsync } from "../engine/runner";
import {
  INITIAL_HOUSEHOLD,
  INITIAL_ACCOUNTS,
  INITIAL_INCOME_STREAMS,
  INITIAL_EXPENSES,
  INITIAL_INVESTMENT_ASSUMPTIONS,
  INITIAL_SCENARIOS,
} from "./initialState";
import { lsLoad, lsSave, type PlanState } from "../utils/saveFile";

// ─── Action surface ───────────────────────────────────────────────────────────

interface AppActions {
  // Household
  updateHousehold: (patch: Partial<HouseholdProfile>) => void;

  // Accounts
  upsertAccount: (account: Account) => void;
  removeAccount: (id: string) => void;

  // Income streams
  upsertIncomeStream: (stream: IncomeStream) => void;
  removeIncomeStream: (id: string) => void;

  // Expenses & assumptions
  updateExpenses: (patch: Partial<ExpenseProfile>) => void;
  updateAssumptions: (patch: Partial<InvestmentAssumptions>) => void;

  // Scenarios
  upsertScenario: (scenario: Scenario) => void;
  removeScenario: (id: string) => void;
  setActiveScenarios: (ids: string[]) => void;

  // UI
  setActiveView: (view: UIState["activeView"]) => void;

  // Simulation
  runSimulations: (numSimulations?: number) => Promise<void>;
  cancelSimulation: () => void;

  // Persistence
  importState: (state: PlanState) => void;
  resetToEmpty: () => void;
}

export type AppStore = AppState & AppActions & {
  /** 0–1, only meaningful while ui.isSimulating is true. */
  simulationProgress: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveTotals(cats: ExpenseCategory[]): Pick<ExpenseProfile, "currentAnnualSpending" | "retirementAnnualSpending"> {
  return {
    currentAnnualSpending: cats.reduce((s, c) => s + c.currentAmount, 0),
    retirementAnnualSpending: cats.reduce((s, c) => s + c.retirementAmount, 0),
  };
}

// ─── Initial state ────────────────────────────────────────────────────────────

function defaultUIState(): UIState {
  return {
    activeView: "inputs",
    activeScenarioIds: INITIAL_SCENARIOS.map((s) => s.id),
    isSimulating: false,
    lastRunAt: null,
  };
}

/** Try to restore from localStorage; fall back to blank initial state. */
function startingState(): Omit<AppStore, keyof AppActions> {
  const saved = lsLoad();
  if (saved) {
    return {
      ...saved,
      results: {},
      ui: { ...defaultUIState(), activeScenarioIds: saved.scenarios.map((s) => s.id) },
      simulationProgress: 0,
    };
  }
  return {
    household: INITIAL_HOUSEHOLD,
    accounts: INITIAL_ACCOUNTS,
    incomeStreams: INITIAL_INCOME_STREAMS,
    expenses: INITIAL_EXPENSES,
    investmentAssumptions: INITIAL_INVESTMENT_ASSUMPTIONS,
    scenarios: INITIAL_SCENARIOS,
    results: {},
    ui: defaultUIState(),
    simulationProgress: 0,
  };
}

function emptyState(): Omit<AppStore, keyof AppActions> {
  return {
    household: INITIAL_HOUSEHOLD,
    accounts: INITIAL_ACCOUNTS,
    incomeStreams: INITIAL_INCOME_STREAMS,
    expenses: INITIAL_EXPENSES,
    investmentAssumptions: INITIAL_INVESTMENT_ASSUMPTIONS,
    scenarios: INITIAL_SCENARIOS,
    results: {},
    ui: defaultUIState(),
    simulationProgress: 0,
  };
}

// ─── Debounced auto-save ──────────────────────────────────────────────────────

let _saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAutoSave(state: PlanState) {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => lsSave(state), 500);
}

function extractPlanState(s: AppStore): PlanState {
  return {
    household: s.household,
    accounts: s.accounts,
    incomeStreams: s.incomeStreams,
    expenses: s.expenses,
    investmentAssumptions: s.investmentAssumptions,
    scenarios: s.scenarios,
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

let activeRun: { cancel: () => void } | null = null;

export const useAppStore = create<AppStore>((set, get) => ({
  ...startingState(),

  // ── Household ──
  updateHousehold: (patch) =>
    set((s) => {
      const household = { ...s.household, ...patch, updatedAt: new Date().toISOString() };
      scheduleAutoSave({ ...extractPlanState(s as AppStore), household });
      return { household };
    }),

  // ── Accounts ──
  upsertAccount: (account) =>
    set((s) => {
      const existing = s.accounts.findIndex((a) => a.id === account.id);
      const accounts = [...s.accounts];
      if (existing >= 0) accounts[existing] = account;
      else accounts.push(account);
      scheduleAutoSave({ ...extractPlanState(s as AppStore), accounts });
      return { accounts };
    }),

  removeAccount: (id) =>
    set((s) => {
      const accounts = s.accounts.filter((a) => a.id !== id);
      scheduleAutoSave({ ...extractPlanState(s as AppStore), accounts });
      return { accounts };
    }),

  // ── Income streams ──
  upsertIncomeStream: (stream) =>
    set((s) => {
      const existing = s.incomeStreams.findIndex((i) => i.id === stream.id);
      const incomeStreams = [...s.incomeStreams];
      if (existing >= 0) incomeStreams[existing] = stream;
      else incomeStreams.push(stream);
      scheduleAutoSave({ ...extractPlanState(s as AppStore), incomeStreams });
      return { incomeStreams };
    }),

  removeIncomeStream: (id) =>
    set((s) => {
      const incomeStreams = s.incomeStreams.filter((i) => i.id !== id);
      scheduleAutoSave({ ...extractPlanState(s as AppStore), incomeStreams });
      return { incomeStreams };
    }),

  // ── Expenses & assumptions ──
  updateExpenses: (patch) =>
    set((s) => {
      const next = { ...s.expenses, ...patch };

      // If the copy toggle is on, force every retirementAmount to mirror its currentAmount.
      // This applies to BOTH cases: when categories were updated, AND when the toggle was just turned on.
      let categories = next.categories;
      if (next.copyCurrentToRetirement && (patch.categories !== undefined || patch.copyCurrentToRetirement === true)) {
        categories = next.categories.map((c) =>
          c.retirementAmount === c.currentAmount ? c : { ...c, retirementAmount: c.currentAmount }
        );
      }

      const recomputeTotals = patch.categories !== undefined || patch.copyCurrentToRetirement === true;
      const expenses = recomputeTotals
        ? { ...next, categories, ...deriveTotals(categories) }
        : { ...next, categories };

      scheduleAutoSave({ ...extractPlanState(s as AppStore), expenses });
      return { expenses };
    }),

  updateAssumptions: (patch) =>
    set((s) => {
      const investmentAssumptions = { ...s.investmentAssumptions, ...patch };
      scheduleAutoSave({ ...extractPlanState(s as AppStore), investmentAssumptions });
      return { investmentAssumptions };
    }),

  // ── Scenarios ──
  upsertScenario: (scenario) =>
    set((s) => {
      const existing = s.scenarios.findIndex((sc) => sc.id === scenario.id);
      const scenarios = [...s.scenarios];
      if (existing >= 0) scenarios[existing] = scenario;
      else scenarios.push(scenario);
      scheduleAutoSave({ ...extractPlanState(s as AppStore), scenarios });
      return { scenarios };
    }),

  removeScenario: (id) =>
    set((s) => {
      const scenarios = s.scenarios.filter((sc) => sc.id !== id);
      scheduleAutoSave({ ...extractPlanState(s as AppStore), scenarios });
      return {
        scenarios,
        ui: { ...s.ui, activeScenarioIds: s.ui.activeScenarioIds.filter((sid) => sid !== id) },
        results: Object.fromEntries(Object.entries(s.results).filter(([sid]) => sid !== id)),
      };
    }),

  setActiveScenarios: (ids) =>
    set((s) => ({ ui: { ...s.ui, activeScenarioIds: ids } })),

  // ── UI ──
  setActiveView: (view) =>
    set((s) => ({ ui: { ...s.ui, activeView: view } })),

  // ── Simulation ──
  runSimulations: async (numSimulations = 1_500) => {
    activeRun?.cancel();

    set((s) => ({
      ui: { ...s.ui, isSimulating: true },
      simulationProgress: 0,
    }));

    const s = get();
    // Extract only plain data — worker's postMessage can't clone functions
    const state: AppState = {
      household: s.household,
      accounts: s.accounts,
      incomeStreams: s.incomeStreams,
      expenses: s.expenses,
      investmentAssumptions: s.investmentAssumptions,
      scenarios: s.scenarios,
      results: s.results,
      ui: s.ui,
    };
    const handle = runSimulationsAsync({
      state,
      options: { numSimulations },
      onProgress: (p) => set({ simulationProgress: p }),
    });
    activeRun = handle;

    try {
      const results = await handle.promise;
      const byId: Record<string, SimulationResult> = {};
      for (const r of results) byId[r.scenarioId] = r;

      set((s) => ({
        results: byId,
        ui: { ...s.ui, isSimulating: false, lastRunAt: new Date().toISOString() },
        simulationProgress: 1,
      }));
    } catch (err) {
      set((s) => ({
        ui: { ...s.ui, isSimulating: false },
        simulationProgress: 0,
      }));
      if (err instanceof Error && err.message !== "cancelled") throw err;
    } finally {
      if (activeRun === handle) activeRun = null;
    }
  },

  cancelSimulation: () => {
    activeRun?.cancel();
    activeRun = null;
    set((s) => ({
      ui: { ...s.ui, isSimulating: false },
      simulationProgress: 0,
    }));
  },

  // ── Persistence ──
  importState: (state) => {
    lsSave(state);
    set({
      ...state,
      results: {},
      ui: { ...defaultUIState(), activeScenarioIds: state.scenarios.map((s) => s.id) },
      simulationProgress: 0,
    });
  },

  resetToEmpty: () => {
    lsSave(extractPlanState({ ...emptyState() } as AppStore));
    set(emptyState());
  },
}));
