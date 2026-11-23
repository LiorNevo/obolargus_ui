import { createTestQueryClient } from "../client";
import {
  invalidateAfterHistoryLoad,
  invalidateAfterLoad,
  invalidateAfterProgressTerminal,
  invalidateAfterSourceToggle,
} from "../invalidation";
import { normalizeHistoryFilters, queryKeys } from "../keys";
import type { LoadReport, RangeReport } from "../../types/dataLoad";

function report(overrides: Partial<LoadReport> = {}): LoadReport {
  return {
    identifiers: [{ asset_id: "asset-1" }],
    assets_created: 0,
    assets_adopted: 0,
    loaded: 1,
    status: "complete",
    ...overrides,
  } as unknown as LoadReport;
}

function rangeReport(overrides: Partial<RangeReport> = {}): RangeReport {
  return {
    dates: [],
    status: "complete",
    dates_requested: 1,
    dates_completed: 1,
    dates_failed: 0,
    dates_with_loads: 1,
    dates_with_nothing_stored: 0,
    totals: {
      identifiers_attempted: 1,
      loaded: 1,
      no_op: 0,
      not_resolved: 0,
      no_data_for_date: 0,
      unsupported_scheme: 0,
      rejected: 0,
      source_unavailable: 0,
      rate_limited: 0,
      storage_failure: 0,
      assets_created: 0,
      assets_adopted: 0,
    },
    ...overrides,
  } as unknown as RangeReport;
}

function seed(client: ReturnType<typeof createTestQueryClient>) {
  const pageKey = queryKeys.dataLoad.historyList(
    normalizeHistoryFilters({}),
    50,
    0,
  );
  client.setQueryData(queryKeys.dataLoad.sources("market_data"), {});
  client.setQueryData(queryKeys.dataLoad.sources("holdings"), {});
  client.setQueryData(pageKey, {});
  client.setQueryData(queryKeys.dataLoad.historyDetail("entry-1"), {});
  client.setQueryData(
    queryKeys.marketSeries.detail("asset-1", "2026-10-01", "2026-10-02"),
    {},
  );
  client.setQueryData(
    queryKeys.marketSeries.detail("asset-2", "2026-10-01", "2026-10-02"),
    {},
  );
  client.setQueryData(queryKeys.assets.search("Apple", 20), {});
  client.setQueryData(
    queryKeys.dataLoad.identifierSearch({
      q: "apple",
      domain: "market_data",
    }),
    {},
  );
  client.setQueryData(queryKeys.dataLoad.progress("group-1"), {});
  return pageKey;
}

function identifierSearchKey() {
  return queryKeys.dataLoad.identifierSearch({
    q: "apple",
    domain: "market_data",
  });
}

describe("cache invalidation", () => {
  it("invalidates only the affected source catalog and history", async () => {
    const client = createTestQueryClient();
    const pageKey = seed(client);

    await invalidateAfterSourceToggle(client, "market_data");

    expect(
      client.getQueryState(queryKeys.dataLoad.sources("market_data"))
        ?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(queryKeys.dataLoad.sources("holdings"))
        ?.isInvalidated,
    ).toBe(false);
    expect(client.getQueryState(pageKey)?.isInvalidated).toBe(true);
    expect(
      client.getQueryState(identifierSearchKey())?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(
        queryKeys.marketSeries.detail("asset-2", "2026-10-01", "2026-10-02"),
      )?.isInvalidated,
    ).toBe(false);
  });

  it("invalidates history, affected series, asset search, and identifier search after a load", async () => {
    const client = createTestQueryClient();
    const pageKey = seed(client);

    await invalidateAfterLoad(client, {
      report: report({ assets_created: 1 }),
    });

    expect(client.getQueryState(pageKey)?.isInvalidated).toBe(true);
    expect(
      client.getQueryState(
        queryKeys.marketSeries.detail("asset-1", "2026-10-01", "2026-10-02"),
      )?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(
        queryKeys.marketSeries.detail("asset-2", "2026-10-01", "2026-10-02"),
      )?.isInvalidated,
    ).toBe(false);
    expect(
      client.getQueryState(queryKeys.assets.search("Apple", 20))
        ?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(identifierSearchKey())?.isInvalidated,
    ).toBe(true);
  });

  it("does not invalidate asset or identifier search when no asset was created", async () => {
    const client = createTestQueryClient();
    seed(client);

    await invalidateAfterLoad(client, { report: report() });

    expect(
      client.getQueryState(queryKeys.assets.search("Apple", 20))
        ?.isInvalidated,
    ).toBe(false);
    expect(
      client.getQueryState(identifierSearchKey())?.isInvalidated,
    ).toBe(false);
  });

  it("invalidates progress for a range load, including partial status", async () => {
    const client = createTestQueryClient();
    seed(client);

    await invalidateAfterLoad(client, {
      report: rangeReport({ status: "partial" }),
      groupId: "group-1",
    });

    expect(
      client.getQueryState(queryKeys.dataLoad.progress("group-1"))
        ?.isInvalidated,
    ).toBe(true);
  });

  it("falls back to the whole series family when stored data has no asset id", async () => {
    const client = createTestQueryClient();
    seed(client);

    await invalidateAfterLoad(client, {
      report: report({ identifiers: [], loaded: 1 }),
    });

    expect(
      client.getQueryState(
        queryKeys.marketSeries.detail("asset-1", "2026-10-01", "2026-10-02"),
      )?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(
        queryKeys.marketSeries.detail("asset-2", "2026-10-01", "2026-10-02"),
      )?.isInvalidated,
    ).toBe(true);
  });

  it("invalidates history and progress after a restored terminal run", async () => {
    const client = createTestQueryClient();
    seed(client);

    await invalidateAfterProgressTerminal(client, "group-1");

    expect(
      client.getQueryState(
        queryKeys.dataLoad.historyList(normalizeHistoryFilters({}), 50, 0),
      )?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(queryKeys.dataLoad.historyDetail("entry-1"))
        ?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(queryKeys.dataLoad.progress("group-1"))
        ?.isInvalidated,
    ).toBe(true);
  });
});


describe("invalidateAfterHistoryLoad", () => {
  it("invalidates only the affected series unless an asset was created", async () => {
    const client = createTestQueryClient();
    seed(client);

    await invalidateAfterHistoryLoad(client, "asset-1");

    expect(
      client.getQueryState(
        queryKeys.marketSeries.detail("asset-1", "2026-10-01", "2026-10-02"),
      )?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(
        queryKeys.marketSeries.detail("asset-2", "2026-10-01", "2026-10-02"),
      )?.isInvalidated,
    ).toBe(false);
    expect(
      client.getQueryState(queryKeys.assets.search("Apple", 20))?.isInvalidated,
    ).toBe(false);

    await invalidateAfterHistoryLoad(client, "asset-2", { createdAssets: true });
    expect(
      client.getQueryState(queryKeys.assets.search("Apple", 20))?.isInvalidated,
    ).toBe(true);
  });
});
