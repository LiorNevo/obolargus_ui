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

describe("automation query keys", () => {
  it("builds stable flows, versions, runs, and trigger identities", () => {
    const filters = { status: "active", search: "sales", limit: 50, offset: 0 };
    expect(queryKeys.automation.nodeTypes()).toEqual([
      "automation",
      "node-types",
    ]);
    expect(queryKeys.automation.templates()).toEqual([
      "automation",
      "templates",
    ]);
    expect(queryKeys.automation.template("tpl")).toEqual([
      "automation",
      "templates",
      "tpl",
    ]);
    expect(queryKeys.automation.flowList(filters)).toEqual([
      "automation",
      "flows",
      "list",
      filters,
    ]);
    expect(queryKeys.automation.allFlowLists()).toEqual([
      "automation",
      "flows",
      "list",
    ]);
    expect(queryKeys.automation.flow("f1")).toEqual([
      "automation",
      "flows",
      "detail",
      "f1",
    ]);
    expect(queryKeys.automation.allFlows()).toEqual(["automation", "flows"]);
    expect(queryKeys.automation.versions("f1")).toEqual([
      "automation",
      "flows",
      "f1",
      "versions",
    ]);
    expect(queryKeys.automation.version("f1", 2)).toEqual([
      "automation",
      "flows",
      "f1",
      "versions",
      2,
    ]);
    expect(queryKeys.automation.audit("f1")).toEqual([
      "automation",
      "flows",
      "f1",
      "audit",
    ]);
    expect(queryKeys.automation.context("f1")).toEqual([
      "automation",
      "flows",
      "f1",
      "context",
    ]);
    expect(queryKeys.automation.triggers("f1")).toEqual([
      "automation",
      "flows",
      "f1",
      "triggers",
    ]);

    const runFilters = {
      flow_id: "f1",
      status: "failed",
      trigger_kind: "api",
      limit: 10,
      offset: 20,
    };
    expect(queryKeys.automation.runList(runFilters)).toEqual([
      "automation",
      "runs",
      "list",
      runFilters,
    ]);
    expect(queryKeys.automation.allRunLists()).toEqual([
      "automation",
      "runs",
      "list",
    ]);
    expect(queryKeys.automation.run("r1")).toEqual([
      "automation",
      "runs",
      "detail",
      "r1",
    ]);
    expect(queryKeys.automation.runMessages("r1", "n1")).toEqual([
      "automation",
      "runs",
      "r1",
      "messages",
      "n1",
    ]);
    expect(queryKeys.automation.runMessages("r1")).toEqual([
      "automation",
      "runs",
      "r1",
      "messages",
      null,
    ]);
    expect(queryKeys.automation.runLogs("r1")).toEqual([
      "automation",
      "runs",
      "r1",
      "logs",
    ]);
    expect(queryKeys.automation.runNode("r1", "n1")).toEqual([
      "automation",
      "runs",
      "r1",
      "nodes",
      "n1",
    ]);
  });
});
