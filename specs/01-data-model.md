# Spec 01 — Data Model

All application state is typed in TypeScript. This file defines the canonical shape of every input and output object. The financial engine and UI both import from a shared `types/` directory.

---

## 1. Household Profile

```typescript
interface HouseholdProfile {
  id: string;
  name: string; // e.g. "Goyal Family Plan"
  createdAt: string; // ISO date
  updatedAt: string;

  spouse1: Person;
  spouse2: Person;
  children: Child[];

  planningHorizon: {
    endAge: number; // Age to model through (e.g. 95 for the older spouse)
  };
}

interface Person {
  name: string;
  birthYear: number;
  currentAge: number; // derived: currentYear - birthYear
  targetRetirementAge: number;
  currentAnnualIncome: number; // gross W2 salary
}

interface Child {
  name: string;
  birthYear: number;
  currentAge: number;
}
```

---

## 2. Accounts

```typescript
type AccountType =
  | "traditional_401k"
  | "roth_401k"
  | "traditional_ira"
  | "roth_ira"
  | "brokerage"
  | "hsa"
  | "cash"
  | "deferred_comp"
  | "pension";

interface Account {
  id: string;
  // "spouse1" | "spouse2" | "joint" | child's name (string from HouseholdProfile.children[].name)
  // UI dropdown is dynamically built from names entered in the People & Timeline tab
  owner: string;
  type: AccountType;
  label: string; // e.g. "Vineet's 401k at Fidelity"
  currentBalance: number;
  annualContribution: number; // current year contribution (pre-tax where applicable)
  employerMatch?: number; // annual dollar amount of employer match
  vestingScheduleNote?: string; // free text, not modeled mechanically in v1
}
```

---

## 3. Income Streams

```typescript
type IncomeType = "w2_salary" | "rsu" | "bonus" | "rental" | "other";

interface IncomeStream {
  id: string;
  // "spouse1" | "spouse2" — stored as internal key, displayed as the name entered in HouseholdProfile
  // Children cannot own income streams
  owner: "spouse1" | "spouse2";
  type: IncomeType;
  label: string;
  annualAmount: number;
  startYear: number;
  endYear: number; // use retirementYear for salary; specific year for RSU cliff
  growthRate: number; // annual % (e.g. 0.03 = 3% raises)
  taxTreatment: "ordinary_income" | "ltcg" | "tax_free";
}
```

---

## 4. Expenses

```typescript
interface ExpenseProfile {
  // Both totals are derived (read-only in UI) — sum of their respective category amounts
  currentAnnualSpending: number;    // = sum of categories[].currentAmount
  retirementAnnualSpending: number; // = sum of categories[].retirementAmount
  inflationRate: number;            // default 0.025 (2.5%)

  categories: ExpenseCategory[]; // always present; drives both totals
}

interface ExpenseCategory {
  id: string;
  label: string;         // e.g. "Housing", "Travel", "Healthcare"
  currentAmount: number; // today's dollars; user-entered
  retirementAmount: number; // today's dollars; user-entered independently
  isCustom: boolean;     // false for default categories, true for user-added rows
}
```

---

## 5. Investment Assumptions

```typescript
interface InvestmentAssumptions {
  // Pre-retirement
  preRetirementAllocation: AssetAllocation;
  // Post-retirement
  postRetirementAllocation: AssetAllocation;

  // Return assumptions (nominal)
  equityMeanReturn: number;      // default 0.07
  equityStdDev: number;          // default 0.15
  bondMeanReturn: number;        // default 0.035
  bondStdDev: number;            // default 0.06
  cashReturn: number;            // default 0.045 (current HYSA rates)

  correlationEquityBond: number; // default -0.10
  inflationRate: number;         // mirrors ExpenseProfile.inflationRate
}

interface AssetAllocation {
  equityPct: number;  // 0–1
  bondPct: number;    // 0–1
  cashPct: number;    // 0–1
  // must sum to 1
}
```

---

## 6. Scenario

