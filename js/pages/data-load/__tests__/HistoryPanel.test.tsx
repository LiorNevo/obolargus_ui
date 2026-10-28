import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HistoryPanel } from "../HistoryPanel";
import type { HistoryEntry, HistoryPage } from "../../../types/dataLoad";

function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    entry_id: "entry-1",
    entry_type: "load_run",
    started_at: "2026-10-01T00:00:00Z",
    ended_at: "2026-10-01T00:00:01Z",
    data_domain: "market_data",
    requested_source: "yahoo_finance",
    answering_sources: ["yahoo_finance"],
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
    status: "complete",
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

const PAGE: HistoryPage = {
  entries: [
    entry(),
    entry({
      entry_id: "change-1",
      entry_type: "source_change",
      status: "source_disabled",
      source_id: "yahoo_finance",
      before_enabled: true,
      after_enabled: false,
    }),
    entry({
      entry_id: "running-1",
      status: "running",
      ended_at: null,
      stale: true,
    }),
  ],
  total: 3,
  limit: 50,
  offset: 0,
};

describe("HistoryPanel", () => {
  it("lists runs and changes with running/stale labels", () => {
    render(
      <HistoryPanel
        page={PAGE}
        filters={{ page: 1 }}
        loading={false}
        error={null}
        onSelect={() => undefined}
        onPage={() => undefined}
        onRefresh={() => undefined}
        onClearFilters={() => undefined}
      />,
    );
    expect(screen.getByText("3 entries")).toBeInTheDocument();
    expect(screen.getByText("Configuration change")).toBeInTheDocument();
    expect(screen.getByText("Incomplete / interrupted")).toBeInTheDocument();
  });

  it("opens an entry", async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    render(
      <HistoryPanel
        page={PAGE}
        filters={{ page: 1 }}
        loading={false}
        error={null}
        onSelect={onSelect}
        onPage={() => undefined}
        onRefresh={() => undefined}
        onClearFilters={() => undefined}
      />,
    );
    await user.click(screen.getAllByRole("button", { name: "Open" })[0]);
    expect(onSelect).toHaveBeenCalledWith("entry-1");
  });

  it("distinguishes empty from a fetch error", () => {
    const { rerender } = render(
      <HistoryPanel
        page={{ entries: [], total: 0, limit: 50, offset: 0 }}
        filters={{ page: 1 }}
        loading={false}
        error={null}
        onSelect={() => undefined}
        onPage={() => undefined}
        onRefresh={() => undefined}
        onClearFilters={() => undefined}
      />,
    );
    expect(screen.getByText("No entries match these filters.")).toBeInTheDocument();

    rerender(
      <HistoryPanel
        page={null}
        filters={{ page: 1 }}
        loading={false}
        error="offline"
        onSelect={() => undefined}
        onPage={() => undefined}
        onRefresh={() => undefined}
        onClearFilters={() => undefined}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("History could not be fetched");
  });
});
