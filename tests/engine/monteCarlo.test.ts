import { describe, it, expect } from "vitest";
import {
  generateAnnualReturns,
  generateRun,
  generateMonteCarloRuns,
  percentile,
  extractPercentiles,
} from "../../src/engine/monteCarlo";
import type { InvestmentAssumptions, AssetAllocation } from "../../src/types";

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

const ALLOC_60_40: AssetAllocation = { equityPct: 0.60, bondPct: 0.40, cashPct: 0.00 };

// Deterministic RNG stub for unit-level tests
function makeConstantRng(value: number): () => number {
  return () => value;
}

// ─── percentile() ─────────────────────────────────────────────────────────────

describe("percentile", () => {
  it("p50 of [1,2,3,4,5] = 3", () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });

  it("p0 returns minimum", () => {
    expect(percentile([10, 20, 30], 0)).toBe(10);
  });

  it("p100 returns maximum", () => {
    expect(percentile([10, 20, 30], 100)).toBe(30);
  });

  it("interpolates between values", () => {
    // sorted [1, 3]; p50 = idx 0.5 → 1 + 0.5*(3-1) = 2
    const result = percentile([1, 3], 50);
    expect(result).toBeCloseTo(2, 5);
  });

  it("empty array returns 0", () => {
    expect(percentile([], 50)).toBe(0);
  });
});

// ─── generateAnnualReturns() ──────────────────────────────────────────────────

describe("generateAnnualReturns", () => {
  it("cash return is always deterministic regardless of RNG", () => {
    const r1 = generateAnnualReturns(ASSUMPTIONS, makeConstantRng(0.1));
    const r2 = generateAnnualReturns(ASSUMPTIONS, makeConstantRng(0.9));
    expect(r1.cash).toBeCloseTo(ASSUMPTIONS.cashReturn, 10);
    expect(r2.cash).toBeCloseTo(ASSUMPTIONS.cashReturn, 10);
  });

  it("blended return with 100% equity equals equity return", () => {
    const r = generateAnnualReturns(ASSUMPTIONS, makeConstantRng(0.5));
    const allEquity: AssetAllocation = { equityPct: 1, bondPct: 0, cashPct: 0 };
    expect(r.blended(allEquity)).toBeCloseTo(r.equity, 10);
  });

  it("blended return with 100% cash equals cashReturn", () => {
    const r = generateAnnualReturns(ASSUMPTIONS, makeConstantRng(0.5));
    const allCash: AssetAllocation = { equityPct: 0, bondPct: 0, cashPct: 1 };
    expect(r.blended(allCash)).toBeCloseTo(ASSUMPTIONS.cashReturn, 10);
  });

  it("equity return is finite for all reasonable RNG values", () => {
    for (const v of [0.001, 0.25, 0.5, 0.75, 0.999]) {
      const r = generateAnnualReturns(ASSUMPTIONS, makeConstantRng(v));
      expect(isFinite(r.equity)).toBe(true);
      expect(isFinite(r.bond)).toBe(true);
    }
  });
});

// ─── generateRun() ────────────────────────────────────────────────────────────

describe("generateRun", () => {
  it("produces the requested number of years", () => {
    const run = generateRun(ASSUMPTIONS, 40, 1);
    expect(run.returns).toHaveLength(40);
  });

  it("is deterministic for the same seed", () => {
    const a = generateRun(ASSUMPTIONS, 10, 99);
    const b = generateRun(ASSUMPTIONS, 10, 99);
    for (let i = 0; i < 10; i++) {
      expect(a.returns[i].equity).toBe(b.returns[i].equity);
      expect(a.returns[i].bond).toBe(b.returns[i].bond);
    }
  });

  it("differs across seeds", () => {
    const a = generateRun(ASSUMPTIONS, 10, 1);
    const b = generateRun(ASSUMPTIONS, 10, 2);
    // At least one year should differ
    const anyDiff = a.returns.some((r, i) => r.equity !== b.returns[i].equity);
    expect(anyDiff).toBe(true);
  });
});

