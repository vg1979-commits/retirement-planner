import type { TaxSnapshot, TaxBracketLine } from "../types";
import {
  TAX_BRACKETS_2025_MFJ,
  LTCG_BRACKETS_2025_MFJ,
  STANDARD_DEDUCTION_2025_MFJ,
  NIIT_RATE,
  NIIT_THRESHOLD_2025_MFJ,
  IRMAA_THRESHOLD_2025_MFJ,
  ROTH_PHASEOUT_END_2025_MFJ,
  CONTRIBUTION_LIMITS_2025,
  RMD_START_AGE,
  BASE_YEAR,
  type TaxBracket,
} from "./constants";

// ─── Bracket inflation ────────────────────────────────────────────────────────

export function inflateBrackets(
  brackets: TaxBracket[],
  year: number,
  inflationRate: number
): TaxBracket[] {
  const years = year - BASE_YEAR;
  const factor = Math.pow(1 + inflationRate, years);
  return brackets.map((b) => ({
    min: Math.round(b.min * factor),
    max: b.max !== null ? Math.round(b.max * factor) : null,
    rate: b.rate,
  }));
}

export function inflateValue(
  base: number,
  year: number,
  inflationRate: number
): number {
  return Math.round(base * Math.pow(1 + inflationRate, year - BASE_YEAR));
}

// ─── Ordinary income bracket traversal ───────────────────────────────────────

export function computeOrdinaryTax(
  taxableIncome: number,
  brackets: TaxBracket[]
): { lines: TaxBracketLine[]; total: number } {
  let remaining = taxableIncome;
  let total = 0;
  const lines: TaxBracketLine[] = [];

  for (const bracket of brackets) {
    if (remaining <= 0) break;
    const bandTop = bracket.max !== null ? bracket.max : Infinity;
    const bandSize = bandTop - bracket.min;
    const incomeInBracket = Math.min(remaining, bandSize);
    const taxInBracket = incomeInBracket * bracket.rate;

    lines.push({
      bracketMin: bracket.min,
      bracketMax: bracket.max,
      rate: bracket.rate,
      incomeInBracket,
      taxInBracket,
    });

    total += taxInBracket;
    remaining -= incomeInBracket;
  }

  return { lines, total };
}

// ─── LTCG tax (stacked on top of ordinary income) ────────────────────────────

export function computeLtcgTax(
  ltcgIncome: number,
  taxableOrdinaryIncome: number,
  ltcgBrackets: TaxBracket[]
): number {
  if (ltcgIncome <= 0) return 0;

  // LTCG income sits on top of ordinary income in the rate stacks
  const stackBase = taxableOrdinaryIncome;
  const stackTop = stackBase + ltcgIncome;
  let tax = 0;

  for (const bracket of ltcgBrackets) {
    const bandTop = bracket.max !== null ? bracket.max : Infinity;
    // Portion of the LTCG stack that falls within this bracket
    const lo = Math.max(stackBase, bracket.min);
    const hi = Math.min(stackTop, bandTop);
    if (hi > lo) {
      tax += (hi - lo) * bracket.rate;
    }
  }

  return tax;
}

// ─── NIIT ──────────────────────────────────────────────────────────────────────

export function computeNiit(
  netInvestmentIncome: number,
  magi: number,
  year: number,
  inflationRate: number
): number {
  const threshold = inflateValue(NIIT_THRESHOLD_2025_MFJ, year, inflationRate);
  const excess = Math.max(0, magi - threshold);
  return Math.min(netInvestmentIncome, excess) * NIIT_RATE;
}

// ─── Marginal rate ────────────────────────────────────────────────────────────

export function marginalRate(taxableIncome: number, brackets: TaxBracket[]): number {
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (taxableIncome > brackets[i].min) return brackets[i].rate;
  }
  return brackets[0].rate;
}

// ─── Input type ───────────────────────────────────────────────────────────────

export interface TaxInput {
  year: number;
  inflationRate: number;

  ordinaryIncome: number;       // W2 + traditional withdrawals + Roth conversions
  longTermCapitalGains: number; // realized LTCG + qualified dividends
  qualifiedDividends: number;

  // For NIIT: investmentIncome = LTCG + dividends + interest + rental
  netInvestmentIncome: number;

  rothConversionAmount?: number;
  /** Plain-English explanation from optimizeRothConversion(); surfaced in the Tax View. */
  conversionRationale?: string;
}

// ─── Main calculation ─────────────────────────────────────────────────────────

