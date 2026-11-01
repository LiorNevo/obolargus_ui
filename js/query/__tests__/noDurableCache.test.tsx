import { createTestQueryClient } from "../client";
import { queryKeys } from "../keys";

describe("durable storage boundary", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("does not serialize server data to web storage", async () => {
    const client = createTestQueryClient();
    await client.fetchQuery({
      queryKey: queryKeys.dataLoad.domains(),
      queryFn: () => Promise.resolve({ domains: [] }),
    });

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("starts empty after a simulated reload", async () => {
    const beforeReload = createTestQueryClient();
    await beforeReload.fetchQuery({
      queryKey: queryKeys.dataLoad.domains(),
      queryFn: () => Promise.resolve({ domains: [] }),
    });
    expect(beforeReload.getQueryCache().getAll()).toHaveLength(1);

    const afterReload = createTestQueryClient();
    expect(afterReload.getQueryCache().getAll()).toHaveLength(0);
  });
});
