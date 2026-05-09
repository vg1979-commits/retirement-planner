import type {
  AppState,
  Scenario,
  SimulationResult,
  AnnualProjection,
} from "../types";
import { projectScenario, type ProjectorInput } from "./projector";
import {
  generateRun,
  extractPercentiles,
  type SimulationRun,
} from "./monteCarlo";
import { DEFAULT_NUM_SIMULATIONS } from "./constants";

// ─── Public options ──────────────────────────────────────────────────────────

export interface RunOptions {
  numSimulations?: number;     // default 1_000
  baseSeed?: number;           // default 42
  startYear?: number;          // default = current calendar year
  onProgress?: (progress: number) => void; // 0–1, called periodically
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultStartYear(): number {
  return new Date().getFullYear();
}

// Build the implicit "base case" scenario when none have been defined.
function defaultScenario(): Scenario {
  return {
    id: "base",
    label: "Base Case",
    color: "#2563eb",
  };
}

function computePlanningYears(state: AppState, startYear: number): number {
  const olderBirth = Math.min(
    state.household.spouse1.birthYear,
    state.household.spouse2.birthYear
  );
  const endYear = olderBirth + state.household.planningHorizon.endAge;
  return endYear - startYear + 1;
}

// Pick the run whose final balance is closest to the median final balance.
function selectMedianPath(
  perRunProjections: AnnualProjection[][],
  finalBalances: number[]
): AnnualProjection[] {
  if (perRunProjections.length === 0) return [];
  const sorted = [...finalBalances].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  let bestIdx = 0;
  let bestDelta = Infinity;
  for (let i = 0; i < finalBalances.length; i++) {
    const delta = Math.abs(finalBalances[i] - median);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIdx = i;
    }
  }
  return perRunProjections[bestIdx];
}

// ─── Run a single scenario across N Monte Carlo runs ─────────────────────────

function runScenario(
  state: AppState,
  scenario: Scenario,
  options: Required<Pick<RunOptions, "numSimulations" | "baseSeed" | "startYear">> & {
    onProgress?: (p: number) => void;
  }
): SimulationResult {
  const { numSimulations, baseSeed, startYear, onProgress } = options;
  const numYears = computePlanningYears(state, startYear);

  const perRunBalances: number[][] = [];
  const perRunProjections: AnnualProjection[][] = [];
  const finalBalances: number[] = [];
  let successCount = 0;

  for (let i = 0; i < numSimulations; i++) {
    const run: SimulationRun = generateRun(
      state.investmentAssumptions,
      numYears,
      baseSeed + i
    );

    const input: ProjectorInput = {
      household: state.household,
      accounts: state.accounts,
      incomeStreams: state.incomeStreams,
      expenses: state.expenses,
      investmentAssumptions: state.investmentAssumptions,
      scenario,
      run,
      startYear,
    };

    const result = projectScenario(input);

    perRunBalances.push(result.yearlyEndBalances);
    perRunProjections.push(result.annualProjections);
    finalBalances.push(result.finalBalance);

    // Spec 02 §6: success = portfolio balance > 0 at endYear
    if (!result.depleted && result.finalBalance > 0) successCount++;

    if (onProgress && i > 0 && i % 100 === 0) {
      onProgress(i / numSimulations);
    }
  }

  if (onProgress) onProgress(1);

  const percentiles = extractPercentiles(perRunBalances);
  const annualProjections = selectMedianPath(perRunProjections, finalBalances);

  return {
    scenarioId: scenario.id,
    runDate: new Date().toISOString(),
    numSimulations,
    successRate: successCount / numSimulations,
    annualProjections,
    percentiles,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function runSimulations(
  state: AppState,
  options: RunOptions = {}
): SimulationResult[] {
  const numSimulations = options.numSimulations ?? DEFAULT_NUM_SIMULATIONS;
  const baseSeed = options.baseSeed ?? 42;
  const startYear = options.startYear ?? defaultStartYear();

  const scenarios = state.scenarios.length > 0 ? state.scenarios : [defaultScenario()];
  const results: SimulationResult[] = [];

  for (let s = 0; s < scenarios.length; s++) {
    const scenario = scenarios[s];

    // Each scenario gets its own progress slice of [0, 1]
    const scenarioProgress = options.onProgress
      ? (p: number) => options.onProgress!(s / scenarios.length + p / scenarios.length)
      : undefined;

    results.push(
      runScenario(state, scenario, {
        numSimulations,
        baseSeed: baseSeed + s * 1_000_003, // distinct seed stream per scenario
        startYear,
        onProgress: scenarioProgress,
      })
    );
  }

  return results;
}
