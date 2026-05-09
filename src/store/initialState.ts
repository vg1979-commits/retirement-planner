import type {
  Account,
  ExpenseProfile,
  HouseholdProfile,
  IncomeStream,
  InvestmentAssumptions,
  Scenario,
} from "../types";

export const INITIAL_HOUSEHOLD: HouseholdProfile = {
  id: "household-1",
  name: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  spouse1: {
    name: "",
    birthYear: 0,
    currentAge: 0,
    targetRetirementAge: 65,
    currentAnnualIncome: 0,
  },
  spouse2: {
    name: "",
    birthYear: 0,
    currentAge: 0,
    targetRetirementAge: 65,
    currentAnnualIncome: 0,
  },
  children: [],
  planningHorizon: { endAge: 95 },
};

export const INITIAL_ACCOUNTS: Account[] = [];

export const INITIAL_INCOME_STREAMS: IncomeStream[] = [];

export const INITIAL_EXPENSES: ExpenseProfile = {
  currentAnnualSpending: 0,
  retirementAnnualSpending: 0,
  inflationRate: 0.025,
  categories: [],
};

export const INITIAL_INVESTMENT_ASSUMPTIONS: InvestmentAssumptions = {
  preRetirementAllocation:  { equityPct: 0, bondPct: 0, cashPct: 0 },
  postRetirementAllocation: { equityPct: 0, bondPct: 0, cashPct: 0 },
  equityMeanReturn: 0.07,
  equityStdDev: 0.15,
  bondMeanReturn: 0.035,
  bondStdDev: 0.06,
  cashReturn: 0.045,
  correlationEquityBond: -0.10,
  inflationRate: 0.025,
};

export const INITIAL_SCENARIOS: Scenario[] = [
  { id: "base", label: "Base Case", color: "#2563eb" },
];
