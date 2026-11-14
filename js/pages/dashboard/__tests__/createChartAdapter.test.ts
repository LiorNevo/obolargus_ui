import { createChartAdapter, type ChartApi } from "../createChartAdapter";
import { createTestQueryClient } from "../../../query/client";
import type { IdentifierSearchResponse, LoadReport } from "../../../types/dataLoad";
import type { HistoryLoadWire, RefreshWire } from "../../../types/chart";
import type { SeriesResponseWire } from "../../../types/dashboard";

function searchResponse(): IdentifierSearchResponse {
  return {
    query: "AAPL",
    domain: "market_data",
    outcome: "complete",
    consulted_sources: ["test"],
    sources: [
      {
        source_id: "test",
        display_name: "Test source",
        status: "answered",
        hit_count: 1,
        error_code: null,
        message: null,
        retry_after_seconds: null,
      },
    ],
    total: 1,
    offset: 0,
    limit: 25,
    results: [
      {
        symbol: "AAPL",
        display_name: "Apple Inc.",
        asset_type: "EQUITY",
        exchange: "XNAS",
        venue_mic: "XNAS",
        currency: "USD",
        relevance: 1,
        sources: [{ source_id: "test", display_name: "Test source", relevance: 1 }],
        identifiers: [
          {
            scheme: "TICKER:XNAS",
            value: "AAPL",
            label: "TICKER:XNAS:AAPL",
            primary: true,
            addable: true,
            creatable: true,
            reason: null,
          },
        ],
        conflicts: [],
        known: null,
        addable: true,
        not_addable_reason: null,
        creatable: true,
        creation_blocked_reason: null,
      },
    ],
    message: null,
  };
}

function loadReport(assetId = "22222222-2222-4222-8222-222222222222"): LoadReport {
  return {
    report_version: 1,
    run_id: "run-1",
    data_domain: "market_data",
    as_of_date: "2026-01-01",
    requested_source: null,
    status: "complete",
    identifiers_requested_raw: 1,
    identifiers_duplicated: 0,
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
    assets_adopted: 1,
    per_source_attempted: {},
    per_source_failed: {},
    identifiers: [
      {
        identifier: { scheme: "TICKER:XNAS", value: "AAPL" },
        asset_id: assetId,
        asset_creation: { status: "adopted" },
        attempted: true,
        outcome: "loaded",
        source_id: "test",
        per_source: [],
      },
    ],
    started_at: "2026-01-01T00:00:00Z",
    ended_at: "2026-01-01T00:00:01Z",
    duration_ms: 1000,
  };
}

function historyWire(): HistoryLoadWire {
  return {
    report_version: 1,
    run_id: "run-2",
    asset_id: "22222222-2222-4222-8222-222222222222",
    from: "2026-01-01",
    to: "2026-12-31",
    status: "complete",
    source_id: "test",
    loaded: 252,
    no_op: 0,
    no_data: false,
    source_unavailable: 0,
    rate_limited: 0,
    rejected: 0,
    storage_failure: 0,
    duration_ms: 123,
    message: null,
  };
}

function refreshWire(): RefreshWire {
  return {
    run_id: "run-3",
    assets_attempted: 1,
    assets_refreshed: 1,
    assets_no_op: 0,
    assets_missing_identifier: 0,
    assets_source_unavailable: 0,
  };
}

function seriesPage(date: string): SeriesResponseWire {
  return {
    subject: "asset",
    subject_id: "22222222-2222-4222-8222-222222222222",
    fact_type: "market_price",
    known_at: null,
    points: [
      {
        subject: "asset",
        subject_id: "22222222-2222-4222-8222-222222222222",
        id: "p1",
        fact_type: "market_price",
        schema_version: 1,
        valid_at: `${date}T00:00:00Z`,
        known_at: `${date}T21:00:00Z`,
        value: {
          type: "market_price",
          open: "100",
          high: "101",
          low: "99",
          close: "100",
          adjclose: "100",
          volume: "10",
          currency: "USD",
          adjustment: "unadjusted",
        },
        source: "test",
        retracted: false,
        retraction_reason: null,
      },
    ],
    coverage: { points: 1, first: `${date}T00:00:00Z`, last: `${date}T00:00:00Z` },
    next_cursor: null,
  };
}

