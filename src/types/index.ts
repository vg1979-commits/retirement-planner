// ─── Household Profile ────────────────────────────────────────────────────────

export interface HouseholdProfile {
  id: string;
  name: string;
  createdAt: string; // ISO date
  updatedAt: string;

  spouse1: Person;
  spouse2: Person;
  children: Child[];

  planningHorizon: {
    endAge: number; // age to model through (e.g. 95 for the older spouse)
  };
}

export interface Person {
  name: string;
  birthYear: number;
  currentAge: number; // derived: currentYear - birthYear
  targetRetirementAge: number;
  currentAnnualIncome: number; // gross W2 salary
}

export interface Child {
  name: string;
  birthYear: number;
  currentAge: number;
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export type AccountType =
  | "traditional_401k"
  | "roth_401k"
  | "traditional_ira"
  | "roth_ira"
  | "brokerage"
  | "hsa"
  | "cash"
  | "deferred_comp"
  | "pension";

export interface Account {
  id: string;
  // "spouse1" | "spouse2" | "joint" | child's name; dynamically built from People & Timeline
  owner: string;
  type: AccountType;
  label: string; // e.g. "Vineet's 401k at Fidelity"
  currentBalance: number;
  annualContribution: number; // current year contribution (pre-tax where applicable)
  employerMatch?: number; // annual dollar amount of employer match
  vestingScheduleNote?: string; // free text, not modeled mechanically in v1
}

// ─── Income Streams ───────────────────────────────────────────────────────────

export type IncomeType = "w2_salary" | "rsu" | "bonus" | "rental" | "other";

export interface IncomeStream {
  id: string;
  owner: "spouse1" | "spouse2";
  type: IncomeType;
  label: string;
  annualAmount: number;
  startYear: number;
  endYear: number; // use retirementYear for salary; specific year for RSU cliff
  growthRate: number; // e.g. 0.03 = 3% annual raises
  taxTreatment: "ordinary_income" | "ltcg" | "tax_free";
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export interface ExpenseProfile {
  // Derived: sum of categories[].currentAmount / retirementAmount — read-only in UI
  currentAnnualSpending: number;
  retirementAnnualSpending: number;

  // Tab 4 copy toggle: when true, retirement amounts mirror current amounts in real time.
  // Inflation rate now lives on InvestmentAssumptions (single source of truth).
  copyCurrentToRetirement: boolean;

  categories: ExpenseCategory[]; // source of truth; drives both totals
}

export interface ExpenseCategory {
  id: string;
  label: string;            // e.g. "Housing", "Travel", "Healthcare"
  currentAmount: number;    // today's dollars; user-entered
  retirementAmount: number; // today's dollars; user-entered, or mirrored from currentAmount when copyCurrentToRetirement is true
  isCustom: boolean;        // false for default categories, true for user-added rows; only custom rows can be deleted
}

// ─── Investment Assumptions ───────────────────────────────────────────────────

export interface InvestmentAssumptions {
  preRetirementAllocation: AssetAllocation;
  postRetirementAllocation: AssetAllocation;

  // Nominal return assumptions
  equityMeanReturn: number;      // default 0.07
  equityStdDev: number;          // default 0.15
  bondMeanReturn: number;        // default 0.035
  bondStdDev: number;            // default 0.06
  cashReturn: number;            // default 0.045

  correlationEquityBond: number; // default -0.10
  inflationRate: number;         // default 0.025; single source of truth — used for expense growth and tax-bracket inflation
}

export interface AssetAllocation {
  equityPct: number; // 0–1
  bondPct: number;   // 0–1
  cashPct: number;   // 0–1
  // must sum to 1
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

/** Maximum federal bracket the Roth conversion optimizer will fill each year.
 *  Surfaces in the Tax View as the "Target Bracket" segmented control. */
export type RothConversionTargetBracket = "12pct" | "22pct" | "24pct";

export interface Scenario {
  id: string;
  label: string; // e.g. "Base Case — Retire at 58"
  color: string; // hex color for charts

  retirementAgeOverride?: { spouse1?: number; spouse2?: number };
  annualSpendingOverride?: number;
  allocationOverride?: Partial<InvestmentAssumptions>;
  additionalOneTimeExpenses?: OneTimeExpense[];

