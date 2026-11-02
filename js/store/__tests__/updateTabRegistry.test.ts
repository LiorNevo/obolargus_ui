import { useUpdateTabRegistry } from "../updateTabRegistry";

describe("updateTabRegistry", () => {
  beforeEach(() => {
    useUpdateTabRegistry.getState().clear();
  });

  it("tracks announced tabs and reloads", () => {
    const registry = useUpdateTabRegistry.getState();
    registry.begin("build-2", 1_000);
    registry.addTab("a");
    registry.addTab("b");
    expect(useUpdateTabRegistry.getState().tabIds).toEqual(["a", "b"]);

    registry.markReloaded("a");
    expect(useUpdateTabRegistry.getState().canCleanup(1_001)).toBe(false);
    registry.markClosed("b");
    expect(useUpdateTabRegistry.getState().canCleanup(1_002)).toBe(true);
  });

  it("blocks cleanup while a tab is pending", () => {
    const registry = useUpdateTabRegistry.getState();
    registry.begin("build-2", 1_000);
    registry.addTab("a");
    registry.markPending("a");
    registry.markReloaded("a");
    expect(useUpdateTabRegistry.getState().pendingTabIds).toEqual([]);
    registry.markPending("a");
    expect(useUpdateTabRegistry.getState().canCleanup(1_001)).toBe(false);
  });

  it("allows cleanup after the grace expiry for crashed tabs", () => {
    const registry = useUpdateTabRegistry.getState();
    registry.begin("build-2", 1_000);
    registry.addTab("a");
    expect(useUpdateTabRegistry.getState().canCleanup(1_001)).toBe(false);
    expect(useUpdateTabRegistry.getState().canCleanup(1_000 + 10 * 60 * 1000)).toBe(
      true,
    );
  });

  it("never claims cleanup without an announced tab", () => {
    expect(useUpdateTabRegistry.getState().canCleanup(9_999_999)).toBe(false);
  });

  it("persists ids only", () => {
    const registry = useUpdateTabRegistry.getState();
    registry.begin("build-2", 1_000);
    registry.addTab("a");
    const serialized = JSON.stringify(useUpdateTabRegistry.getState());
    expect(serialized).toContain("build-2");
    expect(serialized).not.toContain("payload");
    expect(serialized).not.toContain("market_price");
  });
});
