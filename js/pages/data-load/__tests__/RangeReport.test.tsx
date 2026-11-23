import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tableStore } from "lx_client/js/components/Table";
import { RangeReport } from "../RangeReport";
import type {
  DateLoadSummary,
  LoadReport,
  RangeReport as RangeReportType,
} from "../../../types/dataLoad";

function summaryFrom(asOfDate: string, report: LoadReport): DateLoadSummary {
  return {
    date: asOfDate,
    run_id: report.run_id,
    status: report.status,
    identifiers_attempted: report.identifiers_attempted,
    loaded: report.loaded,
    no_op: report.no_op,
    not_resolved: report.not_resolved,
    no_data_for_date: report.no_data_for_date,
    unsupported_scheme: report.unsupported_scheme,
    rejected: report.rejected,
    source_unavailable: report.source_unavailable,
    rate_limited: report.rate_limited,
    storage_failure: report.storage_failure,
    assets_created: report.assets_created,
    assets_adopted: report.assets_adopted,
    per_source_attempted: report.per_source_attempted,
    per_source_failed: report.per_source_failed,
    started_at: report.started_at,
    ended_at: report.ended_at,
    duration_ms: report.duration_ms,
  };
}

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
  dates_completed: 2,
  dates_failed: 1,
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
    summaryFrom("2026-10-01", report("2026-10-01", 1)),
    summaryFrom("2026-10-02", report("2026-10-02", 0)),
  ],
  started_at: "2026-10-01T00:00:00Z",
  ended_at: "2026-10-01T00:00:02Z",
  duration_ms: 2000,
};

describe("RangeReport", () => {
  beforeEach(() => tableStore.getState().resetAll());

  it("lists dates in order and distinguishes no data from failure", () => {
    render(<RangeReport report={RANGE} />);
    expect(screen.getAllByText("2026-10-01").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2026-10-02").length).toBeGreaterThan(0);
    expect(screen.getByText(/no data exists/)).toBeInTheDocument();
    expect(screen.getByText("2 / 1 / 1")).toBeInTheDocument();
  });

  it("filters runs from the table column header", async () => {
    const user = userEvent.setup();
    render(<RangeReport report={RANGE} />);

    expect(
      screen.getByRole("button", { name: /group .*2026-10-01/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filter Status" }));
    await user.click(screen.getByRole("button", { name: "None" }));
    await user.click(screen.getByRole("checkbox", { name: /failed/ }));
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(
      screen.queryByRole("button", { name: /group .*2026-10-01/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /group .*2026-10-02/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filter Status" }));
    await user.click(screen.getByRole("button", { name: "All" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(
      screen.getByRole("button", { name: /group .*2026-10-01/ }),
    ).toBeInTheDocument();
  });

  it("renders the row-group drop zone for the results table", () => {
    render(<RangeReport report={RANGE} />);
    expect(
      screen.getByRole("group", { name: "Row groupings" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Run").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Filter Identifier")).toBeInTheDocument();
  });
});
