import { act, screen, waitFor, within } from "@testing-library/react";
import { axe } from "jest-axe";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { DataLoadPage } from "../DataLoadPage";
import { renderWithQueryClient } from "../../query/testUtils";
import { useDataLoadStore } from "../../store/dataLoadStore";
import * as api from "../../api/dataLoad";
import type {
  HistoryEntry,
  IdentifierSearchResponse,
  LoadReport,
  SearchCandidate,
} from "../../types/dataLoad";

jest.mock("../../api/dataLoad", () => {
  const actual = jest.requireActual("../../api/dataLoad");
  return {
    ...actual,
    fetchDomains: jest.fn(),
    fetchSources: jest.fn(),
    fetchHistory: jest.fn(),
    fetchHistoryDetail: jest.fn(),
    fetchIdentifierSearch: jest.fn(),
    fetchProgress: jest.fn(),
    toggleSource: jest.fn(),
    loadOnce: jest.fn(),
    loadRange: jest.fn(),
    startLoadRange: jest.fn(),
    stopLoadRange: jest.fn(),
  };
});

const mocked = api as jest.Mocked<typeof api>;

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
  per_source_attempted: { yahoo_finance: 1 },
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
        as_of_date: "2026-10-01",
        known_at: "2026-10-02T00:00:00Z",
        source_id: "yahoo_finance",
      },
    },
  ],
  started_at: "2026-10-02T00:00:00Z",
  ended_at: "2026-10-02T00:00:01Z",
  duration_ms: 1000,
};


function historyEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    entry_id: "entry-1",
    entry_type: "load_run",
    started_at: "2026-10-01T00:00:00Z",
    ended_at: "2026-10-01T00:00:01Z",
    data_domain: "market_data",
    requested_source: null,
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

function searchCandidate(
  overrides: Partial<SearchCandidate> = {},
): SearchCandidate {
  return {
    symbol: "AAPL",
    display_name: "Apple Inc.",
    asset_type: "EQUITY",
    exchange: "NMS",
    venue_mic: "XNAS",
    currency: "USD",
    relevance: 0.9,
    sources: [
      {
        source_id: "yahoo_finance",
        display_name: "Yahoo Finance",
        relevance: 0.9,
      },
    ],
    identifiers: [
      {
        scheme: "TICKER:XNAS",
        value: "AAPL",
        label: "Ticker (XNAS)",
        primary: true,
        addable: true,
        creatable: true,
        reason: null,
      },
    ],
    conflicts: [],
    known: null,
    addable: true,
    not_addable_reason: null,
    creatable: true,
    creation_blocked_reason: null,
    ...overrides,
  };
}

function searchResponse(
  overrides: Partial<IdentifierSearchResponse> = {},
): IdentifierSearchResponse {
  return {
    query: "apple",
    domain: "market_data",
    outcome: "complete",
    consulted_sources: ["yahoo_finance"],
    sources: [
      {
        source_id: "yahoo_finance",
        display_name: "Yahoo Finance",
        status: "answered",
        hit_count: 1,
        error_code: null,
        message: null,
        retry_after_seconds: null,
      },
    ],
    total: 1,
    offset: 0,
    limit: 25,
    results: [searchCandidate()],
    message: null,
    ...overrides,
  };
}

async function runSearch(
  user: ReturnType<typeof userEvent.setup>,
  text = "apple",
) {
  await user.type(
    screen.getByLabelText("Search external identifiers"),
    text,
  );
  await user.click(screen.getByRole("button", { name: "Search" }));
  await screen.findAllByText("Apple Inc.");
}

function searchRegion() {
  return within(screen.getByRole("region", { name: "Identifier search" }));
}

async function expandSearchResult(
  user: ReturnType<typeof userEvent.setup>,
  accessibleName = "AAPL on XNAS, EQUITY",
) {
  await user.click(
    searchRegion().getByRole("button", {
      name: `Show details for ${accessibleName}`,
    }),
  );
}

function renderPage(initialEntry = "/data-load") {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
  );
  return renderWithQueryClient(<DataLoadPage />, { wrapper });
}

