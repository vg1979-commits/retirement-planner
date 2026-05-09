import { describe, it, expect } from "vitest";
import { runSimulations } from "../../src/engine";
import type { AppState, InvestmentAssumptions } from "../../src/types";

// ─── Fixture: a high-income dual-W2 family roughly matching the project demo ──

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

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    household: {
      id: "h1",
      name: "Demo Family",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
      spouse1: { name: "S1", birthYear: 1979, currentAge: 47, targetRetirementAge: 60, currentAnnualIncome: 400_000 },
      spouse2: { name: "S2", birthYear: 1980, currentAge: 46, targetRetirementAge: 60, currentAnnualIncome: 300_000 },
      children: [],
      planningHorizon: { endAge: 95 },
    },
    accounts: [
      { id: "cash1", owner: "joint", type: "cash", label: "Cash", currentBalance: 100_000, annualContribution: 0 },
      { id: "brok1", owner: "joint", type: "brokerage", label: "Brokerage", currentBalance: 1_500_000, annualContribution: 0 },
      { id: "401k1", owner: "spouse1", type: "traditional_401k", label: "S1 401k", currentBalance: 800_000, annualContribution: 23_500, employerMatch: 12_000 },
      { id: "401k2", owner: "spouse2", type: "traditional_401k", label: "S2 401k", currentBalance: 600_000, annualContribution: 23_500, employerMatch: 9_000 },
      { id: "roth1", owner: "spouse1", type: "roth_ira", label: "S1 Roth", currentBalance: 200_000, annualContribution: 0 },
    ],
    incomeStreams: [
      { id: "s1w2", owner: "spouse1", type: "w2_salary", label: "S1 W2", annualAmount: 400_000, startYear: 2026, endYear: 2050, growthRate: 0.03, taxTreatment: "ordinary_income" },
      { id: "s2w2", owner: "spouse2", type: "w2_salary", label: "S2 W2", annualAmount: 300_000, startYear: 2026, endYear: 2050, growthRate: 0.03, taxTreatment: "ordinary_income" },
    ],
    expenses: { currentAnnualSpending: 200_000, retirementAnnualSpending: 180_000, copyCurrentToRetirement: false, categories: [] },
    investmentAssumptions: ASSUMPTIONS,
    scenarios: [],
    results: {},
    ui: { activeView: "inputs", activeScenarioIds: [], isSimulating: false, lastRunAt: null },
    ...overrides,
  };
}

// ─── Default behavior ────────────────────────────────────────────────────────

describe("runSimulations — defaults", () => {
  it("produces one result for the implicit base scenario when none defined", () => {
    const results = runSimulations(makeState(), { numSimulations: 50, startYear: 2026 });
    expect(results).toHaveLength(1);
    expect(results[0].scenarioId).toBe("base");
  });

  it("respects provided numSimulations", () => {
    const results = runSimulations(makeState(), { numSimulations: 25, startYear: 2026 });
    expect(results[0].numSimulations).toBe(25);
  });

  it("populates percentile bands matching planning horizon length", () => {
    const results = runSimulations(makeState(), { numSimulations: 10, startYear: 2026 });
    // older spouse born 1979, endAge 95 → 49 years
    expect(results[0].percentiles.p50).toHaveLength(49);
    expect(results[0].percentiles.p10).toHaveLength(49);
  });

  it("annualProjections has one entry per year", () => {
    const results = runSimulations(makeState(), { numSimulations: 10, startYear: 2026 });
    expect(results[0].annualProjections).toHaveLength(49);
  });

  it("p10 ≤ p50 ≤ p90 for every year", () => {
    const results = runSimulations(makeState(), { numSimulations: 100, startYear: 2026 });
    const { p10, p50, p90 } = results[0].percentiles;
    for (let y = 0; y < p50.length; y++) {
      expect(p10[y]).toBeLessThanOrEqual(p50[y]);
      expect(p50[y]).toBeLessThanOrEqual(p90[y]);
    }
  });
});

