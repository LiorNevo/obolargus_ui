import { render, screen } from "@testing-library/react";
import type { IdentifierOutcome, LoadReport as LoadReportType } from "../../../types/dataLoad";
import { LoadReport, outcomeLabel } from "../LoadReport";

function line(overrides: Partial<IdentifierOutcome>): IdentifierOutcome {
  return {
    identifier: { scheme: "TICKER:XNAS", value: "AAPL" },
    asset_id: "asset-1",
    asset_creation: { status: "not_requested" },
    attempted: true,
    outcome: "loaded",
    source_id: "yahoo_finance",
    per_source: [{ source_id: "yahoo_finance", ok: true, error: null }],
    stored: null,
    ...overrides,
  };
}

function report(overrides: Partial<LoadReportType> = {}): LoadReportType {
  return {
    report_version: 1,
    run_id: "run-1",
    data_domain: "market_data",
    as_of_date: "2026-10-01",
    requested_source: null,
    status: "complete",
    identifiers_requested_raw: 2,
    identifiers_duplicated: 0,
    identifiers_attempted: 1,
    loaded: 1,
    no_op: 0,
    not_resolved: 1,
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
      line({
        stored: {
          value: { close: "100" },
          as_of_date: "2026-10-01",
          known_at: "2026-10-02T00:00:00Z",
          source_id: "yahoo_finance",
        },
      }),
      line({
        identifier: { scheme: "TICKER:XNAS", value: "MISSING" },
        outcome: "not_resolved",
        asset_id: null,
        source_id: null,
        per_source: [],
      }),
    ],
    started_at: "2026-10-02T00:00:00Z",
    ended_at: "2026-10-02T00:00:01Z",
    duration_ms: 1000,
    ...overrides,
  };
}

describe("LoadReport", () => {
  it("shows stored provenance and does not raise a failure banner for absence", () => {
    render(<LoadReport report={report()} />);
    expect(screen.getByText(/As of 2026-10-01/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("raises a failure banner for a rejected line", () => {
    const rejected = report({
      status: "partial",
      rejected: 1,
      identifiers: [line({ outcome: "rejected" })],
    });
    render(<LoadReport report={rejected} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/Partial/);
    expect(screen.getByRole("alert")).toHaveTextContent(/Rejected by the source/);
  });

  it("renders unknown outcomes with the raw code", () => {
    expect(outcomeLabel("future_outcome")).toBe(
      "Unknown outcome (future_outcome)",
    );
    render(<LoadReport report={report({ identifiers: [line({ outcome: "future_outcome" })] })} />);
    expect(
      screen.getAllByText("Unknown outcome (future_outcome)").length,
    ).toBeGreaterThan(0);
  });
});
