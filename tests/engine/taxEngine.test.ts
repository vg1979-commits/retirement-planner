import { describe, it, expect } from "vitest";
import {
  calculateTax,
  computeOrdinaryTax,
  computeLtcgTax,
  computeNiit,
  optimizeRothConversion,
  isBackdoorRothYear,
  inflateBrackets,
} from "../../src/engine/taxEngine";
import {
  TAX_BRACKETS_2025_MFJ,
  LTCG_BRACKETS_2025_MFJ,
  BASE_YEAR,
} from "../../src/engine/constants";

const INFLATION = 0.025;
const Y2025 = 2025;

// ─── Bracket traversal ────────────────────────────────────────────────────────

describe("computeOrdinaryTax", () => {
  it("$0 income → $0 tax", () => {
    const { total } = computeOrdinaryTax(0, TAX_BRACKETS_2025_MFJ);
    expect(total).toBe(0);
  });

  it("income exactly at first bracket boundary (23_200)", () => {
    const { total } = computeOrdinaryTax(23_200, TAX_BRACKETS_2025_MFJ);
    expect(total).toBe(23_200 * 0.10);
  });

  it("income $1 above first bracket boundary", () => {
    const { total } = computeOrdinaryTax(23_201, TAX_BRACKETS_2025_MFJ);
    expect(total).toBeCloseTo(23_200 * 0.10 + 1 * 0.12, 2);
  });

  it("income at top of 12% bracket (94_300)", () => {
    const { total } = computeOrdinaryTax(94_300, TAX_BRACKETS_2025_MFJ);
    const expected = 23_200 * 0.10 + (94_300 - 23_200) * 0.12;
    expect(total).toBeCloseTo(expected, 0);
  });

  it("income spanning into 24% bracket", () => {
    // $250,000 taxable income
    const { total } = computeOrdinaryTax(250_000, TAX_BRACKETS_2025_MFJ);
    const expected =
      23_200 * 0.10 +
      (94_300 - 23_200) * 0.12 +
      (201_050 - 94_300) * 0.22 +
      (250_000 - 201_050) * 0.24;
    expect(total).toBeCloseTo(expected, 0);
  });

  it("lines sum equals total", () => {
    const { lines, total } = computeOrdinaryTax(500_000, TAX_BRACKETS_2025_MFJ);
    const lineSum = lines.reduce((s, l) => s + l.taxInBracket, 0);
    expect(lineSum).toBeCloseTo(total, 1);
  });
});

// ─── LTCG stacking ────────────────────────────────────────────────────────────

describe("computeLtcgTax", () => {
  it("0% rate when ordinary income is low and LTCG is small", () => {
    // taxableOrdinary = 50_000, LTCG stack stays below 94_050 → 0% LTCG bracket
    const tax = computeLtcgTax(10_000, 50_000, LTCG_BRACKETS_2025_MFJ);
    expect(tax).toBe(0);
  });

  it("15% rate when stacked ordinary + LTCG exceeds 94_050", () => {
    // taxableOrdinary = 90_000, LTCG = 10_000 → stack 90k–100k
    // 4_050 in 0% bracket (90k→94.05k), 5_950 in 15% bracket
    const tax = computeLtcgTax(10_000, 90_000, LTCG_BRACKETS_2025_MFJ);
    expect(tax).toBeCloseTo(5_950 * 0.15, 0);
  });

  it("20% rate when stacked income exceeds 583_750", () => {
    const tax = computeLtcgTax(100_000, 550_000, LTCG_BRACKETS_2025_MFJ);
    // stack 550k–650k; 33_750 at 15%, 66_250 at 20%
    const expected = 33_750 * 0.15 + 66_250 * 0.20;
    expect(tax).toBeCloseTo(expected, 0);
  });

  it("no LTCG income → $0", () => {
    expect(computeLtcgTax(0, 200_000, LTCG_BRACKETS_2025_MFJ)).toBe(0);
  });
});

// ─── NIIT ─────────────────────────────────────────────────────────────────────

describe("computeNiit", () => {
  it("MAGI below threshold → $0", () => {
    const niit = computeNiit(50_000, 200_000, Y2025, INFLATION);
    expect(niit).toBe(0);
  });

  it("MAGI above threshold → 3.8% on lesser-of", () => {
    // MAGI = 300_000, NII = 80_000, excess = 50_000 → lesser-of is 50_000
    const niit = computeNiit(80_000, 300_000, Y2025, INFLATION);
    expect(niit).toBeCloseTo(50_000 * 0.038, 2);
  });

  it("NII is the binding constraint", () => {
    // MAGI = 400_000 (excess=150k), NII = 10_000 → lesser-of is 10_000
    const niit = computeNiit(10_000, 400_000, Y2025, INFLATION);
    expect(niit).toBeCloseTo(10_000 * 0.038, 2);
  });
});

// ─── Full calculateTax round-trips ────────────────────────────────────────────

