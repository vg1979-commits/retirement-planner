// All 2025 IRS values. The projector inflates these annually using inflationRate.

// ─── Federal Income Tax (MFJ) ─────────────────────────────────────────────────

export interface TaxBracket {
  min: number;
  max: number | null;
  rate: number;
}

export const TAX_BRACKETS_2025_MFJ: TaxBracket[] = [
  { min: 0,         max: 23_200,   rate: 0.10 },
  { min: 23_200,    max: 94_300,   rate: 0.12 },
  { min: 94_300,    max: 201_050,  rate: 0.22 },
  { min: 201_050,   max: 383_900,  rate: 0.24 },
  { min: 383_900,   max: 487_450,  rate: 0.32 },
  { min: 487_450,   max: 731_200,  rate: 0.35 },
  { min: 731_200,   max: null,     rate: 0.37 },
];

export const STANDARD_DEDUCTION_2025_MFJ = 29_200;

// ─── Long-Term Capital Gains (MFJ) ────────────────────────────────────────────

export const LTCG_BRACKETS_2025_MFJ: TaxBracket[] = [
  { min: 0,         max: 94_050,   rate: 0.00 },
  { min: 94_050,    max: 583_750,  rate: 0.15 },
  { min: 583_750,   max: null,     rate: 0.20 },
];

// ─── Net Investment Income Tax ────────────────────────────────────────────────

export const NIIT_RATE = 0.038;
export const NIIT_THRESHOLD_2025_MFJ = 250_000; // inflates annually

// ─── Medicare IRMAA (placeholder — v1 warns only) ─────────────────────────────

export const IRMAA_THRESHOLD_2025_MFJ = 212_000; // MAGI threshold for surcharge

// ─── Roth IRA Income Limits ───────────────────────────────────────────────────

// Above this MAGI, direct Roth contribution is phased out → use backdoor Roth
export const ROTH_PHASEOUT_START_2025_MFJ = 236_000;
export const ROTH_PHASEOUT_END_2025_MFJ   = 246_000;

// ─── Contribution Limits (2025) ───────────────────────────────────────────────

export const CONTRIBUTION_LIMITS_2025 = {
  k401_employee:      23_500, // under-50 employee deferral limit
  k401_catchup:        7_500, // additional catch-up if age ≥ 50
  k401_total:         70_000, // total (employee + employer) §415 limit
  ira:                 7_000, // traditional or Roth IRA
  ira_catchup:         1_000, // additional catch-up if age ≥ 50
  hsa_family:          8_550, // family HDHP coverage
  hsa_catchup:         1_000, // additional catch-up if age ≥ 55
} as const;

// ─── RMD Uniform Lifetime Table (IRS 2022+) ───────────────────────────────────
// Maps age → distribution period (divisor). Covers ages 72–120.

export const RMD_UNIFORM_LIFETIME_TABLE: Record<number, number> = {
  72: 27.4,
  73: 26.5,
  74: 25.5,
  75: 24.6,
  76: 23.7,
  77: 22.9,
  78: 22.0,
  79: 21.1,
  80: 20.2,
  81: 19.4,
  82: 18.5,
  83: 17.7,
  84: 16.8,
  85: 16.0,
  86: 15.2,
  87: 14.4,
  88: 13.7,
  89: 12.9,
  90: 12.2,
  91: 11.5,
  92: 10.8,
  93: 10.1,
  94:  9.5,
  95:  8.9,
  96:  8.4,
  97:  7.8,
  98:  7.3,
  99:  6.8,
  100: 6.4,
  101: 6.0,
  102: 5.6,
  103: 5.2,
  104: 4.9,
  105: 4.6,
  106: 4.3,
  107: 4.1,
  108: 3.9,
  109: 3.7,
  110: 3.5,
  111: 3.4,
  112: 3.3,
  113: 3.1,
  114: 3.0,
  115: 2.9,
  116: 2.8,
  117: 2.7,
  118: 2.5,
  119: 2.3,
  120: 2.0,
};

// Age at which RMDs become mandatory
export const RMD_START_AGE = 73;

// Age at which penalty-free 401k/IRA withdrawals begin
export const EARLY_WITHDRAWAL_PENALTY_FREE_AGE = 59.5;

// ─── Simulation Defaults ──────────────────────────────────────────────────────

export const DEFAULT_NUM_SIMULATIONS = 1_000;
export const BASE_YEAR = 2025;
