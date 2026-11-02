import { useOfflineStore } from "../offlineStore";
import { useNavigationStore } from "../../store/navigationStore";
import { useUpdateTabRegistry } from "../../store/updateTabRegistry";
import { useDataLoadStore } from "../../store/dataLoadStore";

describe("offline persistence boundaries", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useOfflineStore.getState().reset();
    useNavigationStore.getState().clear();
    useUpdateTabRegistry.getState().clear();
  });

  it("keeps connectivity and provenance in memory only", () => {
    useOfflineStore.getState().recordProvenance({
      queryKeyHash: "h1",
      requestUrl: "query:data",
      source: "cache",
      cachedAt: 1,
      fetchedAt: 2,
      offline: true,
    });
    expect((useOfflineStore as unknown as { persist?: unknown }).persist).toBeUndefined();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("persists only the last route path and timestamp", () => {
    useNavigationStore.getState().setLastRoute("/obolargus/data-load");
    const state = useNavigationStore.getState();
    expect(Object.keys(state)).toEqual(
      expect.arrayContaining(["basePath", "path", "updatedAt"]),
    );
    expect(JSON.stringify(state)).not.toContain("identifier");
    expect(JSON.stringify(state)).not.toContain("report");
    expect(localStorage.length).toBe(0);
  });

  it("persists only tab and build ids for update coordination", () => {
    useUpdateTabRegistry.getState().begin("build-2", 1);
    useUpdateTabRegistry.getState().addTab("tab-a");
    const serialized = JSON.stringify(useUpdateTabRegistry.getState());
    expect(serialized).toContain("build-2");
    expect(serialized).not.toContain("identifier");
    expect(serialized).not.toContain("price");
  });

  it("keeps durable UI drafts in the existing Zustand store", () => {
    useDataLoadStore.getState().setDraft({ identifierText: "AAPL" });
    expect(useDataLoadStore.getState().draft.identifierText).toBe("AAPL");
    expect(localStorage.length).toBe(0);
  });
});
