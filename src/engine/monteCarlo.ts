import type { InvestmentAssumptions, AssetAllocation } from "../types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnnualReturns {
  equity: number;
  bond: number;
  cash: number;
  /** Blended portfolio return given an allocation */
  blended: (allocation: AssetAllocation) => number;
}

export interface SimulationRun {
  /** returns[year] = AnnualReturns for that year index (0-based) */
  returns: AnnualReturns[];
}

// ─── Box-Muller normal samples ────────────────────────────────────────────────

// Returns two independent N(0,1) samples using Box-Muller transform.
function boxMuller(rng: () => number): [number, number] {
  const u1 = Math.max(rng(), 1e-10); // guard against log(0)
  const u2 = rng();
  const mag = Math.sqrt(-2 * Math.log(u1));
  return [mag * Math.cos(2 * Math.PI * u2), mag * Math.sin(2 * Math.PI * u2)];
}

// ─── Correlated return generation (Cholesky) ──────────────────────────────────

/**
 * Generates one year of correlated equity and bond log-normal returns.
 *
 * Cholesky decomposition of the 2×2 correlation matrix:
 *   L = [[1, 0], [ρ, √(1−ρ²)]]
 *
 * z_equity = z1
 * z_bond   = ρ·z1 + √(1−ρ²)·z2
 *
 * Log-normal transform: r = exp(μ + σ·z) − 1
 * (prevents compounding from going negative over long horizons)
 */
export function generateAnnualReturns(
  assumptions: InvestmentAssumptions,
  rng: () => number
): AnnualReturns {
  const [z1, z2] = boxMuller(rng);

  const { equityMeanReturn, equityStdDev, bondMeanReturn, bondStdDev, cashReturn, correlationEquityBond } =
    assumptions;

  const rho = correlationEquityBond;
  const zEquity = z1;
  const zBond = rho * z1 + Math.sqrt(1 - rho * rho) * z2;

  const equity = Math.exp(equityMeanReturn + equityStdDev * zEquity) - 1;
  const bond = Math.exp(bondMeanReturn + bondStdDev * zBond) - 1;
  const cash = cashReturn; // deterministic — cash return has no volatility modeled

  return {
    equity,
    bond,
    cash,
    blended: (allocation: AssetAllocation) =>
      equity * allocation.equityPct +
      bond * allocation.bondPct +
      cash * allocation.cashPct,
  };
}

// ─── Seeded PRNG (Mulberry32) ─────────────────────────────────────────────────

// A fast, seedable 32-bit PRNG. Produces uniform [0, 1) output.
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Single run ───────────────────────────────────────────────────────────────

export function generateRun(
  assumptions: InvestmentAssumptions,
  numYears: number,
  seed: number
): SimulationRun {
  const rng = mulberry32(seed);
  const returns: AnnualReturns[] = [];
  for (let y = 0; y < numYears; y++) {
    returns.push(generateAnnualReturns(assumptions, rng));
  }
  return { returns };
}

// ─── Full Monte Carlo batch ───────────────────────────────────────────────────

export interface MonteCarloOptions {
  numSimulations: number; // default 1_000
  numYears: number;
  baseSeed?: number;      // for reproducibility; default 42
  onProgress?: (progress: number) => void; // 0–1, emitted every 100 runs
}

export function generateMonteCarloRuns(
  assumptions: InvestmentAssumptions,
  options: MonteCarloOptions
): SimulationRun[] {
  const { numSimulations, numYears, baseSeed = 42, onProgress } = options;
  const runs: SimulationRun[] = [];

  for (let i = 0; i < numSimulations; i++) {
    runs.push(generateRun(assumptions, numYears, baseSeed + i));

    if (onProgress && i > 0 && i % 100 === 0) {
      onProgress(i / numSimulations);
    }
  }

  if (onProgress) onProgress(1);
  return runs;
}

// ─── Percentile extraction ────────────────────────────────────────────────────

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export interface PercentileBands {
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
}

/**
 * Given portfolio balances per run per year (balances[run][year]),
 * extracts percentile bands across all runs for each year.
 */
export function extractPercentiles(balances: number[][]): PercentileBands {
  if (balances.length === 0) return { p10: [], p25: [], p50: [], p75: [], p90: [] };
  const numYears = balances[0].length;

  const p10: number[] = [];
  const p25: number[] = [];
  const p50: number[] = [];
  const p75: number[] = [];
  const p90: number[] = [];

  for (let y = 0; y < numYears; y++) {
    const col = balances.map((run) => run[y]).sort((a, b) => a - b);
    p10.push(percentile(col, 10));
    p25.push(percentile(col, 25));
    p50.push(percentile(col, 50));
    p75.push(percentile(col, 75));
    p90.push(percentile(col, 90));
  }

  return { p10, p25, p50, p75, p90 };
}
