import { rangeProgressQueryOptions } from "../progressQueries";

function intervalFor(status: string): unknown {
  const options = rangeProgressQueryOptions("group-1");
  const interval = options.refetchInterval;
  if (typeof interval !== "function") return interval;
  return interval({
    state: { data: { status } },
  } as never);
}

describe("progress polling while offline", () => {
  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
    });
  });

  it("pauses polling offline", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });
    expect(intervalFor("running")).toBe(false);
  });

  it("resumes polling online and stops at a terminal status", () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
    });
    expect(intervalFor("running")).toBe(2_000);
    expect(intervalFor("complete")).toBe(false);
  });
});