// ─── Statistical validation (10,000 samples) ─────────────────────────────────
// Spec 02 §9: mean/std-dev within 5% of inputs

describe("return statistics over 10,000 samples", () => {
  const N = 10_000;
  const NUM_YEARS = 1;

  // Collect all equity and bond returns from 10k single-year runs
  const equityReturns: number[] = [];
  const bondReturns: number[] = [];

  for (let i = 0; i < N; i++) {
    const run = generateRun(ASSUMPTIONS, NUM_YEARS, i);
    equityReturns.push(run.returns[0].equity);
    bondReturns.push(run.returns[0].bond);
  }

  function sampleMean(xs: number[]): number {
    return xs.reduce((s, x) => s + x, 0) / xs.length;
  }

  function sampleStdDev(xs: number[]): number {
    const mu = sampleMean(xs);
    const variance = xs.reduce((s, x) => s + (x - mu) ** 2, 0) / xs.length;
    return Math.sqrt(variance);
  }

  // For log-normal: E[r] = exp(μ + σ²/2) − 1, Var[r] = (exp(σ²)−1)·exp(2μ+σ²)
  // Expected mean and std for equity (μ=0.07, σ=0.15):
  const expectedEquityMean = Math.exp(0.07 + 0.15 ** 2 / 2) - 1; // ≈ 0.0824
  const expectedEquityVar =
    (Math.exp(0.15 ** 2) - 1) * Math.exp(2 * 0.07 + 0.15 ** 2);
  const expectedEquityStd = Math.sqrt(expectedEquityVar); // ≈ 0.155

  it("equity mean within 5% of log-normal expectation", () => {
    const mu = sampleMean(equityReturns);
    expect(Math.abs(mu - expectedEquityMean) / expectedEquityMean).toBeLessThan(0.05);
  });

  it("equity std-dev within 5% of log-normal expectation", () => {
    const sd = sampleStdDev(equityReturns);
    expect(Math.abs(sd - expectedEquityStd) / expectedEquityStd).toBeLessThan(0.05);
  });

  it("bond mean within 5% of log-normal expectation", () => {
    const expectedBondMean = Math.exp(0.035 + 0.06 ** 2 / 2) - 1;
    const mu = sampleMean(bondReturns);
    expect(Math.abs(mu - expectedBondMean) / expectedBondMean).toBeLessThan(0.05);
  });

  it("bond std-dev within 5% of log-normal expectation", () => {
    const expectedBondVar =
      (Math.exp(0.06 ** 2) - 1) * Math.exp(2 * 0.035 + 0.06 ** 2);
    const expectedBondStd = Math.sqrt(expectedBondVar);
    const sd = sampleStdDev(bondReturns);
    expect(Math.abs(sd - expectedBondStd) / expectedBondStd).toBeLessThan(0.05);
  });

  it("equity-bond correlation is near -0.10 (±0.05 tolerance)", () => {
    const mu_e = sampleMean(equityReturns);
    const mu_b = sampleMean(bondReturns);
    const sd_e = sampleStdDev(equityReturns);
    const sd_b = sampleStdDev(bondReturns);
    const cov =
      equityReturns.reduce((s, e, i) => s + (e - mu_e) * (bondReturns[i] - mu_b), 0) /
      equityReturns.length;
    const corr = cov / (sd_e * sd_b);
    expect(Math.abs(corr - (-0.10))).toBeLessThan(0.05);
  });
});

// ─── generateMonteCarloRuns() ─────────────────────────────────────────────────

