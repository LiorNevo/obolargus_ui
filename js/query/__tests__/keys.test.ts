import {
  normalizeHistoryFilters,
  normalizeSearchQuery,
  queryKeys,
} from "../keys";

describe("query keys", () => {
  it("normalizes history filters and excludes page/selected", () => {
    expect(
      normalizeHistoryFilters({
        from: "2026-01-01",
        page: 2,
        selected: "entry-1",
      }),
    ).toEqual({
      from: "2026-01-01",
      to: null,
      domain: null,
      source: null,
      status: null,
      entry_type: null,
    });
  });

  it("normalizes only insignificant search whitespace", () => {
    expect(normalizeSearchQuery("  Apple   Inc  ")).toBe("Apple Inc");
    expect(normalizeSearchQuery("apple")).toBe("apple");
  });

  it("uses stable identities for equivalent inputs", () => {
    expect(queryKeys.assets.search("Apple", 20)).toEqual(
      queryKeys.assets.search("Apple", 20),
    );
    expect(queryKeys.dataLoad.sources("market_data")).toEqual(
      queryKeys.dataLoad.sources("market_data"),
    );
  });

  it("separates domains, pages, filters, and series", () => {
    expect(queryKeys.dataLoad.sources("market_data")).not.toEqual(
      queryKeys.dataLoad.sources("holdings"),
    );
    expect(
      queryKeys.dataLoad.historyList(
        normalizeHistoryFilters({}),
        50,
        0,
      ),
    ).not.toEqual(
      queryKeys.dataLoad.historyList(
        normalizeHistoryFilters({}),
        50,
        50,
      ),
    );
    expect(queryKeys.marketSeries.detail("a", "2026-01-01", "2026-01-02")).not.toEqual(
      queryKeys.marketSeries.detail("a", "2026-01-01", "2026-01-03"),
    );
  });

  it("provides prefix families for invalidation", () => {
    expect(queryKeys.dataLoad.allHistory()).toEqual([
      "data-load",
      "history",
    ]);
    expect(queryKeys.dataLoad.allSources()).toEqual([
      "data-load",
      "sources",
    ]);
    expect(queryKeys.marketSeries.forAsset("a")).toEqual([
      "market-series",
      "a",
    ]);
    expect(queryKeys.assets.allSearches()).toEqual(["assets", "search"]);
  });
});
