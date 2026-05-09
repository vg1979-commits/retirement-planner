import type {
  AppState,
  RothConversionSummary,
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
  numSimulations?: number;     // default 1_500
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
// Returns both the projections and the index into the per-run arrays so callers
// can re-use the same Monte Carlo run when computing comparison projections.
function selectMedianPath(
  perRunProjections: AnnualProjection[][],
  finalBalances: number[]
): { projections: AnnualProjection[]; index: number } {
  if (perRunProjections.length === 0) return { projections: [], index: -1 };
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
  return { projections: perRunProjections[bestIdx], index: bestIdx };
}

// ─── Roth conversion summary ─────────────────────────────────────────────────

function buildNarrative(
  totalConverted: number,
  estimatedTaxSavings: number,
  windowStart: number | null,
  windowEnd: number | null,
  optimizerEnabled: boolean,
  hasTraditional: boolean,
  traditionalBalanceAtRMDAge: number
): string {
  if (!optimizerEnabled) {
    return "Roth conversion optimizer is disabled. Enable it to model converting traditional balances to Roth during your retirement window.";
  }
  if (!hasTraditional) {
    return "No traditional retirement balances found, so no conversions are recommended.";
  }
  if (totalConverted === 0 || windowStart === null || windowEnd === null) {
    return "No conversion opportunities found within the target bracket. Try a higher target bracket (24%) to widen the headroom.";
  }
  const windowYears = windowEnd - windowStart + 1;
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const savingsClause = estimatedTaxSavings > 0
    ? ` This strategy is projected to save approximately ${fmt(estimatedTaxSavings)} in lifetime federal taxes versus skipping conversions.`
    : estimatedTaxSavings < 0
      ? ` (Note: in this run, conversions are projected to slightly increase lifetime taxes by ${fmt(-estimatedTaxSavings)} — consider lowering the target bracket.)`
      : "";
  const bombClause = traditionalBalanceAtRMDAge > 2_000_000
    ? ` Without conversions, your traditional balance is projected to reach ${fmt(traditionalBalanceAtRMDAge)} at age 73 — large RMDs may push you into a higher bracket.`
    : "";
  return `Converting ${fmt(totalConverted)} across ${windowYears} year${windowYears === 1 ? "" : "s"} (${windowStart}–${windowEnd}) is recommended.${savingsClause}${bombClause}`;
}

function computeRothSummary(
  state: AppState,
  scenario: Scenario,
  startYear: number,
  baseSeed: number,
  numYears: number,
  medianRunIndex: number,
  withConversionsLifetimeTax: number,
  medianProjections: AnnualProjection[]
): RothConversionSummary {
  const optimizerEnabled = scenario.enableRothOptimizer ?? true;

  // Sum conversions / find conversion window from the median path.
  let totalConverted = 0;
  let windowStart: number | null = null;
  let windowEnd: number | null = null;
  for (const p of medianProjections) {
    if (p.rothConversionAmount > 0) {
      totalConverted += p.rothConversionAmount;
      if (windowStart === null) windowStart = p.year;
      windowEnd = p.year;
    }
  }

  // Re-project the same median Monte Carlo run with the optimizer disabled to
  // get the no-conversion lifetime tax + traditional balance at age 73.
  const baselineRun = generateRun(state.investmentAssumptions, numYears, baseSeed + medianRunIndex);
  const baseline = projectScenario({
    household: state.household,
    accounts: state.accounts,
    incomeStreams: state.incomeStreams,
    expenses: state.expenses,
    investmentAssumptions: state.investmentAssumptions,
    scenario,
    run: baselineRun,
    startYear,
    rothOptimizerOverride: { enabled: false },
  });

  const totalTaxCostWithoutConversions = baseline.lifetimeFederalTax;
  const totalTaxCostWithConversions = withConversionsLifetimeTax;
  const estimatedTaxSavings = totalTaxCostWithoutConversions - totalTaxCostWithConversions;

  const hasTraditional = state.accounts.some(
    (a) => a.type === "traditional_401k" || a.type === "traditional_ira" || a.type === "deferred_comp"
  );

  return {
    totalConverted: Math.round(totalConverted),
    totalTaxCostWithConversions: Math.round(totalTaxCostWithConversions),
    totalTaxCostWithoutConversions: Math.round(totalTaxCostWithoutConversions),
    estimatedTaxSavings: Math.round(estimatedTaxSavings),
    conversionWindowStart: windowStart,
    conversionWindowEnd: windowEnd,
    traditionalBalanceAtRMDAge: Math.round(baseline.traditionalBalanceAtRMDAge),
    narrativeSummary: buildNarrative(
      totalConverted,
      estimatedTaxSavings,
      windowStart,
      windowEnd,
      optimizerEnabled,
      hasTraditional,
      baseline.traditionalBalanceAtRMDAge
    ),
  };
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
  const perRunLifetimeTax: number[] = [];
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
    perRunLifetimeTax.push(result.lifetimeFederalTax);
    finalBalances.push(result.finalBalance);

    // Spec 02 §6: success = portfolio balance > 0 at endYear
    if (!result.depleted && result.finalBalance > 0) successCount++;

    if (onProgress && i > 0 && i % 100 === 0) {
      onProgress(i / numSimulations);
    }
  }

  if (onProgress) onProgress(1);

  const percentiles = extractPercentiles(perRunBalances);
  const { projections: annualProjections, index: medianIndex } = selectMedianPath(
    perRunProjections,
    finalBalances
  );

  const rothConversionSummary = computeRothSummary(
    state,
    scenario,
    startYear,
    baseSeed,
    numYears,
    medianIndex,
    medianIndex >= 0 ? perRunLifetimeTax[medianIndex] : 0,
    annualProjections
  );

  return {
    scenarioId: scenario.id,
    runDate: new Date().toISOString(),
    numSimulations,
    successRate: successCount / numSimulations,
    annualProjections,
    percentiles,
    rothConversionSummary,
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
