import { useNavigationStore } from "../navigationStore";

describe("navigationStore", () => {
  beforeEach(() => {
    useNavigationStore.setState({ path: null, updatedAt: 0 });
  });

  it("records an in-scope route with a timestamp", () => {
    useNavigationStore.getState().setLastRoute("/obolargus/data-load");
    const state = useNavigationStore.getState();
    expect(state.path).toBe("/obolargus/data-load");
    expect(state.updatedAt).toBeGreaterThan(0);
  });

  it("rejects routes outside the base path", () => {
    useNavigationStore.getState().setLastRoute("/obolargus-next/data-load");
    expect(useNavigationStore.getState().path).toBeNull();
  });

  it("does not store the bare launch root", () => {
    useNavigationStore.getState().setLastRoute("/obolargus/");
    expect(useNavigationStore.getState().path).toBeNull();
  });

  it("clears the stored route", () => {
    useNavigationStore.getState().setLastRoute("/obolargus/data-load");
    useNavigationStore.getState().clear();
    expect(useNavigationStore.getState().path).toBeNull();
    expect(useNavigationStore.getState().updatedAt).toBe(0);
  });

  it("persists only the path and timestamp", () => {
    useNavigationStore.getState().setLastRoute("/obolargus/data-load");
    const serialized = JSON.stringify(useNavigationStore.getState());
    expect(serialized).not.toContain("price");
    expect(serialized).not.toContain("payload");
  });
});
