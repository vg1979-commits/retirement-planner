import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildSaveFile,
  parseSaveFile,
  saveFilename,
  lsSave,
  lsLoad,
  SAVE_FILE_VERSION,
  type PlanState,
} from "../../src/utils/saveFile";
import { INITIAL_HOUSEHOLD, INITIAL_EXPENSES, INITIAL_INVESTMENT_ASSUMPTIONS, INITIAL_SCENARIOS } from "../../src/store/initialState";

// ─── localStorage mock ────────────────────────────────────────────────────────
// Vitest runs in node where localStorage is undefined. Provide a simple in-memory stub.
function makeLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
}

const lsMock = makeLocalStorageMock();
vi.stubGlobal("localStorage", lsMock);

// ─── Minimal valid plan state for testing ────────────────────────────────────
const BASE_STATE: PlanState = {
  household: INITIAL_HOUSEHOLD,
  accounts: [],
  incomeStreams: [],
  expenses: INITIAL_EXPENSES,
  investmentAssumptions: INITIAL_INVESTMENT_ASSUMPTIONS,
  scenarios: INITIAL_SCENARIOS,
};

describe("buildSaveFile", () => {
  it("wraps state with version and savedAt", () => {
    const file = buildSaveFile(BASE_STATE);
    expect(file.version).toBe(SAVE_FILE_VERSION);
    expect(file.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(file.state).toEqual(BASE_STATE);
  });
});

describe("saveFilename", () => {
  it("returns a dated filename", () => {
    const name = saveFilename();
    expect(name).toMatch(/^retirement-plan-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

describe("parseSaveFile", () => {
  it("parses a valid save file", () => {
    const file = buildSaveFile(BASE_STATE);
    const result = parseSaveFile(file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.versionWarning).toBe(false);
      expect(result.state.scenarios).toHaveLength(1);
    }
  });

  it("returns error for non-object input", () => {
    expect(parseSaveFile("not an object").ok).toBe(false);
    expect(parseSaveFile(null).ok).toBe(false);
    expect(parseSaveFile(42).ok).toBe(false);
  });

  it("returns error for missing required fields", () => {
    expect(parseSaveFile({ version: "1", savedAt: "2026-01-01" }).ok).toBe(false);
    expect(parseSaveFile({ version: "1", state: BASE_STATE }).ok).toBe(false);
  });

  it("returns error for malformed state", () => {
    const bad = { version: "1", savedAt: "2026-01-01T00:00:00Z", state: { household: "wrong" } };
    expect(parseSaveFile(bad).ok).toBe(false);
  });

  it("sets versionWarning=true for unrecognized version", () => {
    const file = { ...buildSaveFile(BASE_STATE), version: "99" };
    const result = parseSaveFile(file);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.versionWarning).toBe(true);
  });

  it("round-trips state with non-empty accounts", () => {
    const state: PlanState = {
      ...BASE_STATE,
      accounts: [{ id: "a1", owner: "joint", type: "brokerage", label: "Test", currentBalance: 100_000, annualContribution: 0 }],
    };
    const file = buildSaveFile(state);
    const result = parseSaveFile(file);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.accounts[0].currentBalance).toBe(100_000);
  });

  it("round-trips state with custom expense categories", () => {
    const state: PlanState = {
      ...BASE_STATE,
      expenses: {
        ...INITIAL_EXPENSES,
        categories: [{ id: "cat-1", label: "Housing", currentAmount: 5000, retirementAmount: 4000, isCustom: false }],
        currentAnnualSpending: 5000,
        retirementAnnualSpending: 4000,
      },
    };
    const result = parseSaveFile(buildSaveFile(state));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.expenses.categories[0].currentAmount).toBe(5000);
    }
  });
});

describe("localStorage save/load", () => {
  beforeEach(() => {
    lsMock.clear();
    // Reset call counts
    vi.clearAllMocks();
  });

  it("lsLoad returns null when nothing is saved", () => {
    expect(lsLoad()).toBeNull();
  });

  it("lsSave + lsLoad round-trips state", () => {
    lsSave(BASE_STATE);
    const loaded = lsLoad();
    expect(loaded).not.toBeNull();
    expect(loaded?.scenarios).toHaveLength(1);
    expect(loaded?.accounts).toHaveLength(0);
  });

  it("lsLoad returns null for corrupted data", () => {
    lsMock.getItem.mockReturnValueOnce("not-valid-json{{{");
    expect(lsLoad()).toBeNull();
  });

  it("lsLoad returns null for invalid schema", () => {
    lsMock.getItem.mockReturnValueOnce(JSON.stringify({ version: "1", savedAt: "x", state: {} }));
    expect(lsLoad()).toBeNull();
  });
});

describe("useAppStore — importState", () => {
  // Import the store inline to avoid cross-test contamination
  it("importState replaces plan and resets results/UI", async () => {
    const { useAppStore } = await import("../../src/store/useAppStore");
    useAppStore.getState().resetToEmpty();

    // Put some garbage state in
    useAppStore.getState().upsertAccount({ id: "old", owner: "joint", type: "cash", label: "Old", currentBalance: 1, annualContribution: 0 });

    const newState: PlanState = {
      ...BASE_STATE,
      household: { ...INITIAL_HOUSEHOLD, name: "Imported Family" },
      accounts: [{ id: "imported", owner: "spouse1", type: "brokerage", label: "Imported", currentBalance: 500_000, annualContribution: 0 }],
    };

    useAppStore.getState().importState(newState);
    const s = useAppStore.getState();

    expect(s.household.name).toBe("Imported Family");
    expect(s.accounts).toHaveLength(1);
    expect(s.accounts[0].id).toBe("imported");
    expect(s.results).toEqual({});
    expect(s.ui.activeView).toBe("inputs");
    expect(s.ui.isSimulating).toBe(false);
  });
});