describe("calculateTax", () => {
  it("standard deduction eliminates tax at low income", () => {
    const snap = calculateTax({
      year: Y2025,
      inflationRate: INFLATION,
      ordinaryIncome: 20_000,
      longTermCapitalGains: 0,
      qualifiedDividends: 0,
      netInvestmentIncome: 0,
    });
    expect(snap.totalFederalTax).toBe(0);
    expect(snap.standardDeduction).toBe(29_200);
  });

  it("high dual-income household sanity check (~$600k ordinary)", () => {
    const snap = calculateTax({
      year: Y2025,
      inflationRate: INFLATION,
      ordinaryIncome: 600_000,
      longTermCapitalGains: 0,
      qualifiedDividends: 0,
      netInvestmentIncome: 0,
    });
    // Taxable = 600k - 29.2k = 570.8k; should be in 35% bracket
    expect(snap.marginalRate).toBe(0.35);
    expect(snap.totalFederalTax).toBeGreaterThan(130_000);
    expect(snap.effectiveRate).toBeGreaterThan(0.20);
  });

  it("includes Roth conversion tax cost", () => {
    const snap = calculateTax({
      year: Y2025,
      inflationRate: INFLATION,
      ordinaryIncome: 100_000,
      longTermCapitalGains: 0,
      qualifiedDividends: 0,
      netInvestmentIncome: 0,
      rothConversionAmount: 20_000,
    });
    expect(snap.rothConversionAmount).toBe(20_000);
    expect(snap.rothConversionTaxCost).toBeGreaterThan(0);
  });

  it("bracket inflation increases brackets in future years", () => {
    const snap2025 = calculateTax({
      year: 2025,
      inflationRate: INFLATION,
      ordinaryIncome: 200_000,
      longTermCapitalGains: 0,
      qualifiedDividends: 0,
      netInvestmentIncome: 0,
    });
    const snap2035 = calculateTax({
      year: 2035,
      inflationRate: INFLATION,
      ordinaryIncome: 200_000,
      longTermCapitalGains: 0,
      qualifiedDividends: 0,
      netInvestmentIncome: 0,
    });
    // Wider brackets in 2035 → less tax on the same nominal income
    expect(snap2035.totalFederalTax).toBeLessThan(snap2025.totalFederalTax);
  });
});

// ─── Roth Conversion Optimizer ────────────────────────────────────────────────

describe("optimizeRothConversion", () => {
  const base = {
    year: Y2025,
    inflationRate: INFLATION,
    ordinaryIncomeBeforeConversion: 60_000,
    longTermCapitalGains: 0,
    traditionalBalance: 1_000_000,
    targetBracket: "22pct" as const,
    bothRetired: true,
    olderSpouseAge: 62,
  };

  it("converts up to top of 22% bracket", () => {
    const result = optimizeRothConversion({
      ...base,
      ordinaryIncomeBeforeConversion: 60_000,
    });
    // Taxable ordinary = 60k - 29.2k = 30.8k; 22% bracket top = 201_050
    // Headroom = 201_050 - 30_800 = 170_250 → converts that much
    expect(result.conversionAmount).toBeGreaterThan(0);
    expect(result.conversionAmount).toBeLessThanOrEqual(1_000_000);
  });

  it("does not convert when already at or above target bracket", () => {
    const result = optimizeRothConversion({
      ...base,
      ordinaryIncomeBeforeConversion: 250_000, // taxable well above 201_050
    });
    expect(result.conversionAmount).toBe(0);
  });

  it("does not convert when not both retired", () => {
    const result = optimizeRothConversion({ ...base, bothRetired: false });
    expect(result.conversionAmount).toBe(0);
  });

  it("does not convert when older spouse is at RMD age", () => {
    const result = optimizeRothConversion({ ...base, olderSpouseAge: 73 });
    expect(result.conversionAmount).toBe(0);
  });

  it("capped by traditional balance", () => {
    const result = optimizeRothConversion({
      ...base,
      traditionalBalance: 5_000,
      ordinaryIncomeBeforeConversion: 40_000,
    });
    expect(result.conversionAmount).toBeLessThanOrEqual(5_000);
  });

  it("sets IRMAA warning when conversion pushes MAGI over threshold", () => {
    const result = optimizeRothConversion({
      ...base,
      ordinaryIncomeBeforeConversion: 200_000, // close to IRMAA threshold
    });
    // MAGI after conversion will exceed 212k
    expect(result.irmaaWarning).toBe(true);
  });
});

// ─── Backdoor Roth ────────────────────────────────────────────────────────────

describe("isBackdoorRothYear", () => {
  it("returns true when MAGI exceeds phase-out end", () => {
    expect(isBackdoorRothYear(300_000, Y2025, INFLATION)).toBe(true);
  });

  it("returns false when MAGI is below phase-out", () => {
    expect(isBackdoorRothYear(100_000, Y2025, INFLATION)).toBe(false);
  });
});

// ─── Bracket inflation ────────────────────────────────────────────────────────

describe("inflateBrackets", () => {
  it("brackets are unchanged in base year", () => {
    const inflated = inflateBrackets(TAX_BRACKETS_2025_MFJ, BASE_YEAR, INFLATION);
    expect(inflated[0].min).toBe(TAX_BRACKETS_2025_MFJ[0].min);
    expect(inflated[1].max).toBe(TAX_BRACKETS_2025_MFJ[1].max);
  });

  it("brackets grow with inflation over 10 years", () => {
    const inflated = inflateBrackets(TAX_BRACKETS_2025_MFJ, 2035, INFLATION);
    const factor = Math.pow(1 + INFLATION, 10);
    expect(inflated[0].max).toBeCloseTo(
      Math.round((TAX_BRACKETS_2025_MFJ[0].max as number) * factor),
      -1
    );
  });

  it("top bracket max stays null", () => {
    const inflated = inflateBrackets(TAX_BRACKETS_2025_MFJ, 2030, INFLATION);
    expect(inflated[inflated.length - 1].max).toBeNull();
  });
});
