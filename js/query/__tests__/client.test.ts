import { createQueryClient, createTestQueryClient } from "../client";

describe("query client", () => {
  it("creates a distinct client per call", () => {
    const first = createQueryClient();
    const second = createQueryClient();
    expect(first).not.toBe(second);
  });

  it("applies the documented query defaults", () => {
    const client = createQueryClient();
    const defaults = client.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(30_000);
    expect(defaults.queries?.gcTime).toBe(600_000);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(true);
    expect(defaults.queries?.refetchOnReconnect).toBe(true);
    expect(defaults.mutations?.retry).toBe(false);
  });

  it("creates an isolated test client with retries disabled", () => {
    const client = createTestQueryClient();
    expect(client.getDefaultOptions().queries?.retry).toBe(false);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it("starts with an empty in-memory cache", () => {
    const client = createQueryClient();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
});
