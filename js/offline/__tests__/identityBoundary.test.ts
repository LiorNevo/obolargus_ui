import {
  clearOfflineCachesForIdentityChange,
} from "../identityBoundary";
import { useOfflineStore } from "../offlineStore";

class FakeMessageChannel {
  port1: { onmessage: ((event: { data: unknown }) => void) | null; close: jest.Mock };
  port2: { send: (data: unknown) => void };

  constructor() {
    const port1: {
      onmessage: ((event: { data: unknown }) => void) | null;
      close: jest.Mock;
    } = { onmessage: null, close: jest.fn() };
    this.port1 = port1;
    this.port2 = { send: (data) => port1.onmessage?.({ data }) };
  }
}

function installCaches(names: string[], failOn?: string) {
  let current = [...names];
  const remove = jest.fn(async (name: string) => {
    if (name === failOn) throw new Error("delete failed");
    current = current.filter((entry) => entry !== name);
    return true;
  });
  (globalThis as unknown as { caches: unknown }).caches = {
    keys: jest.fn(async () => [...current]),
    delete: remove,
  };
  return remove;
}

describe("identity boundary", () => {
  beforeEach(() => {
    useOfflineStore.getState().reset();
    Object.defineProperty(navigator, "serviceWorker", {
      value: {},
      configurable: true,
    });
    (globalThis as unknown as { MessageChannel: unknown }).MessageChannel =
      FakeMessageChannel;
  });

  it("clears runtime caches directly and preserves the shell", async () => {
    const remove = installCaches([
      "obolargus-api-scope-v1",
      "obolargus-static-scope-v1",
      "obolargus-precache-scope-v1",
      "unrelated",
    ]);

    const result = await clearOfflineCachesForIdentityChange();

    expect(result.clearedCaches).toEqual([
      "obolargus-api-scope-v1",
      "obolargus-static-scope-v1",
    ]);
    expect(result.failedCaches).toEqual([]);
    expect(remove).toHaveBeenCalledTimes(2);
    expect(useOfflineStore.getState().identity.clearStatus).toBe("cleared");
  });

  it("reports a blocking failure when a cache cannot be deleted", async () => {
    installCaches(
      ["obolargus-api-scope-v1", "obolargus-static-scope-v1"],
      "obolargus-api-scope-v1",
    );

    const result = await clearOfflineCachesForIdentityChange("sign-out");

    expect(result.failedCaches).toContain("obolargus-api-scope-v1");
    expect(useOfflineStore.getState().identity).toMatchObject({
      clearStatus: "failed",
      error: expect.stringMatching(/could not be cleared/i),
    });
  });

  it("uses the worker reply when a controller is available", async () => {
    const remove = installCaches(["obolargus-api-scope-v1"]);
    const postMessage = jest.fn((_message, ports: FakeMessageChannel["port2"][]) => {
      ports[0].send({
        type: "CACHES_CLEARED",
        requestId: "r1",
        payload: { cleared: ["worker-cache"], failed: [] },
      });
    });
    Object.defineProperty(navigator, "serviceWorker", {
      value: { controller: { postMessage } },
      configurable: true,
    });

    const result = await clearOfflineCachesForIdentityChange();

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "CLEAR_CACHES" }),
      expect.any(Array),
    );
    expect(result.clearedCaches).toEqual(["worker-cache"]);
    expect(remove).not.toHaveBeenCalled();
  });
});
