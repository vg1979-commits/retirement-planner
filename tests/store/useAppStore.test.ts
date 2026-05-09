import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "../../src/store/useAppStore";

// Each test starts from a fresh empty state.
beforeEach(() => {
  useAppStore.getState().resetToEmpty();
});

describe("useAppStore — initial state", () => {
  it("starts with an empty household", () => {
    const s = useAppStore.getState();
    expect(s.household.spouse1.name).toBe("");
    expect(s.household.spouse1.birthYear).toBe(0);
    expect(s.household.spouse2.name).toBe("");
    expect(s.household.children).toHaveLength(0);
  });

  it("starts with no accounts", () => {
    expect(useAppStore.getState().accounts).toHaveLength(0);
  });

  it("starts with one baseline scenario", () => {
    const scenarios = useAppStore.getState().scenarios;
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].id).toBe("base");
    expect(scenarios[0].label).toBe("Base Case");
  });

  it("starts with no results and not simulating", () => {
    const s = useAppStore.getState();
    expect(s.results).toEqual({});
    expect(s.ui.isSimulating).toBe(false);
  });

  it("activeScenarioIds defaults to the base scenario", () => {
    const s = useAppStore.getState();
    expect(s.ui.activeScenarioIds).toEqual(["base"]);
  });

  it("expenses start with default inflation rate and 10 default categories", () => {
    const e = useAppStore.getState().expenses;
    expect(e.inflationRate).toBe(0.025);
    expect(e.categories.length).toBe(10);
    expect(e.currentAnnualSpending).toBe(0);
    expect(e.retirementAnnualSpending).toBe(0);
  });

  it("investmentAssumptions start with default return/volatility values", () => {
    const a = useAppStore.getState().investmentAssumptions;
    expect(a.equityMeanReturn).toBe(0.07);
    expect(a.equityStdDev).toBe(0.15);
    expect(a.bondMeanReturn).toBe(0.035);
    expect(a.bondStdDev).toBe(0.06);
    expect(a.cashReturn).toBe(0.045);
    expect(a.preRetirementAllocation.equityPct).toBe(0);
    expect(a.postRetirementAllocation.equityPct).toBe(0);
  });
});

describe("useAppStore — household actions", () => {
  it("updateHousehold patches and bumps updatedAt", async () => {
    const before = useAppStore.getState().household.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    useAppStore.getState().updateHousehold({ name: "Renamed" });
    const after = useAppStore.getState().household;
    expect(after.name).toBe("Renamed");
    expect(after.updatedAt >= before).toBe(true);
  });

  it("updateHousehold can add and edit children", () => {
    useAppStore.getState().updateHousehold({
      children: [{ name: "Alex", birthYear: 2012, currentAge: 14 }],
    });
    const after = useAppStore.getState().household;
    expect(after.children).toHaveLength(1);
    expect(after.children[0].name).toBe("Alex");
    expect(after.children[0].birthYear).toBe(2012);
  });
});

describe("useAppStore — account actions", () => {
  it("upsertAccount inserts a new account", () => {
    useAppStore.getState().upsertAccount({
      id: "new-acct", owner: "joint", type: "brokerage", label: "New", currentBalance: 50_000, annualContribution: 0,
    });
    const accts = useAppStore.getState().accounts;
    expect(accts).toHaveLength(1);
    expect(accts.find((a) => a.id === "new-acct")).toBeDefined();
  });

  it("upsertAccount replaces an existing account", () => {
    useAppStore.getState().upsertAccount({
      id: "acct-1", owner: "spouse1", type: "traditional_401k", label: "Original", currentBalance: 100_000, annualContribution: 23_500,
    });
    useAppStore.getState().upsertAccount({
      id: "acct-1", owner: "spouse1", type: "traditional_401k", label: "Updated", currentBalance: 999_999, annualContribution: 23_500,
    });
    const accts = useAppStore.getState().accounts;
    expect(accts).toHaveLength(1);
    expect(accts[0].label).toBe("Updated");
    expect(accts[0].currentBalance).toBe(999_999);
  });

  it("removeAccount removes by id", () => {
    useAppStore.getState().upsertAccount({ id: "acct-1", owner: "joint", type: "brokerage", label: "A", currentBalance: 0, annualContribution: 0 });
    useAppStore.getState().upsertAccount({ id: "acct-2", owner: "joint", type: "cash",      label: "B", currentBalance: 0, annualContribution: 0 });
    useAppStore.getState().removeAccount("acct-1");
    const accts = useAppStore.getState().accounts;
    expect(accts).toHaveLength(1);
    expect(accts[0].id).toBe("acct-2");
  });

  it("account owner accepts child name as a string", () => {
    useAppStore.getState().upsertAccount({ id: "acct-kid", owner: "Jordan", type: "brokerage", label: "Kid account", currentBalance: 5_000, annualContribution: 0 });
    const acct = useAppStore.getState().accounts.find((a) => a.id === "acct-kid");
    expect(acct?.owner).toBe("Jordan");
  });
});