// ─── Multiple scenarios ──────────────────────────────────────────────────────

describe("runSimulations — multiple scenarios", () => {
  it("returns one result per scenario, keyed by id", () => {
    const state = makeState({
      scenarios: [
        { id: "base", label: "Base", color: "#000" },
        { id: "early", label: "Early", color: "#f00", retirementAgeOverride: { spouse1: 55, spouse2: 55 } },
        { id: "lux",   label: "Lux",   color: "#0f0", annualSpendingOverride: 350_000 },
      ],
    });
    const results = runSimulations(state, { numSimulations: 25, startYear: 2026 });
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.scenarioId)).toEqual(["base", "early", "lux"]);
  });

  it("higher-spending scenario has lower success rate than base", () => {
    const base = runSimulations(
      makeState({ scenarios: [{ id: "base", label: "Base", color: "#000" }] }),
      { numSimulations: 200, startYear: 2026, baseSeed: 7 }
    );
    const lux = runSimulations(
      makeState({
        scenarios: [{
          id: "lux", label: "Lux", color: "#0f0",
          annualSpendingOverride: 500_000,
        }],
      }),
      { numSimulations: 200, startYear: 2026, baseSeed: 7 }
    );
    expect(lux[0].successRate).toBeLessThanOrEqual(base[0].successRate);
  });
});

// ─── Success rate ─────────────────────────────────────────────────────────────

describe("runSimulations — success rate", () => {
  it("is between 0 and 1", () => {
    const results = runSimulations(makeState(), { numSimulations: 100, startYear: 2026 });
    expect(results[0].successRate).toBeGreaterThanOrEqual(0);
    expect(results[0].successRate).toBeLessThanOrEqual(1);
  });

  it("well-funded plan achieves high success rate", () => {
    const results = runSimulations(makeState(), {
      numSimulations: 200,
      startYear: 2026,
      baseSeed: 7,
    });
    // ~$3.2M starting, dual high incomes through age 60, modest retirement spend
    expect(results[0].successRate).toBeGreaterThan(0.80);
  });

  it("under-funded plan has low success rate", () => {
    const state = makeState({
      accounts: [
        { id: "cash1", owner: "joint", type: "cash", label: "Cash", currentBalance: 50_000, annualContribution: 0 },
      ],
      incomeStreams: [],
      expenses: { currentAnnualSpending: 200_000, retirementAnnualSpending: 200_000, copyCurrentToRetirement: false, categories: [] },
    });
    const results = runSimulations(state, { numSimulations: 50, startYear: 2026 });
    expect(results[0].successRate).toBeLessThan(0.20);
  });
});

// ─── Roth conversion summary ─────────────────────────────────────────────────