beforeEach(() => {
  useDataLoadStore.getState().reset();
  mocked.fetchIdentifierSearch.mockReset();
  mocked.fetchDomains.mockResolvedValue({
    domains: [
      {
        id: "market_data",
        label: "Market & reference data",
        loadable: true,
        unavailable_reason: null,
      },
      {
        id: "holdings",
        label: "Holdings",
        loadable: false,
        unavailable_reason: "Not available.",
      },
    ],
  });
  mocked.fetchSources.mockResolvedValue({
    domain: "market_data",
    sources: [
      {
        source_id: "yahoo_finance",
        display_name: "Yahoo Finance",
        enabled: true,
        priority: 1,
        supported_schemes: ["TICKER"],
        supported_data_domains: ["market_data"],
        selectable_for_domain: true,
        unavailable_reason: null,
      },
    ],
  });
  mocked.fetchHistory.mockResolvedValue({
    entries: [],
    total: 0,
    limit: 50,
    offset: 0,
  });
  mocked.fetchProgress.mockResolvedValue({
    group_id: "group-1",
    status: "running",
    dates_requested: 2,
    dates_completed: 1,
    dates_failed: 0,
    dates_with_loads: 1,
    started_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:01Z",
  });
  mocked.loadOnce.mockResolvedValue(REPORT);
  mocked.startLoadRange.mockResolvedValue({
    group_id: "group-1",
    status: "accepted",
  });
  mocked.stopLoadRange.mockResolvedValue({ stopped: true });
});

afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  jest.clearAllMocks();
});

