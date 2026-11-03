import type { HistoryEntry } from "../../../types/dataLoad";
import { historyRows } from "../historyRows";

function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    entry_id: "entry-1",
    entry_type: "load_run",
    started_at: "2026-10-01T00:00:00Z",
    ended_at: "2026-10-01T00:00:01Z",
    data_domain: "market_data",
    requested_source: null,
    answering_sources: ["yahoo_finance"],
    identifiers_requested_raw: 3,
    identifiers_duplicated: 1,
    identifiers_attempted: 2,
    loaded: 1,
    no_op: 0,
    not_resolved: 1,
    no_data_for_date: 0,
    unsupported_scheme: 0,
    rejected: 1,
    source_unavailable: 0,
    rate_limited: 0,
    storage_failure: 0,
    assets_created: 0,
    assets_adopted: 0,
    status: "partial",
    stale: false,
    duration_ms: 1000,
    date_from: "2026-10-01",
    date_to: "2026-10-01",
    dates_requested: 1,
    dates_completed: 1,
    dates_with_loads: 1,
    range_concurrency: null,
    source_id: null,
    before_enabled: null,
    after_enabled: null,
    actor: null,
    ...overrides,
  };
}

describe("historyRows", () => {
  it("flattens a load run with unique, failure, and date counts", () => {
    const [row] = historyRows([entry()]);
    expect(row.entryId).toBe("entry-1");
    expect(row.type).toBe("Load run");
    expect(row.unique).toBe(2);
    expect(row.failures).toBe(1);
    expect(row.duration).toBe("1000 ms");
    expect(row.dates).toBe("1/1");
    expect(row.source).toBe("yahoo_finance");
    expect(row.status).toBe("partial");
  });

  it("labels ranges, source changes, and running entries", () => {
    const rows = historyRows([
      entry({
        entry_id: "range-1",
        entry_type: "range_run",
        date_from: "2026-10-01",
        date_to: "2026-10-03",
        dates_requested: 3,
        dates_completed: 2,
      }),
      entry({
        entry_id: "change-1",
        entry_type: "source_change",
        status: "source_disabled",
        source_id: "yahoo_finance",
        duration_ms: null,
      }),
      entry({
        entry_id: "running-1",
        status: "running",
        stale: true,
        ended_at: null,
        duration_ms: null,
      }),
    ]);

    expect(rows[0].type).toBe("Range run");
    expect(rows[0].dateRange).toBe("2026-10-01 → 2026-10-03");
    expect(rows[0].dates).toBe("2/3");
    expect(rows[1].type).toBe("Configuration change");
    expect(rows[1].status).toBe("Source disabled");
    expect(rows[1].duration).toBe("—");
    expect(rows[2].status).toBe("Incomplete / interrupted");
    expect(rows[2].ended).toBe("—");
  });

  it("falls back to Auto when no source is recorded", () => {
    const [row] = historyRows([
      entry({ answering_sources: [], requested_source: null }),
    ]);
    expect(row.source).toBe("Auto");
    const [domainless] = historyRows([entry({ data_domain: null })]);
    expect(domainless.domain).toBe("—");
  });
});
