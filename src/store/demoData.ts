// Demo data reflects a high-income dual-W2 family with ~$3.4M net worth,
// matching the family profile in CLAUDE.md. Values are illustrative only.

import type {
  Account,
  ExpenseProfile,
  HouseholdProfile,
  IncomeStream,
  InvestmentAssumptions,
  Scenario,
} from "../types";

export const DEMO_HOUSEHOLD: HouseholdProfile = {
  id: "household-demo",
  name: "Demo Family Plan",
  createdAt: "2026-05-08",
  updatedAt: "2026-05-08",
  spouse1: {
    name: "Spouse 1",
    birthYear: 1979,
    currentAge: 47,
    targetRetirementAge: 60,
    currentAnnualIncome: 425_000,
  },
  spouse2: {
    name: "Spouse 2",
    birthYear: 1980,
    currentAge: 46,
    targetRetirementAge: 60,
    currentAnnualIncome: 285_000,
  },
  children: [
    { name: "Child 1", birthYear: 2010, currentAge: 15 },
    { name: "Child 2", birthYear: 2016, currentAge: 9 },
  ],
  planningHorizon: { endAge: 95 },
};

export const DEMO_ACCOUNTS: Account[] = [
  { id: "cash-joint",     owner: "joint",   type: "cash",              label: "Joint Cash / HYSA",        currentBalance: 150_000,   annualContribution: 0 },
  { id: "brokerage-joint", owner: "joint",  type: "brokerage",         label: "Joint Taxable Brokerage",  currentBalance: 1_400_000, annualContribution: 0 },
  { id: "401k-s1",        owner: "spouse1", type: "traditional_401k",  label: "Spouse 1 401(k)",          currentBalance: 850_000,   annualContribution: 23_500, employerMatch: 12_750 },
  { id: "401k-s2",        owner: "spouse2", type: "traditional_401k",  label: "Spouse 2 401(k)",          currentBalance: 575_000,   annualContribution: 23_500, employerMatch: 8_550 },
  { id: "ira-s1",         owner: "spouse1", type: "roth_ira",          label: "Spouse 1 Roth IRA",        currentBalance: 165_000,   annualContribution: 7_000, vestingScheduleNote: "Backdoor Roth — MAGI exceeds limit" },
  { id: "ira-s2",         owner: "spouse2", type: "roth_ira",          label: "Spouse 2 Roth IRA",        currentBalance: 135_000,   annualContribution: 7_000, vestingScheduleNote: "Backdoor Roth — MAGI exceeds limit" },
  { id: "hsa-s1",         owner: "spouse1", type: "hsa",               label: "Spouse 1 HSA",             currentBalance: 55_000,    annualContribution: 8_550 },
  { id: "deferred-s1",    owner: "spouse1", type: "deferred_comp",     label: "Spouse 1 Deferred Comp",   currentBalance: 90_000,    annualContribution: 30_000 },
];

export const DEMO_INCOME_STREAMS: IncomeStream[] = [
  { id: "s1-w2",     owner: "spouse1", type: "w2_salary", label: "Spouse 1 W2 Salary", annualAmount: 425_000, startYear: 2026, endYear: 2039, growthRate: 0.03, taxTreatment: "ordinary_income" },
  { id: "s2-w2",     owner: "spouse2", type: "w2_salary", label: "Spouse 2 W2 Salary", annualAmount: 285_000, startYear: 2026, endYear: 2040, growthRate: 0.03, taxTreatment: "ordinary_income" },
  { id: "s1-bonus",  owner: "spouse1", type: "bonus",     label: "Spouse 1 Bonus",     annualAmount:  85_000, startYear: 2026, endYear: 2039, growthRate: 0.03, taxTreatment: "ordinary_income" },
  { id: "s1-rsu",    owner: "spouse1", type: "rsu",       label: "Spouse 1 RSU Vest",  annualAmount: 120_000, startYear: 2026, endYear: 2032, growthRate: 0.00, taxTreatment: "ordinary_income" },
];

export const DEMO_EXPENSES: ExpenseProfile = {
  currentAnnualSpending: 240_000,
  retirementAnnualSpending: 178_000,
  inflationRate: 0.025,
  categories: [
    { id: "cat-housing",    label: "Housing",                  currentAmount: 72_000, retirementAmount: 60_000, isCustom: false },
    { id: "cat-childcare",  label: "Childcare & Education",    currentAmount: 24_000, retirementAmount: 0,      isCustom: false },
    { id: "cat-food",       label: "Food & Groceries",         currentAmount: 30_000, retirementAmount: 30_000, isCustom: false },
    { id: "cat-travel",     label: "Travel & Vacation",        currentAmount: 30_000, retirementAmount: 40_000, isCustom: false },
    { id: "cat-healthcare", label: "Healthcare",               currentAmount: 18_000, retirementAmount: 24_000, isCustom: false },
    { id: "cat-transport",  label: "Transportation",           currentAmount: 18_000, retirementAmount: 12_000, isCustom: false },
    { id: "cat-personal",   label: "Personal & Shopping",      currentAmount: 48_000, retirementAmount: 12_000, isCustom: false },
  ],
};

export const DEMO_INVESTMENT_ASSUMPTIONS: InvestmentAssumptions = {
  preRetirementAllocation:  { equityPct: 0.80, bondPct: 0.15, cashPct: 0.05 },
  postRetirementAllocation: { equityPct: 0.55, bondPct: 0.35, cashPct: 0.10 },
  equityMeanReturn: 0.07,
  equityStdDev: 0.15,
  bondMeanReturn: 0.035,
  bondStdDev: 0.06,
  cashReturn: 0.045,
  correlationEquityBond: -0.10,
  inflationRate: 0.025,
};

export const DEMO_SCENARIOS: Scenario[] = [
  { id: "base", label: "Base Case — Retire at 60", color: "#2563eb" },
  {
    id: "early",
    label: "Early Retire at 55",
    color: "#dc2626",
    retirementAgeOverride: { spouse1: 55, spouse2: 55 },
  },
  {
    id: "lean",
    label: "Lean FI — Spend $140k",
    color: "#16a34a",
    annualSpendingOverride: 140_000,
  },
];