describe("DataLoadPage", () => {
  it("renders the three first-class areas and the source catalog", async () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Data Load" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Load" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Sources" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();
    expect((await screen.findAllByText("Yahoo Finance")).length).toBeGreaterThan(0);
  });

  it("validates before sending and sends exactly one load request", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Load" }));
    expect(mocked.loadOnce).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);

    await user.type(
      screen.getByLabelText("Paste identifiers, one per line"),
      "TICKER:XNAS:AAPL",
    );
    await user.click(screen.getByRole("button", { name: "Load" }));
    await waitFor(() => expect(mocked.loadOnce).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("region", { name: "Load report" })).toBeInTheDocument();
    expect(screen.getByText(/Report completed at/)).toBeInTheDocument();
  });

  it("loads a bare ticker typed into the text area", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByLabelText("Paste identifiers, one per line"),
      "QQQM",
    );
    expect(
      screen.getByRole("list", { name: "Parsed identifiers" }),
    ).toHaveTextContent("TICKER QQQM");

    await user.click(screen.getByRole("button", { name: "Load" }));

    await waitFor(() => expect(mocked.loadOnce).toHaveBeenCalledTimes(1));
    expect(mocked.loadOnce.mock.calls[0][0].identifiers).toEqual([
      { type: "TICKER", value: "QQQM" },
    ]);
    expect(
      screen.queryByText("Enter at least one identifier."),
    ).not.toBeInTheDocument();
  });

  it("disables a source through the explicit confirmation", async () => {
    const user = userEvent.setup();
    mocked.toggleSource.mockResolvedValue({ changed: true });
    renderPage();
    const sources = await screen.findByRole("region", { name: "Sources" });
    await screen.findAllByText("Yahoo Finance");
    const sourceCalls = mocked.fetchSources.mock.calls.length;
    const historyCalls = mocked.fetchHistory.mock.calls.length;
    await user.click(within(sources).getByRole("button", { name: "Disable Yahoo Finance" }));
    await user.click(within(sources).getByRole("button", { name: "Confirm disable" }));
    await waitFor(() =>
      expect(mocked.toggleSource).toHaveBeenCalledWith("yahoo_finance", false),
    );
    await waitFor(() =>
      expect(mocked.fetchSources.mock.calls.length).toBeGreaterThan(sourceCalls),
    );
    await waitFor(() =>
      expect(mocked.fetchHistory.mock.calls.length).toBeGreaterThan(historyCalls),
    );
  });

  it("shows a retryable history error instead of an empty list", async () => {
    mocked.fetchHistory.mockRejectedValueOnce(new Error("offline"));
    renderPage();
    expect(await screen.findByText(/History could not be fetched\. offline/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("submits a range with a generated group id", async () => {
    const user = userEvent.setup();
    useDataLoadStore.getState().setDraft({
      mode: "range",
      from: "2026-10-01",
      to: "2026-10-02",
      identifierText: "TICKER:XNAS:AAPL",
      identifiers: [{ scheme: "TICKER:XNAS", value: "AAPL" }],
    });
    renderPage();
    await user.click(screen.getByRole("button", { name: "Load" }));
    await waitFor(() =>
      expect(mocked.startLoadRange).toHaveBeenCalledTimes(1),
    );
    const body = mocked.startLoadRange.mock.calls[0][0];
    expect(body.client_group_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(body.data_domain).toBe("market_data");
    expect(
      await screen.findByRole("heading", { name: "Run monitor" }),
    ).toBeInTheDocument();
  });

  it("stops an in-flight range from the run monitor", async () => {
    const user = userEvent.setup();
    useDataLoadStore.getState().setDraft({
      mode: "range",
      from: "2026-10-01",
      to: "2026-10-02",
      identifierText: "TICKER:XNAS:AAPL",
      identifiers: [{ scheme: "TICKER:XNAS", value: "AAPL" }],
    });
    renderPage();
    await user.click(screen.getByRole("button", { name: "Load" }));
    expect(
      await screen.findByRole("heading", { name: "Run monitor" }),
    ).toBeInTheDocument();

    const groupId =
      mocked.startLoadRange.mock.calls[0][0].client_group_id;
    await user.click(screen.getByRole("button", { name: "Stop run" }));

    await waitFor(() =>
      expect(mocked.stopLoadRange).toHaveBeenCalledWith(groupId),
    );
    expect(
      screen.queryByRole("heading", { name: "Run monitor" }),
    ).not.toBeInTheDocument();
    expect(useDataLoadStore.getState().inFlightRange).toBeNull();
  });

  it("loads a completed background range report after polling settles", async () => {
    const user = userEvent.setup();
    mocked.fetchProgress.mockResolvedValue({
      group_id: "group-1",
      status: "complete",
      dates_requested: 2,
      dates_completed: 2,
      dates_failed: 0,
      dates_with_loads: 2,
      started_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:02Z",
    });
    mocked.fetchHistoryDetail.mockResolvedValue({
      entry: historyEntry({
        entry_id: "group-1",
        entry_type: "range_run",
        date_from: "2026-10-01",
        date_to: "2026-10-02",
        dates_requested: 2,
        dates_completed: 2,
        dates_with_loads: 2,
        range_concurrency: 4,
      }),
      load: null,
      range: {
        from: "2026-10-01",
        to: "2026-10-02",
        concurrency: 4,
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
          { date: "2026-10-01", report: REPORT },
          { date: "2026-10-02", report: { ...REPORT, as_of_date: "2026-10-02" } },
        ],
      },
      source_change: null,
    });
    useDataLoadStore.getState().setDraft({
      mode: "range",
      from: "2026-10-01",
      to: "2026-10-02",
      identifierText: "TICKER:XNAS:AAPL",
      identifiers: [{ scheme: "TICKER:XNAS", value: "AAPL" }],
    });
    renderPage();
    await user.click(screen.getByRole("button", { name: "Load" }));

    expect(
      await screen.findByRole("region", { name: "Range report" }),
    ).toBeInTheDocument();
    expect(useDataLoadStore.getState().inFlightRange).toBeNull();
  });

  it("reports a failed source toggle without changing the catalog", async () => {
    const user = userEvent.setup();
    mocked.toggleSource.mockRejectedValueOnce(new Error("offline"));
    renderPage();
    const sources = await screen.findByRole("region", { name: "Sources" });
    await screen.findAllByText("Yahoo Finance");
    await user.click(within(sources).getByRole("button", { name: "Disable Yahoo Finance" }));
    await user.click(within(sources).getByRole("button", { name: "Confirm disable" }));
    await waitFor(() => expect(screen.getByText(/offline/)).toBeInTheDocument());
    expect((await screen.findAllByText("Yahoo Finance")).length).toBeGreaterThan(0);
  });


  it("keeps cached history rows visible when a background refresh fails", async () => {
    const user = userEvent.setup();
    mocked.fetchHistory.mockResolvedValue({
      entries: [historyEntry()],
      total: 1,
      limit: 50,
      offset: 0,
    });
    renderPage();
    expect(await screen.findByText("1 entries")).toBeInTheDocument();

    mocked.fetchHistory.mockRejectedValueOnce(new Error("refresh offline"));
    const history = screen.getByRole("region", { name: "History" });
    await user.click(within(history).getByRole("button", { name: "Refresh" }));

    expect(
      await screen.findByText(/History could not be fetched\. refresh offline/),
    ).toBeInTheDocument();
    expect(screen.getByText("1 entries")).toBeInTheDocument();
  });
  it("opens a history entry detail", async () => {
    const user = userEvent.setup();
    mocked.fetchHistory.mockResolvedValue({
      entries: [
        {
          entry_id: "entry-1",
          entry_type: "load_run",
          started_at: "2026-10-01T00:00:00Z",
          ended_at: "2026-10-01T00:00:01Z",
          data_domain: "market_data",
          requested_source: null,
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
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    });
    const historyEntry = {
      entry_id: "entry-1",
      entry_type: "load_run" as const,
      started_at: "2026-10-01T00:00:00Z",
      ended_at: "2026-10-01T00:00:01Z",
      data_domain: "market_data",
      requested_source: null,
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
    };
    mocked.fetchHistoryDetail.mockResolvedValue({
      entry: historyEntry,
      load: { report: REPORT },
      range: null,
      source_change: null,
    });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Open" }));
    await waitFor(() =>
      expect(mocked.fetchHistoryDetail).toHaveBeenCalledWith(
        "entry-1",
        expect.any(AbortSignal),
        expect.any(Function),
      ),
    );
    expect(
      await screen.findByRole("heading", { name: "History detail" }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/As of 2026-10-01/)).toBeInTheDocument();
  });

  it("opens a history entry from the selected URL", async () => {
    mocked.fetchHistory.mockResolvedValue({
      entries: [historyEntry()],
      total: 1,
      limit: 50,
      offset: 0,
    });
    mocked.fetchHistoryDetail.mockResolvedValue({
      entry: historyEntry(),
      load: { report: REPORT },
      range: null,
      source_change: null,
    });
    renderPage("/data-load?selected=entry-1");

    await waitFor(() =>
      expect(mocked.fetchHistoryDetail).toHaveBeenCalledWith(
        "entry-1",
        expect.any(AbortSignal),
        expect.any(Function),
      ),
    );
    expect(
      await screen.findByRole("heading", { name: "History detail" }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/As of 2026-10-01/)).toBeInTheDocument();
  });

  it("shows the return notice for a persisted in-flight range", async () => {
    useDataLoadStore.getState().setInFlightRange({
      groupId: "group-1",
      startedAt: "2026-10-01T00:00:00Z",
      from: "2026-10-01",
      to: "2026-10-02",
    });
    mocked.fetchProgress.mockResolvedValue({
      group_id: "group-1",
      status: "running",
      dates_requested: 2,
      dates_completed: 1,
      dates_failed: 0,
      dates_with_loads: 1,
      started_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:01Z",
    });
    renderPage();
    expect(
      await screen.findByText(/may still be running on the server/),
    ).toBeInTheDocument();
  });
});


describe("DataLoadPage continuations", () => {
  it("refreshes history without losing the page", async () => {
    const user = userEvent.setup();
    renderPage();
    const history = await screen.findByRole("region", { name: "History" });
    const before = mocked.fetchHistory.mock.calls.length;
    await user.click(within(history).getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(mocked.fetchHistory.mock.calls.length).toBeGreaterThan(before));
  });

  it("resets after confirmation", async () => {
    const user = userEvent.setup();
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
    useDataLoadStore.getState().setDraft({ identifierText: "TICKER:XNAS:AAPL" });
    renderPage();
    await user.click(screen.getByRole("button", { name: "Reset draft and report" }));
    expect(confirm).toHaveBeenCalled();
    expect(useDataLoadStore.getState().draft.identifierText).toBe("");
    confirm.mockRestore();
  });

  it("reports a history detail failure", async () => {
    const user = userEvent.setup();
    mocked.fetchHistory.mockResolvedValue({
      entries: [
        {
          entry_id: "entry-1",
          entry_type: "load_run",
          started_at: "2026-10-01T00:00:00Z",
          ended_at: "2026-10-01T00:00:01Z",
          data_domain: "market_data",
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
          status: "complete",
          stale: false,
          duration_ms: 0,
          date_from: null,
          date_to: null,
          dates_requested: 0,
          dates_completed: 0,
          dates_with_loads: 0,
          range_concurrency: null,
          source_id: null,
          before_enabled: null,
          after_enabled: null,
          actor: null,
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    });
    mocked.fetchHistoryDetail.mockRejectedValueOnce(new Error("detail offline"));
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Open" }));
    expect(
      await screen.findByText(/History detail failed: detail offline/),
    ).toBeInTheDocument();
  });

  it("shows a completed in-flight range on return", async () => {
    useDataLoadStore.getState().setInFlightRange({
      groupId: "group-1",
      startedAt: "2026-10-01T00:00:00Z",
      from: "2026-10-01",
      to: "2026-10-02",
    });
    mocked.fetchProgress.mockResolvedValue({
      group_id: "group-1",
      status: "complete",
      dates_requested: 2,
      dates_completed: 2,
      dates_failed: 0,
      dates_with_loads: 2,
      started_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:02Z",
    });
    mocked.fetchHistoryDetail.mockResolvedValue({
      entry: {
        entry_id: "group-1",
        entry_type: "range_run",
        started_at: "2026-10-01T00:00:00Z",
        ended_at: "2026-10-01T00:00:02Z",
        data_domain: "market_data",
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
        status: "complete",
        stale: false,
        duration_ms: 2000,
        date_from: "2026-10-01",
        date_to: "2026-10-02",
        dates_requested: 2,
        dates_completed: 2,
        dates_with_loads: 2,
        range_concurrency: 4,
        source_id: null,
        before_enabled: null,
        after_enabled: null,
        actor: null,
      },
      load: null,
      range: null,
      source_change: null,
    });
    renderPage();
    expect(await screen.findByText(/completed on the server/)).toBeInTheDocument();
  });
});


describe("DataLoadPage identifier search", () => {
  it("adds a search result to the batch without changing unrelated draft fields", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch.mockResolvedValue(searchResponse());
    renderPage();
    const before = useDataLoadStore.getState().draft;

    await runSearch(user);
    await expandSearchResult(user);
    await user.click(
      searchRegion().getByRole("button", { name: /^Add TICKER:XNAS:AAPL/ }),
    );

    const draft = useDataLoadStore.getState().draft;
    expect(draft.identifierText).toBe("TICKER:XNAS:AAPL");
    expect(draft.identifiers).toEqual([
      { scheme: "TICKER:XNAS", value: "AAPL" },
    ]);
    expect(
      screen.getByRole("list", { name: "Parsed identifiers" }),
    ).toHaveTextContent("TICKER:XNAS AAPL");
    expect(draft.domain).toBe(before.domain);
    expect(draft.mode).toBe(before.mode);
    expect(draft.date).toBe(before.date);
    expect(draft.from).toBe(before.from);
    expect(draft.to).toBe(before.to);
    expect(draft.sourceId).toBe(before.sourceId);
    expect(draft.createMissingAssets).toBe(before.createMissingAssets);
  });

  it("adds the venue the operator chose for a same-symbol result", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch.mockResolvedValue(
      searchResponse({
        total: 2,
        results: [
          searchCandidate(),
          searchCandidate({
            exchange: "NYQ",
            venue_mic: "XNYS",
            identifiers: [
              {
                scheme: "TICKER:XNYS",
                value: "AAPL",
                label: "Ticker (XNYS)",
                primary: true,
                addable: true,
                creatable: true,
                reason: null,
              },
            ],
          }),
        ],
      }),
    );
    renderPage();

    await runSearch(user);
    await expandSearchResult(user, "AAPL on XNYS, EQUITY");
    await user.click(
      searchRegion().getByRole("button", {
        name: "Add TICKER:XNYS:AAPL for AAPL on XNYS, EQUITY",
      }),
    );

    expect(useDataLoadStore.getState().draft.identifiers).toEqual([
      { scheme: "TICKER:XNYS", value: "AAPL" },
    ]);
  });

  it("enables creation from a new result and keeps the report across a later search", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch.mockResolvedValue(searchResponse());
    renderPage();

    await runSearch(user);
    await expandSearchResult(user);
    const search = searchRegion();
    const create = search.getByLabelText(
      "Create missing assets when a ticker-style identifier resolves to none",
    );
    expect(create).not.toBeChecked();
    await user.click(create);
    expect(useDataLoadStore.getState().draft.createMissingAssets).toBe(true);

    await user.click(
      search.getByRole("button", { name: /^Add TICKER:XNAS:AAPL/ }),
    );
    await user.click(screen.getByRole("button", { name: "Load" }));

    await waitFor(() => expect(mocked.loadOnce).toHaveBeenCalledTimes(1));
    expect(mocked.loadOnce.mock.calls[0][0].create_missing_assets).toBe(true);
    expect(
      await screen.findByRole("region", { name: "Load report" }),
    ).toBeInTheDocument();

    mocked.fetchIdentifierSearch.mockResolvedValue(
      searchResponse({
        query: "micro",
        results: [
          searchCandidate({
            symbol: "MSFT",
            display_name: "Microsoft",
            identifiers: [
              {
                scheme: "TICKER:XNAS",
                value: "MSFT",
                label: "Ticker (XNAS)",
                primary: true,
                addable: true,
                creatable: true,
                reason: null,
              },
            ],
          }),
        ],
      }),
    );
    const input = screen.getByLabelText("Search external identifiers");
    await user.clear(input);
    await user.type(input, "micro");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("Microsoft")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Load report" }),
    ).toBeInTheDocument();
  });

  it("preserves the draft and a completed report when a search fails", async () => {
    const user = userEvent.setup();
    useDataLoadStore.getState().setDraft({
      identifierText: "TICKER:XNAS:AAPL",
      identifiers: [{ scheme: "TICKER:XNAS", value: "AAPL" }],
      sourceId: "yahoo_finance",
    });
    renderPage();
    await user.click(screen.getByRole("button", { name: "Load" }));
    expect(
      await screen.findByRole("region", { name: "Load report" }),
    ).toBeInTheDocument();

    const draftBefore = useDataLoadStore.getState().draft;
    const reportBefore = useDataLoadStore.getState().lastReport;

    mocked.fetchIdentifierSearch.mockResolvedValue(
      searchResponse({
        outcome: "failed",
        total: 0,
        results: [],
        sources: [
          {
            source_id: "yahoo_finance",
            display_name: "Yahoo Finance",
            status: "unavailable",
            hit_count: 0,
            error_code: "unavailable",
            message: "The source could not be searched.",
            retry_after_seconds: null,
          },
        ],
        message:
          "Every consulted source failed. Try again or check the source catalog.",
      }),
    );
    await user.type(
      screen.getByLabelText("Search external identifiers"),
      "apple",
    );
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Every consulted source failed.",
    );
    expect(useDataLoadStore.getState().draft).toEqual(draftBefore);
    expect(useDataLoadStore.getState().lastReport).toBe(reportBefore);
    expect(
      screen.getByRole("region", { name: "Load report" }),
    ).toBeInTheDocument();
  });
});

describe("DataLoadPage accessibility", () => {
  it("has no serious axe violations on the idle page", async () => {
    const { container } = renderPage();
    await screen.findByRole("heading", { name: "Sources" });
    await screen.findAllByText("Yahoo Finance");
    await screen.findByText("No entries match this page.");
    await waitFor(() => expect(mocked.fetchDomains).toHaveBeenCalled());
    let results;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      results = await axe(container);
    });
    expect(results).toHaveNoViolations();
  });
});
