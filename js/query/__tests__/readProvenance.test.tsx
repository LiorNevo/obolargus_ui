import { useOfflineStore } from "../../offline/offlineStore";
import { hashQueryKey } from "../../offline/responseProvenance";
import { withReadProvenance } from "../provenance";

describe("withReadProvenance", () => {
  beforeEach(() => {
    useOfflineStore.getState().reset();
  });

  it("records cache provenance by the existing query identity", async () => {
    const queryKey = ["data-load", "domains"];
    const wrapped = withReadProvenance(queryKey, async (_context, onMeta) => {
      onMeta({ source: "cache", cachedAt: 1_000, fetchedAt: 2_000 });
      return { domains: ["market_data"] };
    });

    await expect(
      wrapped({ signal: new AbortController().signal }),
    ).resolves.toEqual({ domains: ["market_data"] });

    const record =
      useOfflineStore.getState().provenance[hashQueryKey(queryKey)];
    expect(record).toMatchObject({
      source: "cache",
      cachedAt: 1_000,
      fetchedAt: 2_000,
    });
    expect(useOfflineStore.getState().status.state).toBe("offline");
  });

  it("labels a network response without marking offline", async () => {
    const queryKey = ["market-series", "a"];
    const wrapped = withReadProvenance(queryKey, async (_context, onMeta) => {
      onMeta({ source: "network", cachedAt: null, fetchedAt: 3_000 });
      return 42;
    });

    await expect(
      wrapped({ signal: new AbortController().signal }),
    ).resolves.toBe(42);

    const record =
      useOfflineStore.getState().provenance[hashQueryKey(queryKey)];
    expect(record?.source).toBe("network");
    expect(record?.offline).toBe(false);
  });
});