  // Roth conversion planner settings (Spec 04 §3.4 controls). Defaults: optimizer ON, 22%.
  enableRothOptimizer?: boolean;
  rothConversionTargetBracket?: RothConversionTargetBracket;
}

export interface OneTimeExpense {
  label: string; // e.g. "Beach house purchase"
  year: number;
  amount: number;
}

// ─── Simulation Output ────────────────────────────────────────────────────────

export interface SimulationResult {
  scenarioId: string;
  runDate: string;
  numSimulations: number;

  successRate: number; // fraction of runs that never hit $0

  annualProjections: AnnualProjection[];

  percentiles: {
    p10: number[];
    p25: number[];
    p50: number[]; // median
    p75: number[];
    p90: number[];
  };

  /** Roth conversion summary computed from the median path (Spec 03 §6.5). */
  rothConversionSummary: RothConversionSummary;
}

export interface AnnualProjection {
  year: number;
  age_spouse1: number;
  age_spouse2: number;

  // Income
  earnedIncome: number;
  investmentIncome: number;
  totalIncome: number;

  // Taxes
  federalTax: number;
  effectiveTaxRate: number;
  marginalRate: number; // marginal ordinary rate that year (used in Roth planner table)

  // Expenses
  totalExpenses: number;

  // Portfolio
  portfolioStartBalance: number;
  contributions: number;
  withdrawals: number;
  investmentGains: number; // median
  portfolioEndBalance: number;

  withdrawalBreakdown: { accountId: string; amount: number }[];

  // Roth Conversion Planner table (Spec 04 §3.4)
  traditionalBalanceStart: number;        // start-of-year sum across all traditional accounts
  rmdAmount: number;                       // RMDs taken this year (0 before age 73)
  rothConversionAmount: number;           // 0 if optimizer off / no headroom
  rothConversionTaxCost: number;
  conversionRationale?: string;            // plain-English explanation
  irmaaWarning: boolean;                   // conversion pushed MAGI over IRMAA threshold
}

// ─── Roth Conversion Summary (Spec 01 §8a) ───────────────────────────────────

export interface RothConversionSummary {
  totalConverted: number;                  // cumulative dollars converted across all years
  totalTaxCostWithConversions: number;     // lifetime federal tax with strategy enabled
  totalTaxCostWithoutConversions: number;  // lifetime federal tax if no conversions done
  estimatedTaxSavings: number;             // headline figure: without minus with
  conversionWindowStart: number | null;    // first year a conversion happened (null if none)
  conversionWindowEnd: number | null;      // last year a conversion happened (null if none)
  traditionalBalanceAtRMDAge: number;      // projected traditional balance at age 73 in the no-conversion baseline
  narrativeSummary: string;                // 2–3 sentence plain-English explanation for the UI summary bar
}

// ─── Tax Snapshot ─────────────────────────────────────────────────────────────

export interface TaxSnapshot {
  year: number;
  filingStatus: "married_filing_jointly";

  ordinaryIncome: number;
  longTermCapitalGains: number;
  qualifiedDividends: number;

  standardDeduction: number;
  taxableIncome: number;

  bracketBreakdown: TaxBracketLine[];
  totalFederalTax: number;
  effectiveRate: number;
  marginalRate: number;

  rothConversionAmount?: number;
  rothConversionTaxCost?: number;
  /** Plain-English explanation surfaced in the Tax View Roth Planner table. */
  conversionRationale?: string;
}

export interface TaxBracketLine {
  bracketMin: number;
  bracketMax: number | null;
  rate: number;
  incomeInBracket: number;
  taxInBracket: number;
}

// ─── App State ────────────────────────────────────────────────────────────────

export interface AppState {
  household: HouseholdProfile;
  accounts: Account[];
  incomeStreams: IncomeStream[];
  expenses: ExpenseProfile;
  investmentAssumptions: InvestmentAssumptions;
  scenarios: Scenario[];
  results: Record<string, SimulationResult>; // keyed by scenarioId
  ui: UIState;
}

export interface UIState {
  activeView: "inputs" | "projections" | "cashflow" | "taxes" | "scenarios" | "release-notes";
  activeScenarioIds: string[]; // which scenarios are shown on charts
  isSimulating: boolean;
  lastRunAt: string | null;
}

// ─── Save File Format (Spec 01 §10) ──────────────────────────────────────────

/** Versioned wrapper written to .json file on manual save */
export interface SaveFile {
  version: string;  // current: "1"
  savedAt: string;  // ISO 8601
  state: Omit<AppState, "results" | "ui">;
}
