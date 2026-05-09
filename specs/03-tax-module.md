# Spec 03 — Tax Module

The tax module handles all federal income tax calculations. State taxes are a placeholder in v1 (user can enter a flat effective state rate). The module is pure TypeScript with no side effects.

---

## 1. Filing Status

All calculations assume **Married Filing Jointly (MFJ)** throughout the planning horizon.

---

## 2. Federal Income Tax Brackets (2025 — inflation-adjusted each year)

Brackets inflate at `investmentAssumptions.inflationRate` annually.

```typescript
const TAX_BRACKETS_2025_MFJ = [
  { min: 0,       max: 23_200,  rate: 0.10 },
  { min: 23_200,  max: 94_300,  rate: 0.12 },
  { min: 94_300,  max: 201_050, rate: 0.22 },
  { min: 201_050, max: 383_900, rate: 0.24 },
  { min: 383_900, max: 487_450, rate: 0.32 },
  { min: 487_450, max: 731_200, rate: 0.35 },
  { min: 731_200, max: null,    rate: 0.37 },
];

const STANDARD_DEDUCTION_2025_MFJ = 29_200;
```

---

## 3. Long-Term Capital Gains (LTCG)

```typescript
const LTCG_BRACKETS_2025_MFJ = [
  { min: 0,       max: 94_050,  rate: 0.00 },
  { min: 94_050,  max: 583_750, rate: 0.15 },
  { min: 583_750, max: null,    rate: 0.20 },
];
```

LTCG is stacked on top of ordinary income for bracket determination (the "stacking" rule).

---

## 4. Net Investment Income Tax (NIIT)

- Rate: **3.8%** on the lesser of: net investment income OR (MAGI − $250,000 MFJ threshold)
- Investment income includes: dividends, interest, capital gains, rental income
- Threshold inflates at inflation rate

---

## 5. Tax Calculation Function

```typescript
function calculateTax(snapshot: TaxInput): TaxSnapshot {
  // 1. Apply standard deduction
  const taxableOrdinaryIncome = max(0, ordinaryIncome - standardDeduction);

  // 2. Calculate ordinary income tax via bracket traversal
  const bracketBreakdown = computeBrackets(taxableOrdinaryIncome, brackets);

  // 3. Calculate LTCG tax (stacked on ordinary income)
  const ltcgTax = computeLTCG(ltcgIncome, taxableOrdinaryIncome, ltcgBrackets);

  // 4. Calculate NIIT
  const niit = computeNIIT(investmentIncome, magi);

  // 5. Total
  const totalFederalTax = bracketBreakdown.total + ltcgTax + niit;

  return { ...snapshot, bracketBreakdown, ltcgTax, niit, totalFederalTax, ... };
}
```

---

## 6. Roth Conversion Optimizer

This is one of the highest-value features for a high-income family with large pre-tax balances.

### 6.1 Problem Statement

The family likely has significant traditional 401k / IRA balances. After retirement (when income drops) and before RMDs (age 73), there is a window to convert pre-tax funds to Roth at lower tax rates. The optimizer finds the optimal conversion amount each year — including an accelerated early-retirement window (ages 55–59½) when marginal rates may be even lower than the main conversion window.

### 6.2 Algorithm

```
For each year from (both retired) through (end of plan):
  1. Determine taxable income from non-conversion sources (investment income, part-time work, etc.)
  2. If age >= 73: calculate mandatory RMD for each traditional account; add total RMD to taxable income
  3. Calculate current marginal rate on that taxable income
  4. Identify "bracket headroom" — how much more income fits in target bracket AFTER RMDs and other income
  5. If headroom > 0 AND traditional_balance > 0:
       a. If age is 55–59.5 AND current marginal rate < target bracket rate:
            → Pull-forward mode: convert up to headroom (same as normal), but flag in rationale
               as "Early window: marginal rate X% < target Y% — accelerating conversions"
       b. Otherwise: convert min(headroom, traditional_balance) to Roth as normal
  6. Record conversion as ordinary income in TaxSnapshot
  7. Reduce traditional account balance; increase Roth balance
```

Note: conversions continue to be evaluated after RMD age — RMDs may consume most or all of the bracket headroom, but partial conversions are still worthwhile in years where headroom remains. Do not hard-stop conversions at age 73.

### 6.2a Early Retirement Pull-Forward Logic (Ages 55–59½)

When one or both spouses retire before age 59½, their income often drops sharply — potentially to a marginal rate *below* the target conversion bracket. This creates an especially attractive conversion window that the optimizer must recognize and prioritize.

**Trigger condition:** In any year where:
- At least one spouse is between age 55 and 59½ (inclusive), AND
- The household's current marginal rate (before any conversion) is **less than** the user's target bracket rate

**Behavior:**
- Convert up to the full bracket headroom, same as the standard algorithm
- The optimizer does NOT increase the conversion amount beyond the target bracket ceiling — it simply recognizes these years as high-priority and flags them
- `conversionRationale` for these years: `"Early window (age 55–59½): current rate X% < target Y% — high-priority conversion year"`
- The UI summary bar should call out if any pull-forward years exist: *"Includes X high-priority early conversion years (ages 55–59½) where your marginal rate drops below the target bracket."*

