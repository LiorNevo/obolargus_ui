import { render, screen } from "@testing-library/react";
import { RangeReport } from "../RangeReport";
import type { LoadReport, RangeReport as RangeReportType } from "../../../types/dataLoad";

function report(asOfDate: string, loaded: number): LoadReport {
  return {
    report_version: 1,
    run_id: `run-${asOfDate}`,
    data_domain: "market_data",
    as_of_date: asOfDate,
    requested_source: null,
    status: loaded > 0 ? "complete" : "failed",
    identifiers_requested_raw: 1,
    identifiers_duplicated: 0,
    identifiers_attempted: 1,
    loaded,
    no_op: 0,
    not_resolved: 0,
    no_data_for_date: loaded > 0 ? 0 : 1,
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

const RANGE: RangeReportType = {
  report_version: 1,
  data_domain: "market_data",
  range_group_id: "group-1",
  from: "2026-10-01",
  to: "2026-10-02",
  concurrency: 2,
  status: "failed",
  dates_requested: 2,
  dates_with_loads: 1,
  dates_with_nothing_stored: 1,
  totals: {
    identifiers_attempted: 2,
    loaded: 1,
    no_op: 0,
    not_resolved: 0,
    no_data_for_date: 1,
    unsupported_scheme: 0,
    rejected: 0,
    source_unavailable: 0,
    rate_limited: 0,
    storage_failure: 0,
    assets_created: 0,
    assets_adopted: 0,
  },
  run_ids: ["run-1", "run-2"],
  dates: [
    { date: "2026-10-01", report: report("2026-10-01", 1) },
    { date: "2026-10-02", report: report("2026-10-02", 0) },
  ],
  started_at: "2026-10-01T00:00:00Z",
  ended_at: "2026-10-01T00:00:02Z",
  duration_ms: 2000,
};

describe("RangeReport", () => {
  it("lists dates in order and distinguishes no data from failure", () => {
    render(<RangeReport report={RANGE} />);
    expect(screen.getByText("2026-10-01")).toBeInTheDocument();
    expect(screen.getByText("2026-10-02")).toBeInTheDocument();
    expect(screen.getByText(/no data exists/)).toBeInTheDocument();
    expect(screen.getByText("2 / 1 / 1")).toBeInTheDocument();
  });
});
