import { create } from "zustand";
import type {
  Account,
  AppState,
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
  DEMO_HOUSEHOLD,
  DEMO_ACCOUNTS,
  DEMO_INCOME_STREAMS,
  DEMO_EXPENSES,
  DEMO_INVESTMENT_ASSUMPTIONS,
  DEMO_SCENARIOS,
} from "./demoData";

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

  // Reset to demo
  resetToDemo: () => void;
}

export type AppStore = AppState & AppActions & {
  /** 0–1, only meaningful while ui.isSimulating is true. */
  simulationProgress: number;
};

// ─── Initial state ────────────────────────────────────────────────────────────

function defaultUIState(): UIState {
  return {
    activeView: "inputs",
    activeScenarioIds: DEMO_SCENARIOS.map((s) => s.id),
    isSimulating: false,
    lastRunAt: null,
  };
}

function initialState(): Omit<AppStore, keyof AppActions> {
  return {
    household: DEMO_HOUSEHOLD,
    accounts: DEMO_ACCOUNTS,
    incomeStreams: DEMO_INCOME_STREAMS,
    expenses: DEMO_EXPENSES,
    investmentAssumptions: DEMO_INVESTMENT_ASSUMPTIONS,
    scenarios: DEMO_SCENARIOS,
    results: {},
    ui: defaultUIState(),
    simulationProgress: 0,
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

let activeRun: { cancel: () => void } | null = null;

export const useAppStore = create<AppStore>((set, get) => ({
  ...initialState(),

  // ── Household ──
  updateHousehold: (patch) =>
    set((s) => ({ household: { ...s.household, ...patch, updatedAt: new Date().toISOString() } })),

  // ── Accounts ──
  upsertAccount: (account) =>
    set((s) => {
      const existing = s.accounts.findIndex((a) => a.id === account.id);
      const next = [...s.accounts];
      if (existing >= 0) next[existing] = account;
      else next.push(account);
      return { accounts: next };
    }),

  removeAccount: (id) =>
    set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) })),

  // ── Income streams ──
  upsertIncomeStream: (stream) =>
    set((s) => {
      const existing = s.incomeStreams.findIndex((i) => i.id === stream.id);
      const next = [...s.incomeStreams];
      if (existing >= 0) next[existing] = stream;
      else next.push(stream);
      return { incomeStreams: next };
    }),

  removeIncomeStream: (id) =>
    set((s) => ({ incomeStreams: s.incomeStreams.filter((i) => i.id !== id) })),

  // ── Expenses & assumptions ──
  updateExpenses: (patch) =>
    set((s) => ({ expenses: { ...s.expenses, ...patch } })),

  updateAssumptions: (patch) =>
    set((s) => ({ investmentAssumptions: { ...s.investmentAssumptions, ...patch } })),

  // ── Scenarios ──
  upsertScenario: (scenario) =>
    set((s) => {
      const existing = s.scenarios.findIndex((sc) => sc.id === scenario.id);
      const next = [...s.scenarios];
      if (existing >= 0) next[existing] = scenario;
      else next.push(scenario);
      return { scenarios: next };
    }),

  removeScenario: (id) =>
    set((s) => ({
      scenarios: s.scenarios.filter((sc) => sc.id !== id),
      ui: {
        ...s.ui,
        activeScenarioIds: s.ui.activeScenarioIds.filter((sid) => sid !== id),
      },
      results: Object.fromEntries(
        Object.entries(s.results).filter(([sid]) => sid !== id)
      ),
    })),

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
      // On cancel or error: reset the simulating flag, leave existing results in place.
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

  // ── Reset ──
  resetToDemo: () => set(initialState()),
}));
