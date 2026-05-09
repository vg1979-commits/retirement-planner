import { describe, it, expect } from "vitest";
import { runSimulationsAsync } from "../../src/engine/runner";
import type { AppState, InvestmentAssumptions } from "../../src/types";

// In a Node test environment Worker is undefined, so the runner uses its
// synchronous fallback path. We test that path here.

const ASSUMPTIONS: InvestmentAssumptions = {
  equityMeanReturn: 0.07,
  equityStdDev: 0.15,
  bondMeanReturn: 0.035,
  bondStdDev: 0.06,
  cashReturn: 0.045,
  correlationEquityBond: -0.10,
  inflationRate: 0.025,
  preRetirementAllocation: { equityPct: 0.80, bondPct: 0.15, cashPct: 0.05 },
  postRetirementAllocation: { equityPct: 0.50, bondPct: 0.40, cashPct: 0.10 },
};

function makeState(): AppState {
  return {
    household: {
      id: "h1", name: "Demo", createdAt: "2026-01-01", updatedAt: "2026-01-01",
      spouse1: { name: "S1", birthYear: 1979, currentAge: 47, targetRetirementAge: 60, currentAnnualIncome: 400_000 },
      spouse2: { name: "S2", birthYear: 1980, currentAge: 46, targetRetirementAge: 60, currentAnnualIncome: 300_000 },
      children: [], planningHorizon: { endAge: 95 },
    },
    accounts: [
      { id: "cash1", owner: "joint", type: "cash", label: "Cash", currentBalance: 100_000, annualContribution: 0 },
      { id: "brok1", owner: "joint", type: "brokerage", label: "Brokerage", currentBalance: 1_500_000, annualContribution: 0 },
      { id: "401k1", owner: "spouse1", type: "traditional_401k", label: "401k", currentBalance: 800_000, annualContribution: 23_500 },
    ],
    incomeStreams: [
      { id: "s1", owner: "spouse1", type: "w2_salary", label: "S1", annualAmount: 400_000, startYear: 2026, endYear: 2050, growthRate: 0.03, taxTreatment: "ordinary_income" },
    ],
    expenses: { currentAnnualSpending: 200_000, retirementAnnualSpending: 180_000, inflationRate: 0.025 },
    investmentAssumptions: ASSUMPTIONS,
    scenarios: [],
    results: {},
    ui: { activeView: "inputs", activeScenarioIds: [], isSimulating: false, lastRunAt: null },
  };
}

describe("runSimulationsAsync — fallback path", () => {
  it("resolves with simulation results", async () => {
    const handle = runSimulationsAsync({
      state: makeState(),
      options: { numSimulations: 30, startYear: 2026 },
    });
    const results = await handle.promise;
    expect(results).toHaveLength(1);
    expect(results[0].numSimulations).toBe(30);
  });

  it("calls onProgress at least once and ends at 1", async () => {
    const seen: number[] = [];
    const handle = runSimulationsAsync({
      state: makeState(),
      options: { numSimulations: 200, startYear: 2026 },
      onProgress: (p) => seen.push(p),
    });
    await handle.promise;
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1]).toBe(1);
  });

  it("cancellation rejects the promise with 'cancelled'", async () => {
    const handle = runSimulationsAsync({
      state: makeState(),
      options: { numSimulations: 50, startYear: 2026 },
    });
    handle.cancel();
    await expect(handle.promise).rejects.toThrow(/cancelled/);
  });

  it("does not block synchronously — promise resolves on next tick", async () => {
    let resolved = false;
    const handle = runSimulationsAsync({
      state: makeState(),
      options: { numSimulations: 5, startYear: 2026 },
    });
    handle.promise.then(() => { resolved = true; });
    // Should not have resolved synchronously
    expect(resolved).toBe(false);
    await handle.promise;
    expect(resolved).toBe(true);
  });
});
