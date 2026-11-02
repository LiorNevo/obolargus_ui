import { readFileSync } from "node:fs";
import { join } from "node:path";
import { handleWorkerMessage, type MessageEffects } from "../messaging";

function effects(): MessageEffects {
  return {
    skipWaiting: jest.fn(),
    clearCaches: jest.fn().mockResolvedValue({ cleared: [], failed: [] }),
    getVersion: jest.fn().mockReturnValue({
      buildId: "b1",
      scope: "/obolargus/",
      scriptUrl: "/obolargus/service-worker.js",
    }),
    cleanupRetiredCaches: jest.fn().mockResolvedValue({ deleted: [] }),
  };
}

describe("update message contract", () => {
  it("does not claim clients and gates skipWaiting on a message", () => {
    const source = readFileSync(
      join(__dirname, "..", "service-worker.ts"),
      "utf8",
    );
    expect(source).not.toContain("clientsClaim");
    expect(source).not.toMatch(/^\s*self\.skipWaiting\(\)/m);
    expect(source).toContain("handleWorkerMessage");
    expect(source).toContain("skipWaiting: () =>");
  });

  it("activates only after SKIP_WAITING", async () => {
    const fake = effects();
    await handleWorkerMessage({ type: "SKIP_WAITING" }, fake);
    expect(fake.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it("reports the active version", async () => {
    const reply = await handleWorkerMessage(
      { type: "GET_VERSION", requestId: "v1" },
      effects(),
    );
    expect(reply?.payload).toEqual({
      buildId: "b1",
      scope: "/obolargus/",
      scriptUrl: "/obolargus/service-worker.js",
    });
  });

  it("cleans retired caches only for the requested build", async () => {
    const fake = effects();
    await handleWorkerMessage(
      {
        type: "CLEANUP_RETIRED_CACHES",
        requestId: "c1",
        payload: { keepBuildId: "build-current" },
      },
      fake,
    );
    expect(fake.cleanupRetiredCaches).toHaveBeenCalledWith("build-current");
  });
});
