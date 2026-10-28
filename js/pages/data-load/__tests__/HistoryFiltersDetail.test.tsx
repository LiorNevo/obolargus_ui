import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HistoryFilters } from "../HistoryFilters";
import { HistoryDetail } from "../HistoryDetail";
import type { HistoryDetail as Detail, LoadReport } from "../../../types/dataLoad";

const REPORT: LoadReport = {
  report_version: 1,
  run_id: "run-1",
  data_domain: "market_data",
  as_of_date: "2026-10-01",
  requested_source: null,
  status: "complete",
  identifiers_requested_raw: 0,
  identifiers_duplicated: 0,
  identifiers_attempted: 0,
  loaded: 0,
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
  started_at: "2026-10-01T00:00:00Z",
  ended_at: "2026-10-01T00:00:01Z",
  duration_ms: 1000,
};

const ENTRY = {
  entry_id: "entry-1",
  entry_type: "source_change" as const,
  started_at: "2026-10-01T00:00:00Z",
  ended_at: "2026-10-01T00:00:00Z",
  data_domain: null,
  requested_source: null,
  answering_sources: [],
  identifiers_requested_raw: 0,
  identifiers_duplicated: 0,
  identifiers_attempted: 0,
  loaded: 0,
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
  status: "source_disabled",
  stale: false,
  duration_ms: 0,
  date_from: null,
  date_to: null,
  dates_requested: 0,
  dates_completed: 0,
  dates_with_loads: 0,
  range_concurrency: null,
  source_id: "yahoo_finance",
  before_enabled: true,
  after_enabled: false,
  actor: "operator",
};

describe("HistoryFilters", () => {
  it("emits filter changes and clears", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const onClear = jest.fn();
    render(
      <HistoryFilters filters={{ page: 1 }} onChange={onChange} onClear={onClear} />,
    );
    await user.click(screen.getByRole("combobox", { name: "Status" }));
    await user.click(screen.getByRole("option", { name: "Partial" }));
    expect(onChange).toHaveBeenLastCalledWith({ status: "partial" });
    fireEvent.change(screen.getByLabelText("Source"), { target: { value: "yahoo" } });
    expect(onChange).toHaveBeenLastCalledWith({ source: "yahoo" });
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalled();
  });
});

describe("HistoryDetail", () => {
  it("renders a source change", () => {
    const detail: Detail = {
      entry: ENTRY,
      load: null,
      range: null,
      source_change: {
        source_id: "yahoo_finance",
        before_enabled: true,
        after_enabled: false,
        changed_at: "2026-10-01T00:00:00Z",
        actor: "operator",
        reason: "outage",
      },
    };
    render(<HistoryDetail detail={detail} />);
    expect(screen.getByText("yahoo_finance")).toBeInTheDocument();
    expect(screen.getByText("outage")).toBeInTheDocument();
    expect(screen.getByText("operator")).toBeInTheDocument();
  });

  it("renders a single load and a running label", () => {
    const detail: Detail = {
      entry: { ...ENTRY, entry_type: "load_run", status: "running", stale: true },
      load: { report: REPORT },
      range: null,
      source_change: null,
    };
    render(<HistoryDetail detail={detail} />);
    expect(screen.getByText(/Incomplete \/ interrupted/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Load report" })).toBeInTheDocument();
  });

  it("renders a range's per-date sections", () => {
    const detail: Detail = {
      entry: {
        ...ENTRY,
        entry_type: "range_run",
        status: "complete",
        data_domain: "market_data",
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
        totals: REPORT as never,
        dates: [
          { date: "2026-10-01", report: REPORT },
          { date: "2026-10-02", report: REPORT },
        ],
      },
      source_change: null,
    };
    render(<HistoryDetail detail={detail} />);
    expect(screen.getByText(/Range 2026-10-01 to 2026-10-02/)).toBeInTheDocument();
    expect(screen.getByText("2026-10-02")).toBeInTheDocument();
  });
});
