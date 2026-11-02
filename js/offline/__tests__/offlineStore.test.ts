import { createOfflineStore } from "../offlineStore";

describe("offlineStore", () => {
  it("starts online and empty", () => {
    const store = createOfflineStore();
    expect(store.getState().status.state).toBe("online");
    expect(store.getState().provenance).toEqual({});
    expect(store.getState().update.state).toBe("idle");
  });

  it("records connectivity transitions", () => {
    const store = createOfflineStore();
    store.getState().setConnectivity("offline", "browser-offline");
    expect(store.getState().status).toMatchObject({
      state: "offline",
      reason: "browser-offline",
    });
    store.getState().setConnectivity("reconnecting", "reconnected");
    expect(store.getState().status.state).toBe("reconnecting");
  });

  it("marks a cache-served read offline without hiding unsupported", () => {
    const store = createOfflineStore();
    store.getState().markCacheServed();
    expect(store.getState().status.state).toBe("offline");
    store.getState().setConnectivity("unsupported", "unsupported");
    store.getState().markCacheServed();
    expect(store.getState().status.state).toBe("unsupported");
  });

  it("stores provenance by query key and clears it", () => {
    const store = createOfflineStore();
    const record = {
      queryKeyHash: "hash-1",
      requestUrl: "query:data-load",
      source: "cache" as const,
      cachedAt: 1,
      fetchedAt: 2,
      offline: true,
    };
    store.getState().recordProvenance(record);
    expect(store.getState().provenance["hash-1"]).toEqual(record);
    store.getState().clearProvenance("hash-1");
    expect(store.getState().provenance).toEqual({});
    store.getState().recordProvenance(record);
    store.getState().clearProvenance();
    expect(store.getState().provenance).toEqual({});
  });

  it("updates the update and identity slices", () => {
    const store = createOfflineStore();
    store.getState().setUpdateState({ state: "available", availableVersion: "v2" });
    expect(store.getState().update).toMatchObject({
      state: "available",
      availableVersion: "v2",
    });
    store.getState().setIdentityClear({
      clearStatus: "failed",
      error: "blocked",
    });
    expect(store.getState().identity).toMatchObject({
      clearStatus: "failed",
      error: "blocked",
    });
    store.getState().reset();
    expect(store.getState().update.state).toBe("idle");
    expect(store.getState().identity.clearStatus).toBe("idle");
  });

  it("contains no server payload fields", () => {
    const store = createOfflineStore();
    expect(Object.keys(store.getState())).not.toContain("data");
    expect(JSON.stringify(store.getState().provenance)).not.toContain("body");
  });
});
