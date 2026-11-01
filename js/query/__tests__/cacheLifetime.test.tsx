import { act } from "@testing-library/react";
import { createTestQueryClient } from "../client";

describe("cache lifetime", () => {
  afterEach(() => jest.useRealTimers());

  it("evicts an unobserved entry after its gc time", async () => {
    jest.useFakeTimers();
    const client = createTestQueryClient();
    await client.fetchQuery({
      queryKey: ["lifetime-test"],
      queryFn: () => Promise.resolve("value"),
      gcTime: 100,
    });
    expect(client.getQueryCache().findAll()).toHaveLength(1);

    await act(async () => {
      jest.advanceTimersByTime(1_000);
      await Promise.resolve();
    });
    expect(client.getQueryCache().findAll()).toHaveLength(0);
  });

  it("starts each client empty and never shares entries", async () => {
    const first = createTestQueryClient();
    const second = createTestQueryClient();
    await first.fetchQuery({
      queryKey: ["isolation-test"],
      queryFn: () => Promise.resolve("value"),
    });

    expect(first.getQueryCache().findAll()).toHaveLength(1);
    expect(second.getQueryCache().findAll()).toHaveLength(0);
  });
});