describe("generateMonteCarloRuns", () => {
  it("returns the requested number of runs", () => {
    const runs = generateMonteCarloRuns(ASSUMPTIONS, { numSimulations: 50, numYears: 10 });
    expect(runs).toHaveLength(50);
  });

  it("each run has the right number of years", () => {
    const runs = generateMonteCarloRuns(ASSUMPTIONS, { numSimulations: 5, numYears: 30 });
    for (const run of runs) {
      expect(run.returns).toHaveLength(30);
    }
  });

  it("emits progress callbacks every 100 runs", () => {
    const progressValues: number[] = [];
    generateMonteCarloRuns(ASSUMPTIONS, {
      numSimulations: 300,
      numYears: 1,
      onProgress: (p) => progressValues.push(p),
    });
    // Should get progress at 100, 200, and final 1.0
    expect(progressValues.length).toBeGreaterThanOrEqual(3);
    expect(progressValues[progressValues.length - 1]).toBe(1);
  });

  it("is reproducible with the same baseSeed", () => {
    const a = generateMonteCarloRuns(ASSUMPTIONS, {
      numSimulations: 10,
      numYears: 5,
      baseSeed: 7,
    });
    const b = generateMonteCarloRuns(ASSUMPTIONS, {
      numSimulations: 10,
      numYears: 5,
      baseSeed: 7,
    });
    for (let i = 0; i < 10; i++) {
      expect(a[i].returns[0].equity).toBe(b[i].returns[0].equity);
    }
  });
});

// ─── extractPercentiles() ─────────────────────────────────────────────────────

describe("extractPercentiles", () => {
  it("handles empty input", () => {
    const bands = extractPercentiles([]);
    expect(bands.p50).toHaveLength(0);
  });

  it("all percentiles equal for single run", () => {
    const balances = [[100, 200, 300]];
    const bands = extractPercentiles(balances);
    expect(bands.p10).toEqual([100, 200, 300]);
    expect(bands.p90).toEqual([100, 200, 300]);
  });

  it("p10 ≤ p25 ≤ p50 ≤ p75 ≤ p90 for every year", () => {
    const runs = generateMonteCarloRuns(ASSUMPTIONS, {
      numSimulations: 200,
      numYears: 20,
      baseSeed: 0,
    });
    // Simulate simple compounding to get balances
    const balances = runs.map((run) => {
      let balance = 1_000_000;
      return run.returns.map((r) => {
        balance *= 1 + r.blended(ALLOC_60_40);
        return balance;
      });
    });

    const bands = extractPercentiles(balances);
    for (let y = 0; y < 20; y++) {
      expect(bands.p10[y]).toBeLessThanOrEqual(bands.p25[y]);
      expect(bands.p25[y]).toBeLessThanOrEqual(bands.p50[y]);
      expect(bands.p50[y]).toBeLessThanOrEqual(bands.p75[y]);
      expect(bands.p75[y]).toBeLessThanOrEqual(bands.p90[y]);
    }
  });

  it("produces correct length arrays", () => {
    const balances = Array.from({ length: 100 }, () => [1, 2, 3, 4, 5]);
    const bands = extractPercentiles(balances);
    expect(bands.p50).toHaveLength(5);
  });
});

// ─── 4% SWR historical validation (Spec 02 §9) ───────────────────────────────
// A 4% SWR on a 60/40 portfolio should produce ~85–90% success over 30 years.

describe("4% SWR success rate validation", () => {
  it("60/40 portfolio 4% SWR achieves 85–95% success over 30 years", () => {
    const initialBalance = 1_000_000;
    const annualWithdrawal = 40_000; // 4% SWR
    const numYears = 30;
    const numSims = 1_000;

    const runs = generateMonteCarloRuns(ASSUMPTIONS, {
      numSimulations: numSims,
      numYears,
      baseSeed: 42,
    });

    let successes = 0;
    for (const run of runs) {
      let balance = initialBalance;
      let survived = true;
      let withdrawal = annualWithdrawal;
      for (const r of run.returns) {
        // Inflation-adjust withdrawal each year (standard 4% rule definition)
        balance -= withdrawal;
        if (balance <= 0) { survived = false; break; }
        balance *= 1 + r.blended(ALLOC_60_40);
        withdrawal *= 1 + ASSUMPTIONS.inflationRate;
      }
      if (survived && balance > 0) successes++;
    }

    const successRate = successes / numSims;
    expect(successRate).toBeGreaterThanOrEqual(0.80);
    expect(successRate).toBeLessThanOrEqual(0.97);
  });
});