describe("runSimulations — rothConversionSummary", () => {
  it("includes a rothConversionSummary on every result", () => {
    const results = runSimulations(makeState(), { numSimulations: 30, startYear: 2026, baseSeed: 7 });
    const s = results[0].rothConversionSummary;
    expect(s).toBeDefined();
    expect(typeof s.totalConverted).toBe("number");
    expect(typeof s.estimatedTaxSavings).toBe("number");
    expect(typeof s.narrativeSummary).toBe("string");
    expect(s.narrativeSummary.length).toBeGreaterThan(0);
  });

  it("optimizer ON (default) produces non-zero conversions for a high-trad-balance family", () => {
    // Default scenario has optimizer enabled. Family has $1.4M traditional;
    // both retire at 60; RMDs at 73 → 13-year window. Should hit some conversions.
    const results = runSimulations(makeState(), { numSimulations: 30, startYear: 2026, baseSeed: 7 });
    const s = results[0].rothConversionSummary;
    expect(s.totalConverted).toBeGreaterThan(0);
    expect(s.conversionWindowStart).not.toBeNull();
    expect(s.conversionWindowEnd).not.toBeNull();
  });

  it("optimizer OFF on the scenario disables conversions and explains in narrative", () => {
    const state = makeState({
      scenarios: [
        { id: "no-roth", label: "No Conversions", color: "#888", enableRothOptimizer: false },
      ],
    });
    const results = runSimulations(state, { numSimulations: 30, startYear: 2026, baseSeed: 7 });
    const s = results[0].rothConversionSummary;
    expect(s.totalConverted).toBe(0);
    expect(s.conversionWindowStart).toBeNull();
    expect(s.narrativeSummary).toMatch(/disabled/i);
  });

  it("with no traditional balances, summary surfaces that fact", () => {
    const state = makeState({
      accounts: [
        { id: "cash1", owner: "joint", type: "cash", label: "Cash", currentBalance: 100_000, annualContribution: 0 },
        { id: "brok1", owner: "joint", type: "brokerage", label: "Brokerage", currentBalance: 1_500_000, annualContribution: 0 },
        { id: "roth1", owner: "spouse1", type: "roth_ira", label: "Roth", currentBalance: 200_000, annualContribution: 0 },
      ],
    });
    const results = runSimulations(state, { numSimulations: 20, startYear: 2026, baseSeed: 7 });
    const s = results[0].rothConversionSummary;
    expect(s.totalConverted).toBe(0);
    expect(s.narrativeSummary).toMatch(/no traditional/i);
  });

  it("annualProjections rows expose roth conversion fields", () => {
    const results = runSimulations(makeState(), { numSimulations: 20, startYear: 2026, baseSeed: 7 });
    const proj = results[0].annualProjections;
    // Every row must have the new spec-04 §3.4 fields populated (even if zero).
    for (const p of proj) {
      expect(typeof p.rothConversionAmount).toBe("number");
      expect(typeof p.rmdAmount).toBe("number");
      expect(typeof p.traditionalBalanceStart).toBe("number");
      expect(typeof p.marginalRate).toBe("number");
      expect(typeof p.irmaaWarning).toBe("boolean");
    }
    // At least one post-retirement year should carry a rationale string when
    // the optimizer is on.
    const hasRationale = proj.some((p) => typeof p.conversionRationale === "string" && p.conversionRationale.length > 0);
    expect(hasRationale).toBe(true);
  });
});

// ─── Determinism & seeding ───────────────────────────────────────────────────

describe("runSimulations — determinism", () => {
  it("identical calls produce identical results", () => {
    const a = runSimulations(makeState(), { numSimulations: 30, startYear: 2026, baseSeed: 1 });
    const b = runSimulations(makeState(), { numSimulations: 30, startYear: 2026, baseSeed: 1 });
    expect(a[0].successRate).toBe(b[0].successRate);
    expect(a[0].percentiles.p50).toEqual(b[0].percentiles.p50);
  });

  it("different seeds produce different runs", () => {
    const a = runSimulations(makeState(), { numSimulations: 30, startYear: 2026, baseSeed: 1 });
    const b = runSimulations(makeState(), { numSimulations: 30, startYear: 2026, baseSeed: 2 });
    expect(a[0].percentiles.p50).not.toEqual(b[0].percentiles.p50);
  });
});

// ─── Progress callback ───────────────────────────────────────────────────────

describe("runSimulations — progress callback", () => {
  it("invokes onProgress and ends at 1", () => {
    const seen: number[] = [];
    runSimulations(makeState(), {
      numSimulations: 250,
      startYear: 2026,
      onProgress: (p) => seen.push(p),
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1]).toBe(1);
  });

  it("progress is monotonically non-decreasing", () => {
    const seen: number[] = [];
    runSimulations(makeState(), {
      numSimulations: 200,
      startYear: 2026,
      onProgress: (p) => seen.push(p),
    });
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    }
  });
});

// ─── Result metadata ─────────────────────────────────────────────────────────

describe("runSimulations — result metadata", () => {
  it("runDate is a valid ISO string", () => {
    const results = runSimulations(makeState(), { numSimulations: 10, startYear: 2026 });
    expect(() => new Date(results[0].runDate).toISOString()).not.toThrow();
  });
});
