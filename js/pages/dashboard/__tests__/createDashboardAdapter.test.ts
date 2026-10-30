import { createDashboardAdapter } from "../createDashboardAdapter";
import type { SeriesResponseWire } from "../../../types/dashboard";

function point(date: string, value: string, source = "test") {
  return {
    subject: "asset",
    subject_id: "asset-1",
    id: `${date}-id`,
    fact_type: "market_price",
    valid_at: `${date}T00:00:00Z`,
    known_at: `${date}T21:00:00Z`,
    value,
    source,
    retracted: false,
  };
}

const value = JSON.stringify({
  open: "100.00",
  high: "103.00",
  low: "99.00",
  close: "102.00",
  adjclose: "102.00",
  volume: "1000",
});

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
  it("converts the inclusive UI range to an exclusive server bound and pages", async () => {
    const calls: unknown[] = [];
    const adapter = createDashboardAdapter({
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
    const adapter = createDashboardAdapter({
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

  it("keeps a numeric volume as a decimal string", async () => {
    const numericValue = JSON.stringify({
      open: "19.80",
      high: "19.80",
      low: "19.80",
      close: "19.80",
      adjclose: "19.80",
      volume: 0,
    });
    const adapter = createDashboardAdapter({
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
    const adapter = createDashboardAdapter({
      searchAssets: () => Promise.resolve({ items: [] }),
      loadSeriesPage: () =>
        Promise.resolve(page([point("2026-01-02", "not-json")], null)),
    });
    const series = await adapter.loadDailyBars(
      "asset-1",
      { from: "2026-01-02", to: "2026-01-02" },
      { signal: new AbortController().signal },
    );
    expect(series.points[0].open).toBe("");
  });
});
