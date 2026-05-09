import { z } from "zod";
import type { AppState, SaveFile } from "../types";

// ─── Current format version ───────────────────────────────────────────────────
export const SAVE_FILE_VERSION = "1";

// ─── Zod schemas (light validation — structural checks only) ─────────────────

const assetAllocationSchema = z.object({
  equityPct: z.number(),
  bondPct: z.number(),
  cashPct: z.number(),
});

const personSchema = z.object({
  name: z.string(),
  birthYear: z.number(),
  currentAge: z.number(),
  targetRetirementAge: z.number(),
  currentAnnualIncome: z.number(),
});

const childSchema = z.object({
  name: z.string(),
  birthYear: z.number(),
  currentAge: z.number(),
});

const householdSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  spouse1: personSchema,
  spouse2: personSchema,
  children: z.array(childSchema),
  planningHorizon: z.object({ endAge: z.number() }),
});

const accountSchema = z.object({
  id: z.string(),
  owner: z.string(),
  type: z.string(),
  label: z.string(),
  currentBalance: z.number(),
  annualContribution: z.number(),
  employerMatch: z.number().optional(),
  vestingScheduleNote: z.string().optional(),
});

const incomeStreamSchema = z.object({
  id: z.string(),
  owner: z.enum(["spouse1", "spouse2"]),
  type: z.string(),
  label: z.string(),
  annualAmount: z.number(),
  startYear: z.number(),
  endYear: z.number(),
  growthRate: z.number(),
  taxTreatment: z.string(),
});

const expenseCategorySchema = z.object({
  id: z.string(),
  label: z.string(),
  currentAmount: z.number(),
  retirementAmount: z.number(),
  isCustom: z.boolean(),
});

const expenseProfileSchema = z.object({
  currentAnnualSpending: z.number(),
  retirementAnnualSpending: z.number(),
  inflationRate: z.number(),
  categories: z.array(expenseCategorySchema),
});

const investmentAssumptionsSchema = z.object({
  preRetirementAllocation: assetAllocationSchema,
  postRetirementAllocation: assetAllocationSchema,
  equityMeanReturn: z.number(),
  equityStdDev: z.number(),
  bondMeanReturn: z.number(),
  bondStdDev: z.number(),
  cashReturn: z.number(),
  correlationEquityBond: z.number(),
  inflationRate: z.number(),
});

const scenarioSchema = z.object({
  id: z.string(),
  label: z.string(),
  color: z.string(),
  retirementAgeOverride: z.object({ spouse1: z.number().optional(), spouse2: z.number().optional() }).optional(),
  annualSpendingOverride: z.number().optional(),
});

const saveStateSchema = z.object({
  household: householdSchema,
  accounts: z.array(accountSchema),
  incomeStreams: z.array(incomeStreamSchema),
  expenses: expenseProfileSchema,
  investmentAssumptions: investmentAssumptionsSchema,
  scenarios: z.array(scenarioSchema),
});

export const saveFileSchema = z.object({
  version: z.string(),
  savedAt: z.string(),
  state: saveStateSchema,
});

// ─── Serialise & download ─────────────────────────────────────────────────────

export type PlanState = Omit<AppState, "results" | "ui">;

export function buildSaveFile(state: PlanState): SaveFile {
  return {
    version: SAVE_FILE_VERSION,
    savedAt: new Date().toISOString(),
    state,
  };
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function saveFilename(): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `retirement-plan-${date}.json`;
}

// ─── Parse & validate ─────────────────────────────────────────────────────────

export type ParseResult =
  | { ok: true; state: PlanState; versionWarning: boolean }
  | { ok: false; error: string };

export function parseSaveFile(raw: unknown): ParseResult {
  const result = saveFileSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: "This file doesn't look like a valid retirement plan. Please check the file and try again." };
  }
  const { version, state } = result.data;
  const versionWarning = version !== SAVE_FILE_VERSION;
  return { ok: true, state: state as PlanState, versionWarning };
}

export function readJsonFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(JSON.parse(e.target?.result as string));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    };
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsText(file);
  });
}

// ─── localStorage ─────────────────────────────────────────────────────────────

const LS_KEY = "retirement-planner-state";

export function lsSave(state: PlanState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(buildSaveFile(state)));
  } catch {
    // Quota exceeded or private browsing — silently ignore
  }
}

export function lsLoad(): PlanState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const result = parseSaveFile(JSON.parse(raw));
    return result.ok ? result.state : null;
  } catch {
    return null;
  }
}
