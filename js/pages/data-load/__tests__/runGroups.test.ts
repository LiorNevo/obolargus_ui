import type { LoadReport, RangeReport } from "../../../types/dataLoad";
import {
  groupLoadReport,
  groupRangeReport,
  runFailureCount,
  runStatusLabel,
  uniqueRequested,
} from "../runGroups";

function report(overrides: Partial<LoadReport> = {}): LoadReport {
  return {
    report_version: 1,
    run_id: "run-1",
    data_domain: "market_data",
    as_of_date: "2026-10-01",
    requested_source: null,
    status: "complete",
    identifiers_requested_raw: 2,
    identifiers_duplicated: 0,
    identifiers_attempted: 2,
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
      {
        identifier: { scheme: "TICKER:XNAS", value: "AAPL" },
        asset_id: "asset-1",
        asset_creation: { status: "not_requested" },
        attempted: true,
        outcome: "loaded",
        source_id: "yahoo_finance",
        per_source: [],
        stored: null,
      },
      {
        identifier: { scheme: "TICKER:XNAS", value: "MISSING" },
        asset_id: null,
        asset_creation: { status: "not_requested" },
        attempted: true,
        outcome: "not_resolved",
        source_id: null,
        per_source: [],
        stored: null,
      },
    ],
    started_at: "2026-10-01T00:00:00Z",
    ended_at: "2026-10-01T00:00:01Z",
    duration_ms: 1000,
    ...overrides,
  };
}

function rangeReport(): RangeReport {
  return {
    report_version: 1,
    data_domain: "market_data",
    range_group_id: "group-1",
    from: "2026-10-01",
    to: "2026-10-02",
    concurrency: 2,
    status: "partial",
    dates_requested: 2,
    dates_with_loads: 1,
    dates_with_nothing_stored: 1,
    totals: {
      identifiers_attempted: 4,
      loaded: 1,
      no_op: 0,
      not_resolved: 1,
      no_data_for_date: 2,
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
      { date: "2026-10-01", report: report() },
      {
        date: "2026-10-02",
        report: report({
          run_id: "run-2",
          as_of_date: "2026-10-02",
          status: "failed",
          loaded: 0,
          no_op: 0,
          not_resolved: 0,
          no_data_for_date: 2,
          identifiers: [],
        }),
      },
    ],
    started_at: "2026-10-01T00:00:00Z",
    ended_at: "2026-10-01T00:00:02Z",
    duration_ms: 2000,
  };
}

describe("runGroups", () => {
  it("builds one expanded run group from a single report", () => {
    const group = groupLoadReport(report(), { defaultExpanded: true });
    expect(group.id).toBe("run-1");
    expect(group.runId).toBe("run-1");
    expect(group.kind).toBe("run");
    expect(group.title).toBe("2026-10-01");
    expect(group.source).toBe("yahoo_finance");
    expect(group.outcomes).toHaveLength(2);
    expect(group.defaultExpanded).toBe(true);
    expect(group.note).toBeNull();
  });

  it("explains dates with nothing stored", () => {
    const group = groupLoadReport(
      report({
        status: "failed",
        loaded: 0,
        no_op: 0,
        rejected: 1,
        identifiers: [],
      }),
    );
    expect(group.note).toBe("Nothing stored for this date (failed).");
  });

  it("builds one group per date run in a range", () => {
    const groups = groupRangeReport(rangeReport());
    expect(groups.map((group) => group.id)).toEqual(["run-1", "run-2"]);
    expect(groups.map((group) => group.title)).toEqual([
      "2026-10-01",
      "2026-10-02",
    ]);
    expect(groups[1].note).toBe(
      "Nothing stored for this date (no data exists).",
    );
  });

  it("derives labels, failure counts, and unique counts", () => {
    expect(
      runStatusLabel({ kind: "run", status: "running", stale: true }),
    ).toBe("Incomplete / interrupted");
    expect(
      runStatusLabel({ kind: "run", status: "running", stale: false }),
    ).toBe("Running");
    expect(
      runStatusLabel({
        kind: "source_change",
        status: "source_enabled",
        stale: false,
      }),
    ).toBe("Source enabled");
    expect(
      runFailureCount({
        ...groupLoadReport(report()).counters,
        rejected: 1,
        storage_failure: 2,
      }),
    ).toBe(3);
    expect(
      uniqueRequested({
        ...groupLoadReport(report()).counters,
        identifiers_requested_raw: 5,
        identifiers_duplicated: 2,
      }),
    ).toBe(3);
  });
});
