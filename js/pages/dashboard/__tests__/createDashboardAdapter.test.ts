import { createDashboardAdapter } from "../createDashboardAdapter";
import { createTestQueryClient } from "../../../query/client";
import { DashboardApiError } from "../../../api/dashboard";
import { toDataError } from "../toDataError";
import type { FactValueWire, SeriesResponseWire } from "../../../types/dashboard";

function point(date: string, value: FactValueWire | null, source = "test") {
  return {
    subject: "asset",
    subject_id: "asset-1",
    id: `${date}-id`,
    fact_type: "market_price",
    schema_version: 1,
    valid_at: `${date}T00:00:00Z`,
    known_at: `${date}T21:00:00Z`,
    value,
    source,
    retracted: false,
    retraction_reason: null,
  };
}

const value: FactValueWire = {
  type: "market_price",
  open: "100.00",
  high: "103.00",
  low: "99.00",
  close: "102.00",
  adjclose: "102.00",
  volume: "1000",
  currency: "USD",
  adjustment: "unadjusted",
};

function page(
  points: SeriesResponseWire["points"],
  next: string | null,
): SeriesResponseWire {
  return {
    subject: "asset",
    subject_id: "asset-1",
    fact_type: "market_price",
    known_at: null,
    points,
    coverage: { points: points.length, first: null, last: null },
    next_cursor: next,
  };
}

