import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { LoadReport } from "../LoadReport";
import type { LoadReport as LoadReportType } from "../../../types/dataLoad";

const REPORT: LoadReportType = {
  report_version: 1,
  run_id: "run-1",
  data_domain: "market_data",
  as_of_date: "2026-10-01",
  requested_source: null,
  status: "partial",
  identifiers_requested_raw: 2,
  identifiers_duplicated: 0,
  identifiers_attempted: 2,
  loaded: 1,
  no_op: 0,
  not_resolved: 0,
  no_data_for_date: 0,
  unsupported_scheme: 0,
  rejected: 1,
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
      asset_id: null,
      asset_creation: { status: "not_requested" },
      attempted: true,
      outcome: "loaded",
      source_id: "yahoo_finance",
      per_source: [],
      stored: {
        value: { close: "100" },
        as_of_date: "2026-10-01",
        known_at: "2026-10-02T00:00:00Z",
        source_id: "yahoo_finance",
      },
    },
    {
      identifier: { scheme: "TICKER:XNAS", value: "BAD" },
      asset_id: null,
      asset_creation: { status: "not_requested" },
      attempted: true,
      outcome: "rejected",
      source_id: null,
      per_source: [],
      stored: null,
    },
  ],
  started_at: "2026-10-02T00:00:00Z",
  ended_at: "2026-10-02T00:00:01Z",
  duration_ms: 1000,
};

describe("LoadReport accessibility", () => {
  it("has no serious axe violations", async () => {
    const { container } = render(<LoadReport report={REPORT} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