export function calculateTax(input: TaxInput): TaxSnapshot {
  const {
    year,
    inflationRate,
    ordinaryIncome,
    longTermCapitalGains,
    qualifiedDividends,
    netInvestmentIncome,
    rothConversionAmount = 0,
    conversionRationale,
  } = input;

  const brackets = inflateBrackets(TAX_BRACKETS_2025_MFJ, year, inflationRate);
  const ltcgBrackets = inflateBrackets(LTCG_BRACKETS_2025_MFJ, year, inflationRate);
  const standardDeduction = inflateValue(STANDARD_DEDUCTION_2025_MFJ, year, inflationRate);

  const taxableOrdinaryIncome = Math.max(0, ordinaryIncome - standardDeduction);
  const magi = ordinaryIncome + longTermCapitalGains;

  const { lines: bracketBreakdown, total: ordinaryTax } = computeOrdinaryTax(
    taxableOrdinaryIncome,
    brackets
  );

  const ltcgTax = computeLtcgTax(longTermCapitalGains, taxableOrdinaryIncome, ltcgBrackets);
  const niit = computeNiit(netInvestmentIncome, magi, year, inflationRate);

  const totalFederalTax = ordinaryTax + ltcgTax + niit;
  const effectiveRate = magi > 0 ? totalFederalTax / magi : 0;
  const marginalOrdinaryRate = marginalRate(taxableOrdinaryIncome, brackets);

  const rothConversionTaxCost =
    rothConversionAmount > 0 ? rothConversionAmount * marginalOrdinaryRate : undefined;

  return {
    year,
    filingStatus: "married_filing_jointly",
    ordinaryIncome,
    longTermCapitalGains,
    qualifiedDividends,
    standardDeduction,
    taxableIncome: taxableOrdinaryIncome + longTermCapitalGains,
    bracketBreakdown,
    totalFederalTax,
    effectiveRate,
    marginalRate: marginalOrdinaryRate,
    rothConversionAmount: rothConversionAmount || undefined,
    rothConversionTaxCost,
    conversionRationale,
  };
}

// ─── Roth Conversion Optimizer ────────────────────────────────────────────────

export type ConversionTargetBracket = "12pct" | "22pct" | "24pct";

const TARGET_BRACKET_RATE: Record<ConversionTargetBracket, number> = {
  "12pct": 0.12,
  "22pct": 0.22,
  "24pct": 0.24,
};

export interface RothConversionResult {
  conversionAmount: number;
  taxCost: number;
  rationale: string;
  irmaaWarning: boolean;
  /** True when this year qualifies for the §6.2a early-retirement pull-forward
   *  bonus: at least one spouse is age 55–59½ AND the household's pre-conversion
   *  marginal rate is below the target bracket. UI uses this to row-highlight
   *  in amber and surface the early-window callout. */
  isPullForward: boolean;
  /** Marginal rate on ordinary income BEFORE the conversion (post-RMD, post-deduction).
   *  Surfaced so the rationale can show "current X% < target Y%". */
  currentMarginalRate: number;
  /** True when the early-window funding constraint had to shrink the conversion
   *  because taxable+cash funds couldn't cover the full tax bill without dipping
   *  into traditional accounts (which would trigger the 10% pre-59½ penalty). */
  fundingConstrained: boolean;
}