describe("useAppStore — expense actions", () => {
  it("updateExpenses with new categories recomputes derived totals", () => {
    const cats = useAppStore.getState().expenses.categories.map((c) =>
      c.id === "cat-housing" ? { ...c, currentAmount: 60_000, retirementAmount: 50_000 } : c
    );
    useAppStore.getState().updateExpenses({ categories: cats });
    const e = useAppStore.getState().expenses;
    expect(e.currentAnnualSpending).toBe(60_000);
    expect(e.retirementAnnualSpending).toBe(50_000);
  });

  it("updateExpenses patches inflationRate without touching categories", () => {
    useAppStore.getState().updateExpenses({ inflationRate: 0.03 });
    expect(useAppStore.getState().expenses.inflationRate).toBe(0.03);
    expect(useAppStore.getState().expenses.categories).toHaveLength(10);
  });
});

describe("useAppStore — scenario actions", () => {
  it("removeScenario also clears its results and active id", () => {
    useAppStore.setState((s) => ({
      results: { ...s.results, base: { scenarioId: "base" } as any },
    }));
    useAppStore.getState().removeScenario("base");
    const s = useAppStore.getState();
    expect(s.scenarios.find((sc) => sc.id === "base")).toBeUndefined();
    expect(s.ui.activeScenarioIds).not.toContain("base");
    expect(s.results.base).toBeUndefined();
  });

  it("setActiveScenarios replaces the active list", () => {
    useAppStore.getState().upsertScenario({ id: "alt", label: "Alt", color: "#dc2626" });
    useAppStore.getState().setActiveScenarios(["base", "alt"]);
    expect(useAppStore.getState().ui.activeScenarioIds).toEqual(["base", "alt"]);
  });
});

describe("useAppStore — UI actions", () => {
  it("setActiveView changes the active view", () => {
    useAppStore.getState().setActiveView("projections");
    expect(useAppStore.getState().ui.activeView).toBe("projections");
  });

  it("setActiveView accepts release-notes", () => {
    useAppStore.getState().setActiveView("release-notes");
    expect(useAppStore.getState().ui.activeView).toBe("release-notes");
  });
});

describe("useAppStore — simulation lifecycle", () => {
  it("populates results and clears isSimulating after run", async () => {
    await useAppStore.getState().runSimulations(20);
    const s = useAppStore.getState();
    expect(s.ui.isSimulating).toBe(false);
    expect(s.ui.lastRunAt).not.toBeNull();
    expect(s.simulationProgress).toBe(1);
    for (const scenario of s.scenarios) {
      expect(s.results[scenario.id]).toBeDefined();
      expect(s.results[scenario.id].numSimulations).toBe(20);
    }
  });

  it("sets isSimulating=true synchronously when run starts", () => {
    const promise = useAppStore.getState().runSimulations(10);
    expect(useAppStore.getState().ui.isSimulating).toBe(true);
    return promise;
  });

  it("cancelSimulation resets simulating flag without throwing", async () => {
    const promise = useAppStore.getState().runSimulations(1_000);
    useAppStore.getState().cancelSimulation();
    await promise;
    expect(useAppStore.getState().ui.isSimulating).toBe(false);
  });
});

describe("useAppStore — resetToEmpty", () => {
  it("restores empty state after edits", () => {
    useAppStore.getState().upsertAccount({ id: "acct-1", owner: "joint", type: "brokerage", label: "Test", currentBalance: 50_000, annualContribution: 0 });
    useAppStore.getState().updateHousehold({ name: "My Family" });
    useAppStore.getState().resetToEmpty();
    const s = useAppStore.getState();
    expect(s.accounts).toHaveLength(0);
    expect(s.household.name).toBe("");
    expect(s.scenarios).toHaveLength(1);
    expect(s.scenarios[0].id).toBe("base");
  });
});
