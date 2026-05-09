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
  owner: "spouse1" | "spouse2" | "joint";
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
  currentAnnualSpending: number; // total household, today's dollars
  retirementAnnualSpending: number; // target in today's dollars
  inflationRate: number; // default 0.025 (2.5%)

  // Optional category breakdown (used for cash flow detail view)
  categories?: ExpenseCategory[];
}

interface ExpenseCategory {
  label: string; // e.g. "Housing", "Travel", "Healthcare"
  annualAmount: number;
  activeInRetirement: boolean;
  retirementAmount?: number; // if different from working years
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
  activeView: "inputs" | "projections" | "cashflow" | "taxes" | "scenarios";
  activeScenarioIds: string[]; // which scenarios are shown on charts
  isSimulating: boolean;
  lastRunAt: string | null;
}
```
