import { todayUtc, useDataLoadStore } from "../dataLoadStore";
import type { LoadReport } from "../../types/dataLoad";

const REPORT: LoadReport = {
  report_version: 1,
  run_id: "run-1",
  data_domain: "market_data",
  as_of_date: "2026-10-01",
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
  started_at: "2026-10-01T00:00:00Z",
  ended_at: "2026-10-01T00:00:01Z",
  duration_ms: 1000,
};

describe("dataLoadStore", () => {
  beforeEach(() => useDataLoadStore.getState().reset());

  it("defaults to a single date and today (UTC)", () => {
    const draft = useDataLoadStore.getState().draft;
    expect(draft.mode).toBe("single");
    expect(draft.date).toBe(todayUtc());
    expect(draft.concurrency).toBe(4);
    expect(draft.createMissingAssets).toBe(false);
  });

  it("updates the draft and stores the last report", () => {
    const store = useDataLoadStore.getState();
    store.setDraft({ identifierText: "TICKER:XNAS:AAPL", sourceId: "yahoo_finance" });
    store.setLastReport({
      domain: "market_data",
      mode: "single",
      completedAt: "2026-10-01T00:00:01Z",
      groupId: null,
      report: REPORT,
    });

    const next = useDataLoadStore.getState();
    expect(next.draft.identifierText).toBe("TICKER:XNAS:AAPL");
    expect(next.draft.sourceId).toBe("yahoo_finance");
    expect(
      (next.lastReport?.report as { run_id?: string }).run_id,
    ).toBe("run-1");
  });

  it("stores and clears an in-flight range marker", () => {
    const store = useDataLoadStore.getState();
    store.setInFlightRange({
      groupId: "group-1",
      startedAt: "2026-10-01T00:00:00Z",
      from: "2026-10-01",
      to: "2026-10-05",
    });
    expect(useDataLoadStore.getState().inFlightRange?.groupId).toBe("group-1");
    store.setInFlightRange(null);
    expect(useDataLoadStore.getState().inFlightRange).toBeNull();
  });

  it("resets draft, report, and in-flight marker", () => {
    const store = useDataLoadStore.getState();
    store.setDraft({ identifierText: "TICKER:XNAS:AAPL" });
    store.setLastReport({
      domain: "market_data",
      mode: "single",
      completedAt: "2026-10-01T00:00:01Z",
      groupId: null,
      report: REPORT,
    });
    store.setInFlightRange({
      groupId: "group-1",
      startedAt: "2026-10-01T00:00:00Z",
      from: "2026-10-01",
      to: "2026-10-05",
    });
    store.reset();

    const next = useDataLoadStore.getState();
    expect(next.draft.identifierText).toBe("");
    expect(next.lastReport).toBeNull();
    expect(next.inFlightRange).toBeNull();
  });
});
