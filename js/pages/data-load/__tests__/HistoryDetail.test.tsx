import { render, screen } from "@testing-library/react";
import { tableStore } from "lx_client/js/components/Table";
import { HistoryDetail } from "../HistoryDetail";
import type {
  HistoryDetail as HistoryDetailType,
  LoadReport,
} from "../../../types/dataLoad";

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
    identifiers: [
      {
        identifier: { scheme: "TICKER:XNAS", value: "AAPL" },
        asset_id: "asset-1",
        asset_creation: { status: "not_requested" },
        attempted: true,
        outcome: "loaded",
        source_id: "yahoo_finance",
        per_source: [{ source_id: "yahoo_finance", ok: true, error: null }],
        stored: {
          value: { close: "100" },
          as_of_date: asOfDate,
          known_at: `${asOfDate}T00:00:01Z`,
          source_id: "yahoo_finance",
        },
      },
    ],
    started_at: `${asOfDate}T00:00:00Z`,
    ended_at: `${asOfDate}T00:00:01Z`,
    duration_ms: 1000,
  };
}

const ENTRY = {
  entry_id: "group-1",
  entry_type: "range_run" as const,
  started_at: "2026-10-01T00:00:00Z",
  ended_at: "2026-10-02T00:00:01Z",
  data_domain: "market_data",
  requested_source: null,
  answering_sources: ["yahoo_finance"],
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
};

const RANGE_DETAIL: HistoryDetailType = {
  entry: ENTRY,
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

describe("HistoryDetail", () => {
  beforeEach(() => tableStore.getState().resetAll());

  it("renders a range detail as one grouped table", () => {
    const { container } = render(<HistoryDetail detail={RANGE_DETAIL} />);
    expect(container.querySelectorAll("table.lx-table")).toHaveLength(1);
    expect(screen.getByText("2026-10-01 to 2026-10-02")).toBeInTheDocument();
    expect(screen.getAllByText(/2026-10-01/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: "2026-10-01" })).not.toBeInTheDocument();
  });

  it("renders a single load through the report table", () => {
    const { container } = render(
      <HistoryDetail
        detail={{
          entry: { ...ENTRY, entry_id: "run-1", entry_type: "load_run" },
          load: { report: report("2026-10-01") },
          range: null,
          source_change: null,
        }}
      />,
    );
    expect(container.querySelectorAll("table.lx-table")).toHaveLength(1);
  });

  it("renders a source change as metadata", () => {
    render(
      <HistoryDetail
        detail={{
          entry: {
            ...ENTRY,
            entry_id: "change-1",
            entry_type: "source_change",
            status: "source_disabled",
            source_id: "yahoo_finance",
            before_enabled: true,
            after_enabled: false,
          },
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
        }}
      />,
    );
    expect(screen.getByText("outage")).toBeInTheDocument();
    expect(screen.getByText("operator")).toBeInTheDocument();
  });
});
