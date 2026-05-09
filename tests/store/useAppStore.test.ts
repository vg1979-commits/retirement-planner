import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "../../src/store/useAppStore";

// Each test starts from a fresh demo state.
beforeEach(() => {
  useAppStore.getState().resetToDemo();
});

describe("useAppStore — initial state", () => {
  it("loads demo household", () => {
    const s = useAppStore.getState();
    expect(s.household.id).toBe("household-demo");
    expect(s.household.children).toHaveLength(2);
  });

  it("loads demo accounts spanning multiple types", () => {
    const accts = useAppStore.getState().accounts;
    const types = new Set(accts.map((a) => a.type));
    expect(types.has("traditional_401k")).toBe(true);
    expect(types.has("roth_ira")).toBe(true);
    expect(types.has("brokerage")).toBe(true);
    expect(types.has("cash")).toBe(true);
    expect(types.has("hsa")).toBe(true);
  });

  it("loads demo scenarios", () => {
    expect(useAppStore.getState().scenarios.length).toBeGreaterThanOrEqual(2);
  });

  it("starts with no results and not simulating", () => {
    const s = useAppStore.getState();
    expect(s.results).toEqual({});
    expect(s.ui.isSimulating).toBe(false);
  });

  it("activeScenarioIds defaults to all demo scenarios", () => {
    const s = useAppStore.getState();
    expect(s.ui.activeScenarioIds).toHaveLength(s.scenarios.length);
  });
});

describe("useAppStore — household actions", () => {
  it("updateHousehold patches and bumps updatedAt", async () => {
    const before = useAppStore.getState().household.updatedAt;
    // Wait a tick so the timestamp differs even on fast machines
    await new Promise((r) => setTimeout(r, 5));
    useAppStore.getState().updateHousehold({ name: "Renamed" });
    const after = useAppStore.getState().household;
    expect(after.name).toBe("Renamed");
    expect(after.updatedAt >= before).toBe(true);
  });

  it("updateHousehold can edit a child's name and birth year", () => {
    const before = useAppStore.getState().household.children;
    const next = [...before];
    next[0] = { ...next[0], name: "Alex", birthYear: 2012, currentAge: 2026 - 2012 };
    useAppStore.getState().updateHousehold({ children: next });
    const after = useAppStore.getState().household;
    expect(after.children[0].name).toBe("Alex");
    expect(after.children[0].birthYear).toBe(2012);
    expect(after.children[0].currentAge).toBe(14);
    // second child unchanged
    expect(after.children[1].birthYear).toBe(before[1].birthYear);
  });
});

describe("useAppStore — account actions", () => {
  it("upsertAccount inserts a new account", () => {
    useAppStore.getState().upsertAccount({
      id: "new-acct", owner: "joint", type: "brokerage", label: "New", currentBalance: 50_000, annualContribution: 0,
    });
    const accts = useAppStore.getState().accounts;
    expect(accts.find((a) => a.id === "new-acct")).toBeDefined();
  });

  it("upsertAccount replaces an existing account", () => {
    useAppStore.getState().upsertAccount({
      id: "401k-s1", owner: "spouse1", type: "traditional_401k", label: "Updated", currentBalance: 999_999, annualContribution: 23_500,
    });
    const acct = useAppStore.getState().accounts.find((a) => a.id === "401k-s1");
    expect(acct?.label).toBe("Updated");
    expect(acct?.currentBalance).toBe(999_999);
  });

  it("removeAccount removes by id", () => {
    const before = useAppStore.getState().accounts.length;
    useAppStore.getState().removeAccount("401k-s1");
    const after = useAppStore.getState().accounts.length;
    expect(after).toBe(before - 1);
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
    useAppStore.getState().setActiveScenarios(["base"]);
    expect(useAppStore.getState().ui.activeScenarioIds).toEqual(["base"]);
  });
});

describe("useAppStore — UI actions", () => {
  it("setActiveView changes the active view", () => {
    useAppStore.getState().setActiveView("projections");
    expect(useAppStore.getState().ui.activeView).toBe("projections");
  });
});

describe("useAppStore — simulation lifecycle", () => {
  it("populates results and clears isSimulating after run", async () => {
    await useAppStore.getState().runSimulations(20);
    const s = useAppStore.getState();
    expect(s.ui.isSimulating).toBe(false);
    expect(s.ui.lastRunAt).not.toBeNull();
    expect(s.simulationProgress).toBe(1);

    // One result per demo scenario, keyed by scenarioId
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
    // The promise rejects internally with "cancelled" but runSimulations
    // swallows that — caller's await should resolve normally.
    await promise;
    expect(useAppStore.getState().ui.isSimulating).toBe(false);
  });
});

describe("useAppStore — resetToDemo", () => {
  it("restores demo data after edits", () => {
    useAppStore.getState().removeAccount("401k-s1");
    useAppStore.getState().resetToDemo();
    expect(useAppStore.getState().accounts.find((a) => a.id === "401k-s1")).toBeDefined();
  });
});
