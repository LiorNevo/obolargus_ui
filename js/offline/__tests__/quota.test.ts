import { buildCachePolicies, isRuntimeDataCacheName } from "../cachePolicy";
import { handleWorkerMessage } from "../../service-worker/messaging";

const context = {
  basePath: "/obolargus",
  apiBasePath: "/obolargus/api",
  buildId: "b1",
};

describe("quota-handling policy", () => {
  it("marks both runtime caches as purgeable", () => {
    const policies = buildCachePolicies(context);
    expect(
      policies.filter((policy) =>
        ["api-read", "static-asset"].includes(policy.id),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ purgeOnQuotaError: true }),
        expect.objectContaining({ purgeOnQuotaError: true }),
      ]),
    );
  });

  it("only treats runtime caches as purge/clear candidates", () => {
    expect(isRuntimeDataCacheName("obolargus-api-scope-v1")).toBe(true);
    expect(isRuntimeDataCacheName("obolargus-static-scope-v1")).toBe(true);
    expect(isRuntimeDataCacheName("obolargus-precache-scope-v1")).toBe(false);
  });

  it("never rejects a message handler on a failed cache operation", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      handleWorkerMessage(
        { type: "CLEAR_CACHES", requestId: "q1", payload: {} },
        {
          skipWaiting: jest.fn(),
          clearCaches: jest.fn().mockRejectedValue(new Error("quota")),
          getVersion: jest.fn(),
          cleanupRetiredCaches: jest.fn(),
        },
      ),
    ).resolves.toMatchObject({
      type: "CACHES_CLEARED",
      payload: { failed: ["unknown"] },
    });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
