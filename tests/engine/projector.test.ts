import { describe, it, expect } from "vitest";
import { projectScenario, type ProjectorInput } from "../../src/engine/projector";
import { generateRun } from "../../src/engine/monteCarlo";
import type {
  HouseholdProfile,
  InvestmentAssumptions,
  AssetAllocation,
} from "../../src/types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

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

// Deterministic flat-return run: equity always 7%, bond 3.5%, cash 4.5%
function makeFlatRun(numYears: number) {
  const flatYear = {
    equity: 0.07,
    bond: 0.035,
    cash: 0.045,
    blended: (a: AssetAllocation) =>
      0.07 * a.equityPct + 0.035 * a.bondPct + 0.045 * a.cashPct,
  };
  return { returns: Array.from({ length: numYears }, () => flatYear) };
}

function makeHousehold(overrides: Partial<HouseholdProfile> = {}): HouseholdProfile {
  return {
    id: "h1",
    name: "Test Family",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    spouse1: {
      name: "S1",
      birthYear: 1979,
      currentAge: 47,
      targetRetirementAge: 60,
      currentAnnualIncome: 400_000,
    },
    spouse2: {
      name: "S2",
      birthYear: 1980,
      currentAge: 46,
      targetRetirementAge: 60,
      currentAnnualIncome: 300_000,
    },
    children: [],
    planningHorizon: { endAge: 95 },
    ...overrides,
  };
}

function makeBaseInput(overrides: Partial<ProjectorInput> = {}): ProjectorInput {
  const household = overrides.household ?? makeHousehold();
  const startYear = 2026;
  const endYear = Math.min(household.spouse1.birthYear, household.spouse2.birthYear) + household.planningHorizon.endAge;
  const numYears = endYear - startYear + 1;

  return {
    household,
    accounts: [
      { id: "cash1", owner: "joint", type: "cash", label: "Joint Cash", currentBalance: 100_000, annualContribution: 0 },
      { id: "brok1", owner: "joint", type: "brokerage", label: "Joint Brokerage", currentBalance: 1_000_000, annualContribution: 0 },
      { id: "401k1", owner: "spouse1", type: "traditional_401k", label: "S1 401k", currentBalance: 800_000, annualContribution: 23_500, employerMatch: 12_000 },
      { id: "401k2", owner: "spouse2", type: "traditional_401k", label: "S2 401k", currentBalance: 600_000, annualContribution: 23_500, employerMatch: 9_000 },
      { id: "roth1", owner: "spouse1", type: "roth_ira", label: "S1 Roth", currentBalance: 200_000, annualContribution: 0 },
    ],
    incomeStreams: [
      { id: "s1w2", owner: "spouse1", type: "w2_salary", label: "S1 W2", annualAmount: 400_000, startYear: 2026, endYear: 2050, growthRate: 0.03, taxTreatment: "ordinary_income" },
      { id: "s2w2", owner: "spouse2", type: "w2_salary", label: "S2 W2", annualAmount: 300_000, startYear: 2026, endYear: 2050, growthRate: 0.03, taxTreatment: "ordinary_income" },
    ],
    expenses: {
      currentAnnualSpending: 200_000,
      retirementAnnualSpending: 180_000,
      inflationRate: 0.025,
      categories: [],
    },
    investmentAssumptions: ASSUMPTIONS,
    run: makeFlatRun(numYears),
    startYear,
    ...overrides,
  };
}

// ─── Output shape ─────────────────────────────────────────────────────────────

describe("projectScenario — output shape", () => {
  it("produces one projection per year through endAge", () => {
    const result = projectScenario(makeBaseInput());
    // older spouse born 1979, endAge 95 → 2074
    // start 2026 → 49 years
    expect(result.annualProjections).toHaveLength(2074 - 2026 + 1);
  });

  it("first projection ages match start year", () => {
    const result = projectScenario(makeBaseInput());
    expect(result.annualProjections[0].year).toBe(2026);
    expect(result.annualProjections[0].age_spouse1).toBe(2026 - 1979);
    expect(result.annualProjections[0].age_spouse2).toBe(2026 - 1980);
  });

  it("yearlyEndBalances aligns with annualProjections length", () => {
    const result = projectScenario(makeBaseInput());
    expect(result.yearlyEndBalances).toHaveLength(result.annualProjections.length);
    for (let i = 0; i < result.annualProjections.length; i++) {
      expect(result.yearlyEndBalances[i]).toBe(result.annualProjections[i].portfolioEndBalance);
    }
  });
});

// ─── Accumulation phase ───────────────────────────────────────────────────────

describe("projectScenario — accumulation phase", () => {
  it("portfolio grows during working years", () => {
    const result = projectScenario(makeBaseInput());
    const yr0 = result.annualProjections[0];
    const yr5 = result.annualProjections[5];
    expect(yr5.portfolioEndBalance).toBeGreaterThan(yr0.portfolioEndBalance);
  });

  it("contributions reflect 401k limits + employer match (per spouse)", () => {
    const result = projectScenario(makeBaseInput());
    const yr0 = result.annualProjections[0];
    // 23.5k × 2 = 47k employee contributions (employer match is added to balance,
    // not counted in `contributions` total — that's just the employee/owner side)
    expect(yr0.contributions).toBe(47_000);
  });

  it("federal tax > 0 for high earners", () => {
    const result = projectScenario(makeBaseInput());
    expect(result.annualProjections[0].federalTax).toBeGreaterThan(50_000);
    expect(result.annualProjections[0].effectiveTaxRate).toBeGreaterThan(0.10);
  });
});

// ─── Retirement transition ───────────────────────────────────────────────────