describe("dashboard data adapter", () => {
  it("turns an unknown subject into a friendly, non-retryable error", () => {
    const error = toDataError(
      new DashboardApiError(
        404,
        "unknown_subject",
        "unknown subject: asset 2373bf80-3288-4df1-ada6-eb62e725c16d",
        false,
      ),
    );
    expect(error.code).toBe("unknown_subject");
    expect(error.retryable).toBe(false);
    expect(error.message).toContain("no longer exists");
  });

  it("converts the inclusive UI range to an exclusive server bound and pages", async () => {
    const calls: unknown[] = [];
    const adapter = createDashboardAdapter(createTestQueryClient(), {
      searchAssets: () => Promise.resolve({ items: [] }),
      loadSeriesPage: (_assetId, params) => {
        calls.push(params);
        return Promise.resolve(
          params.cursor
            ? page([point("2026-01-03", value)], null)
            : page([point("2026-01-02", value)], "2026-01-02T00:00:00Z"),
        );
      },
    });
    const series = await adapter.loadDailyBars(
      "asset-1",
      { from: "2026-01-02", to: "2026-01-03" },
      { signal: new AbortController().signal },
    );
    expect(calls[0]).toMatchObject({
      from: "2026-01-02T00:00:00Z",
      to: "2026-01-04T00:00:00.000Z",
    });
    expect(series.points).toHaveLength(2);
    expect(series.pages).toBe(2);
    expect(series.points[0].open).toBe("100.00");
  });

  it("keeps the first of duplicate dates", async () => {
    const adapter = createDashboardAdapter(createTestQueryClient(), {
      searchAssets: () => Promise.resolve({ items: [] }),
      loadSeriesPage: () =>
        Promise.resolve(
          page(
            [
              point("2026-01-02", value),
              point("2026-01-02", value, "duplicate"),
            ],
            null,
          ),
        ),
    });
    const series = await adapter.loadDailyBars(
      "asset-1",
      { from: "2026-01-02", to: "2026-01-02" },
      { signal: new AbortController().signal },
    );
    expect(series.points).toHaveLength(1);
    expect(series.points[0].source).toBe("test");
  });

  it("keeps a zero volume as a decimal string", async () => {
    const numericValue: FactValueWire = {
      type: "market_price",
      open: "19.80",
      high: "19.80",
      low: "19.80",
      close: "19.80",
      adjclose: "19.80",
      volume: "0",
      currency: "USD",
      adjustment: "unadjusted",
    };
    const adapter = createDashboardAdapter(createTestQueryClient(), {
      searchAssets: () => Promise.resolve({ items: [] }),
      loadSeriesPage: () =>
        Promise.resolve(page([point("2026-10-01", numericValue)], null)),
    });
    const series = await adapter.loadDailyBars(
      "asset-1",
      { from: "2026-10-01", to: "2026-10-01" },
      { signal: new AbortController().signal },
    );
    expect(series.points[0].volume).toBe("0");
  });

  it("maps malformed values into excluded bars rather than throwing", async () => {
    const adapter = createDashboardAdapter(createTestQueryClient(), {
      searchAssets: () => Promise.resolve({ items: [] }),
      loadSeriesPage: () =>
        Promise.resolve(page([point("2026-01-02", null)], null)),
    });
    const series = await adapter.loadDailyBars(
      "asset-1",
      { from: "2026-01-02", to: "2026-01-02" },
      { signal: new AbortController().signal },
    );
    expect(series.points[0].open).toBe("");
  });

  it("deduplicates concurrent reads and reuses the fresh cache", async () => {
    const client = createTestQueryClient();
    let calls = 0;
    let resolveRead!: (value: SeriesResponseWire) => void;
    const pending = new Promise<SeriesResponseWire>((resolve) => {
      resolveRead = resolve;
    });
    const adapter = createDashboardAdapter(client, {
      searchAssets: () => Promise.resolve({ items: [] }),
      loadSeriesPage: () => {
        calls += 1;
        return calls === 1
          ? pending
          : Promise.resolve(page([point("2026-01-02", value)], null));
      },
    });

    const options = { signal: new AbortController().signal };
    const first = adapter.loadDailyBars(
      "asset-1",
      { from: "2026-01-02", to: "2026-01-03" },
      options,
    );
    const second = adapter.loadDailyBars(
      "asset-1",
      { from: "2026-01-02", to: "2026-01-03" },
      options,
    );
    resolveRead(page([point("2026-01-02", value)], null));

    const [a, b] = await Promise.all([first, second]);
    expect(calls).toBe(1);
    expect(a).toEqual(b);

    const cached = await adapter.loadDailyBars(
      "asset-1",
      { from: "2026-01-02", to: "2026-01-03" },
      options,
    );
    expect(calls).toBe(1);
    expect(cached.points).toHaveLength(1);
  });

  it("maps and caches asset search results", async () => {
    const client = createTestQueryClient();
    const searchAssets = jest.fn().mockResolvedValue({
      items: [
        {
          id: "asset-1",
          display_name: "Apple Inc.",
          asset_type: "equity",
          currency: "USD",
          primary_identifier: "TICKER:XNAS:AAPL",
        },
      ],
    });
    const adapter = createDashboardAdapter(client, {
      searchAssets,
      loadSeriesPage: () => Promise.resolve(page([], null)),
    });
    const options = { signal: new AbortController().signal, limit: 10 };

    await expect(adapter.searchAssets(" Apple ", options)).resolves.toEqual([
      {
        id: "asset-1",
        displayName: "Apple Inc.",
        assetType: "equity",
        currency: "USD",
        primaryIdentifier: "TICKER:XNAS:AAPL",
      },
    ]);
    await expect(adapter.searchAssets(" Apple ", options)).resolves.toHaveLength(1);
    expect(searchAssets).toHaveBeenCalledTimes(1);
    expect(searchAssets).toHaveBeenCalledWith(
      "Apple",
      expect.objectContaining({ ...options, onMeta: expect.any(Function) }),
    );
  });

  it("maps transport failures to DashboardDataError", async () => {
    const adapter = createDashboardAdapter(createTestQueryClient(), {
      searchAssets: () =>
        Promise.reject(
          new DashboardApiError(503, "unavailable", "try later", true),
        ),
      loadSeriesPage: () => Promise.resolve(page([], null)),
    });

    await expect(
      adapter.searchAssets("Apple", {
        signal: new AbortController().signal,
        limit: 10,
      }),
    ).rejects.toMatchObject({
      name: "DashboardDataError",
      message: "try later",
      code: "unavailable",
      retryable: true,
      status: 503,
    });
  });
});
