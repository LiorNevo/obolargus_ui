import { handleWorkerMessage, type MessageEffects } from "../messaging";

function effects(overrides: Partial<MessageEffects> = {}): MessageEffects {
  return {
    skipWaiting: jest.fn(),
    clearCaches: jest.fn().mockResolvedValue({ cleared: ["c1"], failed: [] }),
    getVersion: jest.fn().mockReturnValue({
      buildId: "b1",
      scope: "/obolargus/",
      scriptUrl: "/obolargus/service-worker.js",
    }),
    cleanupRetiredCaches: jest.fn().mockResolvedValue({ deleted: ["old"] }),
    ...overrides,
  };
}

describe("worker messaging", () => {
  it("activates only when SKIP_WAITING is received", async () => {
    const fake = effects();
    await expect(
      handleWorkerMessage({ type: "SKIP_WAITING" }, fake),
    ).resolves.toBeNull();
    expect(fake.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it("returns the cleared and failed cache names", async () => {
    const fake = effects({
      clearCaches: jest
        .fn()
        .mockResolvedValue({ cleared: ["a"], failed: ["b"] }),
    });
    await expect(
      handleWorkerMessage(
        { type: "CLEAR_CACHES", requestId: "r1", payload: {} },
        fake,
      ),
    ).resolves.toEqual({
      type: "CACHES_CLEARED",
      requestId: "r1",
      payload: { cleared: ["a"], failed: ["b"] },
    });
  });

  it("reports a failed clear without rejecting", async () => {
    const fake = effects({
      clearCaches: jest.fn().mockRejectedValue(new Error("boom")),
    });
    const reply = await handleWorkerMessage(
      { type: "CLEAR_CACHES", requestId: "r2", payload: {} },
      fake,
    );
    expect(reply).toMatchObject({
      type: "CACHES_CLEARED",
      payload: { cleared: [], failed: ["unknown"] },
    });
  });

  it("returns version information", async () => {
    const reply = await handleWorkerMessage(
      { type: "GET_VERSION", requestId: "r3", payload: undefined },
      effects(),
    );
    expect(reply).toEqual({
      type: "VERSION",
      requestId: "r3",
      payload: {
        buildId: "b1",
        scope: "/obolargus/",
        scriptUrl: "/obolargus/service-worker.js",
      },
    });
  });

  it("cleans retired caches with the requested build", async () => {
    const fake = effects();
    await expect(
      handleWorkerMessage(
        {
          type: "CLEANUP_RETIRED_CACHES",
          requestId: "r4",
          payload: { keepBuildId: "new" },
        },
        fake,
      ),
    ).resolves.toBeNull();
    expect(fake.cleanupRetiredCaches).toHaveBeenCalledWith("new");
  });

  it("ignores unknown and malformed messages", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    await expect(handleWorkerMessage(null, effects())).resolves.toBeNull();
    await expect(
      handleWorkerMessage({ type: "NOPE", requestId: "r5" }, effects()),
    ).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