```typescript
interface Scenario {
  id: string;
  label: string; // e.g. "Base Case — Retire at 58"
  color: string; // hex color for charts

  // Overrides — any field here overrides the base household plan
  retirementAgeOverride?: { spouse1?: number; spouse2?: number };
  annualSpendingOverride?: number;
  allocationOverride?: Partial<InvestmentAssumptions>;
  additionalOneTimeExpenses?: OneTimeExpense[];
}

interface OneTimeExpense {
  label: string; // e.g. "Beach house purchase"
  year: number;
  amount: number;
}
```

---

## 7. Simulation Output

```typescript
interface SimulationResult {
  scenarioId: string;
  runDate: string;
  numSimulations: number;

  successRate: number; // 0–1, fraction of runs that never hit $0

  // Per-year summary (median path)
  annualProjections: AnnualProjection[];

  // Percentile bands for chart ribbons
  percentiles: {
    p10: number[];  // portfolio balance by year
    p25: number[];
    p50: number[];  // median
    p75: number[];
    p90: number[];
  };
}

interface AnnualProjection {
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

  // Expenses
  totalExpenses: number;

  // Portfolio
  portfolioStartBalance: number;
  contributions: number;
  withdrawals: number;
  investmentGains: number; // median
  portfolioEndBalance: number;

  // Withdrawals by account (for sequencing transparency)
  withdrawalBreakdown: { accountId: string; amount: number }[];
}
```

---

## 8. Tax Snapshot (per year, per scenario)

```typescript
interface TaxSnapshot {
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

  rothConversionAmount?: number;   // if a conversion was done this year
  rothConversionTaxCost?: number;
}

interface TaxBracketLine {
  bracketMin: number;
  bracketMax: number | null;
  rate: number;
  incomeInBracket: number;
  taxInBracket: number;
}
```

---

## 9. App State (top-level store)

```typescript
interface AppState {
  household: HouseholdProfile;
  accounts: Account[];
  incomeStreams: IncomeStream[];
  expenses: ExpenseProfile;
  investmentAssumptions: InvestmentAssumptions;
  scenarios: Scenario[];
  results: Record<string, SimulationResult>; // keyed by scenarioId
  ui: UIState;
}

interface UIState {
  activeView: "inputs" | "projections" | "cashflow" | "taxes" | "scenarios" | "release-notes";
  activeScenarioIds: string[]; // which scenarios are shown on charts
  isSimulating: boolean;
  lastRunAt: string | null;
}
```

---

## 10. Save File Format

When the user saves their plan to a local `.json` file, it is wrapped in a versioned envelope. This allows future data model migrations without breaking old files.

```typescript
interface SaveFile {
  version: string;        // current: "1"
  savedAt: string;        // ISO 8601 datetime
  state: Omit<AppState, "results" | "ui">; // inputs only — no simulation results, no UI state
}
```

- `results` is excluded: always re-computed after import
- `ui` is excluded: UI resets to defaults on import (active view → "inputs")
- On import, the file is validated against the Zod schema for `SaveFile` before being applied
- If `version` is unrecognized, display a warning but attempt to load anyway

---

## 9. Initial State

The app starts with a completely empty state — no pre-filled demo data. All fields begin blank or at their minimum valid value. The Zustand store initializes with:

- `household`: empty names, birth years and salaries set to 0
- `accounts`: empty array
- `incomeStreams`: empty array
- `expenses`: all amounts 0, inflationRate defaulting to 0.025
- `investmentAssumptions`: default return/volatility values only (no allocation pre-set)
- `scenarios`: one empty baseline scenario ("Base Case") with no overrides
- `results`: empty record

The user must fill in all inputs before running a simulation. Empty-state UI (see Spec 04 §6) guides them through each section.

---

## Changelog
- 2026-05-09: Added §9 Initial State — app starts empty, no pre-filled demo data
- 2026-05-09: Account.owner changed from union literal to string — dynamically driven by names entered in People & Timeline
- 2026-05-09: IncomeStream.owner stays "spouse1" | "spouse2" internally but UI displays spouse names from Tab 1; children excluded from income ownership
- 2026-05-09: ExpenseProfile.currentAnnualSpending and retirementAnnualSpending are now derived fields; ExpenseCategory is now the source of truth with separate currentAmount and retirementAmount per category
- 2026-05-09: UIState.activeView updated to include "release-notes"
- 2026-05-09: Added §10 Save File Format — versioned SaveFile wrapper type for local .json export/import
