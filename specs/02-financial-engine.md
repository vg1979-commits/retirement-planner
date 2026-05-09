# Spec 02 — Financial Engine

The financial engine is a pure TypeScript module (no React dependencies) that takes an `AppState` and returns `SimulationResult[]` — one per scenario. It runs entirely in the browser using a Web Worker so the UI stays responsive.

---

## 1. Architecture

```
src/
  engine/
    index.ts          — public API: runSimulations(state) → SimulationResult[]
    monteCarlo.ts     — random return generator (correlated equity/bond)
    projector.ts      — single-run year-by-year projection loop
    taxEngine.ts      — federal tax, LTCG, Roth conversion logic
    withdrawalStrategy.ts — account sequencing rules
    constants.ts      — 2025 tax brackets, contribution limits, inflation
    worker.ts         — Web Worker wrapper
```

---

## 2. Monte Carlo Engine

### 2.1 Return Generation

Each simulation run generates an array of correlated annual returns for equity and bonds using the Cholesky decomposition method:

```
Given:
  μ_e = equityMeanReturn, σ_e = equityStdDev
  μ_b = bondMeanReturn,   σ_b = bondStdDev
  ρ   = correlationEquityBond

For each year:
  z1, z2 ~ N(0,1) independent
  equity_return = μ_e + σ_e * z1
  bond_return   = μ_b + σ_b * (ρ * z1 + √(1-ρ²) * z2)
```

Returns are log-normal (apply via `exp(r) - 1` to avoid negative compounding).

### 2.2 Simulation Count

Default: **1,000 runs** (configurable 500–5,000). Each run uses independent random seeds.

### 2.3 Sequence of Returns Risk

Returns are sampled independently each year — this naturally produces sequence-of-returns risk, which is the primary risk for early retirees.

---

## 3. Year-by-Year Projection Loop

For each simulation run and each year from `currentYear` to `endYear`:

```
1. Determine phase: accumulation (both working), transition (one retired), distribution (both retired)
2. Calculate gross income (see §3.1)
3. Calculate contributions to tax-advantaged accounts
4. Run tax engine → net income after tax
5. Calculate expenses (inflation-adjusted)
6. Determine net cash flow = net income - expenses
7. If net cash flow > 0: invest surplus into brokerage (taxable)
8. If net cash flow < 0: trigger withdrawal strategy (see §5)
9. Apply investment returns to all accounts
10. Record AnnualProjection
```

### 3.1 Income Calculation

- Each `IncomeStream` is looked up by year range, grown by `growthRate`
- W2 income stops at `targetRetirementAge` for each spouse independently
- RSU income uses exact `startYear`/`endYear` from the income stream definition
- Investment income (dividends, interest) is calculated as a fraction of taxable account balances

### 3.2 Contribution Logic

- 401k: min(annualContribution, IRS limit); add employer match
- IRA: direct Roth contribution if MAGI ≤ threshold, else backdoor Roth (no income effect)
- HSA: annual contribution up to IRS limit while enrolled in HDHP
- No contributions after retirement year (per spouse)

### 3.3 Inflation Adjustment

All dollar amounts in `AnnualProjection` are **nominal** (future dollars). The UI displays both nominal and real (today's dollars) values via a toggle.

---

## 4. Tax Engine (see Spec 03 for full detail)

The projector calls `taxEngine.calculate(year, income, accounts, state)` which returns a `TaxSnapshot`. The tax engine handles:

- Ordinary income brackets (MFJ, inflation-adjusted)
- Long-term capital gains brackets
- Standard deduction
- Net Investment Income Tax (3.8% above threshold)
- Roth conversion optimization (optional, see Spec 03)

---

## 5. Withdrawal Strategy

When expenses exceed income in any year, the engine draws down accounts in this order:

### Phase 1: Pre-RMD (ages ~59½ to 73)

1. **Cash / money market** — up to 1 year of expenses
2. **Taxable brokerage** — sell lowest-cost-basis lots first (FIFO approximation)
3. **HSA** — use for qualified medical expenses only
4. **Traditional 401k / IRA** — draw to fill lower tax brackets
5. **Roth IRA** — last resort; preserve for tax-free growth

### Phase 2: RMD Age (73+)

- RMDs are calculated using IRS Uniform Lifetime Table (age-based divisor)
- RMDs from all traditional accounts are mandatory; apply toward expense needs first
- Excess RMDs (above expenses) are reinvested in taxable brokerage

### Guardrails

- Minimum cash buffer: 6 months of expenses (cash account never drawn below this)
- If all accounts are exhausted: flag year as "portfolio depleted" → this run counts as a failure

---

## 6. Success Rate Calculation

```
successRate = (runs where portfolio balance > 0 at endYear) / totalRuns
```

The industry standard benchmark is **≥ 85% success rate** as "safe." The UI displays:
- Below 70%: red warning
- 70–84%: yellow caution
- 85–94%: green good
- 95%+: blue (potentially too conservative / under-spending)

---

## 7. Percentile Extraction

After all runs, for each year extract portfolio balance percentiles across all runs:

```typescript
function extractPercentiles(runs: number[][]): PercentileBands {
  // runs[i][year] = portfolio balance for run i at year
  return {
    p10: years.map(y => percentile(runs.map(r => r[y]), 10)),
    p25: years.map(y => percentile(runs.map(r => r[y]), 25)),
    p50: years.map(y => percentile(runs.map(r => r[y]), 50)),
    p75: years.map(y => percentile(runs.map(r => r[y]), 75)),
    p90: years.map(y => percentile(runs.map(r => r[y]), 90)),
  };
}
```

---

## 8. Performance Requirements

- 1,000 runs × 40 years × per-year computation must complete in **< 3 seconds** on a modern laptop
- Run in a **Web Worker** to avoid blocking the UI thread
- Progress callback: emit `{progress: 0–1}` every 100 runs so UI can show a progress bar
- Results are memoized by a hash of inputs; re-run only when inputs change

---

## 9. Testing Requirements

The engine must have unit tests for:

- Return generation: mean/std-dev of 10,000 samples within 5% of inputs
- Tax calculation: spot-check against known MFJ tax tables
- Withdrawal sequencing: correct account draw-down order
- RMD calculation: matches IRS table for ages 73, 80, 90
- Success rate: a 4% SWR on a 60/40 portfolio should produce ~85–90% success over 30 years (historical validation)