describe("projectScenario — retirement transition", () => {
  it("earned income drops after both spouses retire", () => {
    const result = projectScenario(makeBaseInput());
    // S1 retires 2039 (age 60), S2 retires 2040 (age 60)
    const preRet = result.annualProjections.find((p) => p.year === 2038);
    const postRet = result.annualProjections.find((p) => p.year === 2042);
    expect(preRet!.earnedIncome).toBeGreaterThan(500_000);
    expect(postRet!.earnedIncome).toBeLessThan(50_000);
  });

  it("withdrawals begin once income is insufficient", () => {
    const result = projectScenario(makeBaseInput());
    const postRetYears = result.annualProjections.filter((p) => p.year >= 2045);
    const someWithdrew = postRetYears.some((p) => p.withdrawals > 0);
    expect(someWithdrew).toBe(true);
  });

  it("respects scenario.retirementAgeOverride", () => {
    const input = makeBaseInput({
      scenario: {
        id: "early",
        label: "Early Retire",
        color: "#000",
        retirementAgeOverride: { spouse1: 55, spouse2: 55 },
      },
    });
    const result = projectScenario(input);
    // S1 retires 1979+55 = 2034
    const preRet = result.annualProjections.find((p) => p.year === 2033);
    const postRet = result.annualProjections.find((p) => p.year === 2036);
    expect(preRet!.earnedIncome).toBeGreaterThan(500_000);
    expect(postRet!.earnedIncome).toBeLessThan(50_000);
  });
});

// ─── Scenario expense overrides ───────────────────────────────────────────────

describe("projectScenario — scenario overrides", () => {
  it("annualSpendingOverride changes retirement expenses", () => {
    const baseResult = projectScenario(makeBaseInput());
    const highSpendResult = projectScenario(
      makeBaseInput({
        scenario: {
          id: "lux",
          label: "Lux",
          color: "#f00",
          annualSpendingOverride: 400_000,
        },
      })
    );
    const baseLate = baseResult.annualProjections.find((p) => p.year === 2050)!;
    const luxLate = highSpendResult.annualProjections.find((p) => p.year === 2050)!;
    expect(luxLate.totalExpenses).toBeGreaterThan(baseLate.totalExpenses);
  });

  it("additionalOneTimeExpenses appear in the targeted year only", () => {
    const result = projectScenario(
      makeBaseInput({
        scenario: {
          id: "house",
          label: "Beach House",
          color: "#0f0",
          additionalOneTimeExpenses: [{ label: "Beach house", year: 2030, amount: 800_000 }],
        },
      })
    );
    const yr2030 = result.annualProjections.find((p) => p.year === 2030)!;
    const yr2031 = result.annualProjections.find((p) => p.year === 2031)!;
    expect(yr2030.totalExpenses).toBeGreaterThan(yr2031.totalExpenses + 700_000);
  });
});

// ─── Inflation behavior ──────────────────────────────────────────────────────

describe("projectScenario — inflation", () => {
  it("expenses grow over time at inflation rate", () => {
    const result = projectScenario(makeBaseInput());
    const yr0 = result.annualProjections[0];
    const yr10 = result.annualProjections[10];
    // 10 years of 2.5% inflation ≈ 1.28x
    expect(yr10.totalExpenses / yr0.totalExpenses).toBeGreaterThan(1.20);
    expect(yr10.totalExpenses / yr0.totalExpenses).toBeLessThan(1.35);
  });
});

// ─── Depletion detection ─────────────────────────────────────────────────────

describe("projectScenario — depletion", () => {
  it("flags depleted when starting balance is too low for expenses", () => {
    const household = makeHousehold({
      spouse1: { name: "S1", birthYear: 1960, currentAge: 66, targetRetirementAge: 60, currentAnnualIncome: 0 },
      spouse2: { name: "S2", birthYear: 1961, currentAge: 65, targetRetirementAge: 60, currentAnnualIncome: 0 },
    });
    const startYear = 2026;
    const endYear = 1960 + 95;
    const numYears = endYear - startYear + 1;
    const input: ProjectorInput = {
      household,
      accounts: [
        { id: "cash1", owner: "joint", type: "cash", label: "Cash", currentBalance: 50_000, annualContribution: 0 },
      ],
      incomeStreams: [],
      expenses: {
        currentAnnualSpending: 200_000,
        retirementAnnualSpending: 200_000,
        inflationRate: 0.025,
        categories: [],
      },
      investmentAssumptions: ASSUMPTIONS,
      run: makeFlatRun(numYears),
      startYear,
    };
    const result = projectScenario(input);
    expect(result.depleted).toBe(true);
  });

  it("not depleted with adequate balance and reasonable spending", () => {
    const result = projectScenario(makeBaseInput());
    // High earners contributing $47k/yr with $1M brokerage and 7% returns
    expect(result.depleted).toBe(false);
  });
});

// ─── Determinism ─────────────────────────────────────────────────────────────

describe("projectScenario — determinism", () => {
  it("same inputs produce identical output", () => {
    const a = projectScenario(makeBaseInput());
    const b = projectScenario(makeBaseInput());
    expect(a.finalBalance).toBe(b.finalBalance);
    expect(a.depleted).toBe(b.depleted);
  });

  it("works with stochastic Monte Carlo run", () => {
    const household = makeHousehold();
    const startYear = 2026;
    const endYear = Math.min(household.spouse1.birthYear, household.spouse2.birthYear) + household.planningHorizon.endAge;
    const numYears = endYear - startYear + 1;
    const result = projectScenario({
      ...makeBaseInput({ household }),
      run: generateRun(ASSUMPTIONS, numYears, 42),
    });
    expect(result.annualProjections.length).toBe(numYears);
    expect(isFinite(result.finalBalance)).toBe(true);
  });
});