export function optimizeRothConversion(
  params: {
    year: number;
    inflationRate: number;
    ordinaryIncomeBeforeConversion: number;
    longTermCapitalGains: number;
    traditionalBalance: number;
    targetBracket: ConversionTargetBracket;
    bothRetired: boolean;
    olderSpouseAge: number;
    /** Mandatory RMD income for this year (already realised from traditional accounts).
     *  Per Spec 03 §6.2: RMDs consume bracket headroom before conversion is sized. */
    rmdIncome?: number;
    /** Per Spec 03 §6.2a: at least one spouse is age 55–59 (i.e. <60 and ≥55).
     *  When true AND current marginal rate < target rate, pull-forward mode kicks in. */
    anySpouseInEarlyWindow?: boolean;
    /** Per Spec 03 §6.2a: household's available non-retirement funds (taxable
     *  brokerage + cash). When in the early window, the conversion's tax cost
     *  must be payable from these funds — otherwise we shrink the conversion to
     *  what those funds can cover. Pre-59½ withdrawals from traditional accounts
     *  to pay tax would trigger a 10% penalty. */
    availableTaxFunds?: number;
  }
): RothConversionResult {
  const {
    year,
    inflationRate,
    ordinaryIncomeBeforeConversion,
    longTermCapitalGains,
    traditionalBalance,
    targetBracket,
    bothRetired,
    olderSpouseAge,
    rmdIncome = 0,
    anySpouseInEarlyWindow = false,
    availableTaxFunds = Infinity,
  } = params;

  const noConversion: RothConversionResult = {
    conversionAmount: 0,
    taxCost: 0,
    rationale: "Not in conversion window",
    irmaaWarning: false,
    isPullForward: false,
    currentMarginalRate: 0,
    fundingConstrained: false,
  };

  // Per Spec 03 §6.2: conversions are evaluated for every year both spouses are
  // retired — including post-RMD years — because partial conversions remain
  // worthwhile when bracket headroom survives the RMD draw.
  if (!bothRetired) return noConversion;
  if (traditionalBalance <= 0) return noConversion;

  const brackets = inflateBrackets(TAX_BRACKETS_2025_MFJ, year, inflationRate);
  const standardDeduction = inflateValue(STANDARD_DEDUCTION_2025_MFJ, year, inflationRate);

  // Headroom is calculated AFTER RMD income is stacked on top of other ordinary income.
  // In RMD years this typically eats most/all of the headroom in the target bracket.
  const totalOrdinaryBeforeConversion = ordinaryIncomeBeforeConversion + rmdIncome;
  const taxableOrdinary = Math.max(0, totalOrdinaryBeforeConversion - standardDeduction);

  const targetRate = TARGET_BRACKET_RATE[targetBracket];
  const targetBracketData = brackets.find((b) => b.rate === targetRate);
  if (!targetBracketData) return noConversion;

  const targetBracketTop = targetBracketData.max ?? Infinity;
  const headroom = Math.max(0, targetBracketTop - taxableOrdinary);
  const initialConversion = Math.min(headroom, traditionalBalance);

  // Pre-conversion marginal rate (used for both pull-forward detection and tax sizing).
  const marginalOrdinaryRate = marginalRate(taxableOrdinary, brackets);

  if (initialConversion <= 0) {
    // RMDs (or other income) filled the bracket — no conversion this year.
    const reason = olderSpouseAge >= RMD_START_AGE && rmdIncome > 0
      ? "No headroom — RMD fills bracket"
      : "No bracket headroom remaining";
    return {
      ...noConversion,
      rationale: reason,
      currentMarginalRate: marginalOrdinaryRate,
    };
  }

  // §6.2a: pull-forward fires when an early-window spouse exists AND current
  // marginal rate is below the target bracket rate.
  const isPullForward = anySpouseInEarlyWindow && marginalOrdinaryRate < targetRate;

  // §6.2a funding constraint: in the pre-59½ window, the tax cost must be
  // payable from non-retirement funds. If not, scale the conversion down so
  // the resulting tax cost fits within availableTaxFunds. Only applies when
  // any spouse is in the 55–59 window — once both are 59½+, the 10% penalty
  // no longer applies and traditional withdrawals can fund the bill.
  let conversionAmount = initialConversion;
  let fundingConstrained = false;
  if (anySpouseInEarlyWindow && marginalOrdinaryRate > 0) {
    const maxAffordableConversion = availableTaxFunds / marginalOrdinaryRate;
    if (initialConversion > maxAffordableConversion) {
      conversionAmount = Math.max(0, maxAffordableConversion);
      fundingConstrained = true;
    }
  }

  if (conversionAmount <= 0) {
    return {
      ...noConversion,
      rationale: "No taxable funds available to cover conversion tax (pre-59½ penalty risk)",
      currentMarginalRate: marginalOrdinaryRate,
      fundingConstrained: true,
    };
  }

  const taxCost = conversionAmount * marginalOrdinaryRate;

  const irmaaThreshold = inflateValue(IRMAA_THRESHOLD_2025_MFJ, year, inflationRate);
  const magiAfterConversion =
    totalOrdinaryBeforeConversion + conversionAmount + longTermCapitalGains;
  const irmaaWarning = magiAfterConversion > irmaaThreshold;

  const targetPctLabel = targetBracket.replace("pct", "%");
  const currentPctLabel = `${Math.round(marginalOrdinaryRate * 100)}%`;

  // Rationale priority (most specific first):
  //   1. Pull-forward (early window with sub-target marginal rate)
  //   2. Partial — RMD used most of bracket (post-73 with RMDs)
  //   3. Standard "Filled X% bracket" message
  let rationale: string;
  if (isPullForward) {
    rationale = `⭐ Early window: ${currentPctLabel} < ${targetPctLabel} target`;
    if (fundingConstrained) {
      rationale += ` (sized to fit available taxable funds)`;
    }
  } else if (olderSpouseAge >= RMD_START_AGE && rmdIncome > 0) {
    rationale = `Partial — RMD used most of bracket`;
  } else {
    rationale = `Filled ${targetPctLabel} bracket: $${Math.round(conversionAmount).toLocaleString()} converted`;
  }

  return {
    conversionAmount: Math.round(conversionAmount),
    taxCost: Math.round(taxCost),
    rationale,
    irmaaWarning,
    isPullForward,
    currentMarginalRate: marginalOrdinaryRate,
    fundingConstrained,
  };
}

// ─── Backdoor Roth eligibility ────────────────────────────────────────────────

export function isBackdoorRothYear(
  magi: number,
  year: number,
  inflationRate: number
): boolean {
  const phaseoutEnd = inflateValue(ROTH_PHASEOUT_END_2025_MFJ, year, inflationRate);
  return magi >= phaseoutEnd;
}

// ─── 401k contribution limits (age-aware) ─────────────────────────────────────

export function annual401kLimit(age: number): number {
  const base = CONTRIBUTION_LIMITS_2025.k401_employee;
  return age >= 50 ? base + CONTRIBUTION_LIMITS_2025.k401_catchup : base;
}

export function annualIraLimit(age: number): number {
  const base = CONTRIBUTION_LIMITS_2025.ira;
  return age >= 50 ? base + CONTRIBUTION_LIMITS_2025.ira_catchup : base;
}

export function annualHsaLimit(age: number): number {
  const base = CONTRIBUTION_LIMITS_2025.hsa_family;
  return age >= 55 ? base + CONTRIBUTION_LIMITS_2025.hsa_catchup : base;
}