**Important — early withdrawal penalty distinction:**
- The Roth *conversion* itself (moving money from traditional to Roth) is NOT subject to the 10% early withdrawal penalty, regardless of age
- However, withdrawing money from a traditional account to *pay the tax bill* on the conversion before age 59½ WOULD trigger the 10% penalty on that tax payment withdrawal
- The optimizer assumes the tax cost of conversions in the 55–59½ window is paid from non-retirement funds (taxable brokerage or cash), not from the traditional account itself
- If taxable/cash balance is insufficient to cover the tax cost, the optimizer reduces the conversion amount to what can be funded without triggering the penalty
- Display a note in the Roth Conversion Planner for affected years: *"Tax on this conversion should be paid from taxable funds to avoid early withdrawal penalty."*

### 6.3 Configurable Target Bracket

User can set the maximum bracket to fill via conversion:
- Conservative: fill to top of 12% bracket
- Moderate (default): fill to top of 22% bracket
- Aggressive: fill to top of 24% bracket

The pull-forward logic in §6.2a applies in all three modes — it activates whenever the current marginal rate is below whichever target the user has selected.

### 6.4 IRMAA Awareness (Placeholder in v1)

Medicare IRMAA surcharges kick in at MAGI > $212,000 (MFJ, 2025). Flag years where conversions would trigger IRMAA but do not model the surcharge amount in v1. Display a warning icon in the cash flow view for flagged years.

### 6.5 Output

The optimizer adds to each year's `TaxSnapshot`:
- `rothConversionAmount` — dollars converted
- `rothConversionTaxCost` — marginal tax on that conversion
- `conversionRationale` — human-readable string (e.g. "Filled 22% bracket: $45,200 converted", "Partial — RMD used most of bracket", "No headroom — RMD fills bracket")

The optimizer also produces a `RothConversionSummary` for the full scenario (used by the UI summary bar):

```typescript
interface RothConversionSummary {
  totalConverted: number;           // cumulative dollars converted across all years
  totalTaxCostWithConversions: number;    // lifetime federal tax with strategy
  totalTaxCostWithoutConversions: number; // lifetime federal tax if no conversions done
  estimatedTaxSavings: number;      // difference — the headline figure shown in UI
  conversionWindowStart: number;    // first year a conversion is recommended (calendar year)
  conversionWindowEnd: number;      // last year a conversion is recommended
  traditionalBalanceAtRMDAge: number; // projected traditional balance at age 73 without conversions — RMD tax bomb indicator
  narrativeSummary: string;         // 2–3 sentence plain-English explanation generated from the above fields
}
```

`estimatedTaxSavings` is computed by running the projection twice on the median path — once with the optimizer enabled, once with it disabled — and diffing total lifetime federal tax.

---

## 7. Tax-Efficient Withdrawal Ordering

When drawing down in retirement, the tax module advises the withdrawal strategy (Spec 02 §5) on the tax impact of each withdrawal:

- Pull traditional IRA/401k up to the top of the 12% bracket before touching Roth
- Harvest long-term capital gains at 0% while in the 0% LTCG bracket
- Use Roth only after exhausting tax-efficient options

---

## 8. 401k / IRA Contribution Tax Benefit

For accumulation years, model the tax benefit of pre-tax contributions:

```
tax_savings = contribution_amount × marginal_rate
```

This is displayed in the annual cash flow view as "Tax benefit of contributions."

---

## 9. Backdoor Roth IRA

For years where MAGI exceeds the Roth contribution limit (~$240,000 MFJ, 2025):
- Model as non-deductible traditional IRA contribution followed by immediate Roth conversion
- Tax treatment: $0 ordinary income (basis = contribution amount)
- Pro-rata rule: warn if spouse has existing traditional IRA balance (don't model the complexity in v1, just display a warning)

---

## 10. Testing Requirements

Tax module unit tests must verify:

- Bracket calculation for income at each bracket boundary (±$1)
- LTCG stacking: 0% rate when ordinary income is low, 15% when stacked into LTCG brackets
- NIIT: threshold detection, correct lesser-of calculation
- Roth optimizer: correctly fills to target bracket, does not over-convert
- Roth optimizer in RMD years: RMD income counted before calculating conversion headroom; no conversion when RMD fills the bracket
- Roth optimizer post-73: conversions continue where bracket headroom remains after RMDs
- Backdoor Roth: $0 tax cost when no existing IRA balance

---

## Changelog
- 2026-05-09T16:19:58Z: §6.2 Roth conversion algorithm updated — RMD income now factored into bracket headroom calculation; conversions continue past age 73 where headroom exists
- 2026-05-09T20:12:00Z: §6.5 Output expanded — added RothConversionSummary type with estimatedTaxSavings headline, conversion window, traditional balance at RMD age, and narrativeSummary for UI summary bar
- 2026-05-09T20:56:02Z: §6.2a added — early retirement pull-forward logic for ages 55–59½; optimizer activates when current marginal rate < target bracket rate; early withdrawal penalty distinction documented; tax payment sourcing rules specified