describe("chart adapter", () => {
  it("maps external search candidates and known state", async () => {
    const api: ChartApi = {
      searchIdentifiers: () => Promise.resolve(searchResponse()),
      loadOnce: () => Promise.resolve(loadReport()),
      historyLoad: () => Promise.resolve(historyWire()),
      refreshAsset: () => Promise.resolve(refreshWire()),
      loadSeriesPage: () => Promise.resolve(seriesPage("2026-11-13")),
    };
    const adapter = createChartAdapter(createTestQueryClient(), api);
    const result = await adapter.searchInstruments(
      { q: "AAPL" },
      { signal: new AbortController().signal },
    );
    expect(result.total).toBe(1);
    expect(result.candidates[0]).toMatchObject({
      symbol: "AAPL",
      knownAssetId: null,
      creatable: true,
    });
    expect(result.sources[0].status).toBe("answered");
  });

  it("loads one history window and invalidates the series", async () => {
    const client = createTestQueryClient();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const api: ChartApi = {
      searchIdentifiers: () => Promise.resolve(searchResponse()),
      loadOnce: () => Promise.resolve(loadReport()),
      historyLoad: () => Promise.resolve(historyWire()),
      refreshAsset: () => Promise.resolve(refreshWire()),
      loadSeriesPage: () => Promise.resolve(seriesPage("2026-11-13")),
    };
    const adapter = createChartAdapter(client, api);
    const result = await adapter.loadHistory(
      { assetId: "22222222-2222-4222-8222-222222222222", from: "2026-01-01", to: "2026-12-31" },
      { signal: new AbortController().signal },
    );
    expect(result.loaded).toBe(252);
    expect(invalidate).toHaveBeenCalled();
  });

  it("creates a missing instrument and chunks history windows", async () => {
    const client = createTestQueryClient();
    const historyCalls: Array<{ from: string; to: string }> = [];
    const api: ChartApi = {
      searchIdentifiers: () => Promise.resolve(searchResponse()),
      loadOnce: () => Promise.resolve(loadReport()),
      historyLoad: (_body) => {
        historyCalls.push({ from: _body.from, to: _body.to });
        return Promise.resolve(historyWire());
      },
      refreshAsset: () => Promise.resolve(refreshWire()),
      loadSeriesPage: () => Promise.resolve(seriesPage("2026-11-13")),
    };
    const adapter = createChartAdapter(client, api);
    const result = await adapter.createAndLoadInstrument(
      {
        identifier: { scheme: "TICKER:XNAS", value: "AAPL" },
        from: "2024-01-01",
        to: "2026-01-01",
      },
      { signal: new AbortController().signal },
    );
    expect(result.assetId).toBe("22222222-2222-4222-8222-222222222222");
    expect(result.windowsTotal).toBeGreaterThan(1);
    expect(historyCalls.length).toBe(result.windowsTotal);
    expect(historyCalls[0].from).toBe("2024-01-01");
  });

  it("reports updated refresh status and the latest bar date", async () => {
    const api: ChartApi = {
      searchIdentifiers: () => Promise.resolve(searchResponse()),
      loadOnce: () => Promise.resolve(loadReport()),
      historyLoad: () => Promise.resolve(historyWire()),
      refreshAsset: () => Promise.resolve(refreshWire()),
      loadSeriesPage: () => Promise.resolve(seriesPage("2026-11-13")),
    };
    const adapter = createChartAdapter(createTestQueryClient(), api);
    const result = await adapter.refreshLatest(
      "22222222-2222-4222-8222-222222222222",
      { signal: new AbortController().signal },
    );
    expect(result.status).toBe("updated");
    expect(result.latestBarDate).toBe("2026-11-13");
  });
});
