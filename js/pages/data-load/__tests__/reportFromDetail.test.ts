import type { HistoryDetail, LoadReport } from "../../../types/dataLoad";
import { rangeReportFromDetail } from "../reportFromDetail";

function report(asOfDate: string): LoadReport {
  return {
    report_version: 1,
    run_id: `run-${asOfDate}`,
    data_domain: "market_data",
    as_of_date: asOfDate,
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
    assets_adopted: 0,
    per_source_attempted: {},
    per_source_failed: {},
    identifiers: [],
    started_at: `${asOfDate}T00:00:00Z`,
    ended_at: `${asOfDate}T00:00:01Z`,
    duration_ms: 1000,
  };
}

const DETAIL: HistoryDetail = {
  entry: {
    entry_id: "group-1",
    entry_type: "range_run",
    started_at: "2026-10-01T00:00:00Z",
    ended_at: "2026-10-02T00:00:01Z",
    data_domain: "market_data",
    requested_source: null,
    answering_sources: [],
    identifiers_requested_raw: 2,
    identifiers_duplicated: 0,
    identifiers_attempted: 2,
    loaded: 2,
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
    status: "complete",
    stale: false,
    duration_ms: 2000,
    date_from: "2026-10-01",
    date_to: "2026-10-02",
    dates_requested: 2,
    dates_completed: 2,
    dates_with_loads: 2,
    range_concurrency: 2,
    source_id: null,
    before_enabled: null,
    after_enabled: null,
    actor: null,
  },
  load: null,
  range: {
    from: "2026-10-01",
    to: "2026-10-02",
    concurrency: 2,
    status: "complete",
    dates_requested: 2,
    dates_completed: 2,
    dates_with_loads: 2,
    dates_with_nothing_stored: 0,
    totals: {
      identifiers_attempted: 2,
      loaded: 2,
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
    dates: [
      { date: "2026-10-01", report: report("2026-10-01") },
      { date: "2026-10-02", report: report("2026-10-02") },
    ],
  },
  source_change: null,
};

describe("rangeReportFromDetail", () => {
  it("reconstructs a range report from a history detail", () => {
    const result = rangeReportFromDetail(DETAIL, "group-1");
    expect(result).not.toBeNull();
    expect(result?.range_group_id).toBe("group-1");
    expect(result?.data_domain).toBe("market_data");
    expect(result?.run_ids).toEqual(["run-2026-10-01", "run-2026-10-02"]);
    expect(result?.dates).toHaveLength(2);
    expect(result?.ended_at).toBe("2026-10-02T00:00:01Z");
  });

  it("returns null for a non-range detail", () => {
    expect(
      rangeReportFromDetail({ ...DETAIL, range: null }, "group-1"),
    ).toBeNull();
  });
});
