import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  CandidateIdentifier,
  DataLoadDraft,
  IdentifierSearchOutcome,
  IdentifierSearchResponse,
  SearchCandidate,
  SourceCatalogEntry,
} from "../../../types/dataLoad";
import * as api from "../../../api/dataLoad";
import { renderWithQueryClient } from "../../../query/testUtils";
import { useOfflineStore } from "../../../offline/offlineStore";
import {
  IdentifierSearch,
  type IdentifierSearchProps,
} from "../IdentifierSearch";

jest.mock("../../../api/dataLoad", () => {
  const actual = jest.requireActual("../../../api/dataLoad");
  return {
    ...actual,
    fetchIdentifierSearch: jest.fn(),
  };
});

const mocked = api as jest.Mocked<typeof api>;

const SOURCE: SourceCatalogEntry = {
  source_id: "yahoo_finance",
  display_name: "Yahoo Finance",
  enabled: true,
  priority: 1,
  supported_schemes: ["TICKER", "ISIN"],
  supported_data_domains: ["market_data"],
  selectable_for_domain: true,
  unavailable_reason: null,
};

const PRIMARY: CandidateIdentifier = {
  scheme: "TICKER:XNAS",
  value: "AAPL",
  label: "Ticker (XNAS)",
  primary: true,
  addable: true,
  creatable: true,
  reason: null,
};

function candidate(
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
    identifiers: [PRIMARY],
    conflicts: [],
    known: null,
    addable: true,
    not_addable_reason: null,
    creatable: true,
    creation_blocked_reason: null,
    ...overrides,
  };
}

function response(
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
    results: [candidate()],
    message: null,
    ...overrides,
  };
}

function draft(overrides: Partial<DataLoadDraft> = {}): DataLoadDraft {
  return {
    domain: "market_data",
    mode: "single",
    identifierText: "",
    identifiers: [],
    date: "2026-11-04",
    from: "2026-11-01",
    to: "2026-11-04",
    concurrency: 4,
    sourceId: null,
    createMissingAssets: false,
    ...overrides,
  };
}

function renderSearch(overrides: Partial<IdentifierSearchProps> = {}) {
  const props: IdentifierSearchProps = {
    draft: draft(),
    sources: [SOURCE],
    onAddIdentifiers: jest.fn(() => ({ added: 1, skipped: 0 })),
    onToggleCreateMissing: jest.fn(),
    ...overrides,
  };
  const view = renderWithQueryClient(<IdentifierSearch {...props} />);
  return {
    ...view,
    onAddIdentifiers: props.onAddIdentifiers,
    onToggleCreateMissing: props.onToggleCreateMissing,
  };
}

async function submitSearch(
  user: ReturnType<typeof userEvent.setup>,
  text = "apple",
) {
  await user.type(
    screen.getByLabelText("Search external identifiers"),
    text,
  );
  await user.click(screen.getByRole("button", { name: "Search" }));
}

async function expandResult(
  user: ReturnType<typeof userEvent.setup>,
  accessibleName = "AAPL on XNAS, EQUITY",
) {
  await user.click(
    screen.getByRole("button", {
      name: `Show details for ${accessibleName}`,
    }),
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  useOfflineStore.getState().setConnectivity("online", "reconnected");
});

describe("IdentifierSearch query lifecycle", () => {
  it("blocks a query shorter than two non-whitespace characters", async () => {
    const user = userEvent.setup();
    renderSearch();

    await user.type(
      screen.getByLabelText("Search external identifiers"),
      " a ",
    );
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(mocked.fetchIdentifierSearch).not.toHaveBeenCalled();
    expect(
      screen.getAllByText("Enter at least 2 characters to search.").length,
    ).toBeGreaterThan(0);
  });

  it("does not search until the operator submits", async () => {
    const user = userEvent.setup();
    renderSearch();

    await user.type(
      screen.getByLabelText("Search external identifiers"),
      "apple",
    );
    expect(mocked.fetchIdentifierSearch).not.toHaveBeenCalled();

    mocked.fetchIdentifierSearch.mockResolvedValue(response());
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() =>
      expect(mocked.fetchIdentifierSearch).toHaveBeenCalledTimes(1),
    );
    expect(mocked.fetchIdentifierSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "apple",
        domain: "market_data",
        limit: 25,
        offset: 0,
      }),
      expect.anything(),
    );
  });

  it("announces progress while the request is in flight", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch.mockReturnValue(new Promise(() => {}));
    renderSearch();

    await submitSearch(user);

    await waitFor(() =>
      expect(screen.getAllByText("Searching…").length).toBeGreaterThan(0),
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("renders the results list and a truthful count", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch.mockResolvedValue(response());
    renderSearch();

    await submitSearch(user);

    expect(await screen.findByText("Apple Inc.")).toBeInTheDocument();
    expect(
      screen.getByRole("article", { name: "AAPL on XNAS, EQUITY" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Search results" }),
    ).toHaveClass("obolargus_search_result_scroll");
    expect(
      screen.getByText("Showing 1–1 of 1 result(s)."),
    ).toBeInTheDocument();
    expect(screen.queryByText("USD")).not.toBeInTheDocument();

    await expandResult(user);

    expect(screen.getByText("USD")).toBeInTheDocument();
    const hide = screen.getByRole("button", {
      name: "Hide details for AAPL on XNAS, EQUITY",
    });
    expect(hide).toHaveAttribute("aria-expanded", "true");

    await user.click(hide);

    expect(screen.queryByText("USD")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Show details for AAPL on XNAS, EQUITY",
      }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("distinguishes a genuine no-match from a failure", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch.mockResolvedValue(
      response({ total: 0, results: [], sources: [] }),
    );
    renderSearch();

    await submitSearch(user);

    expect(
      (await screen.findAllByText(/No instruments matched/)).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText(/could not be searched/),
    ).not.toBeInTheDocument();
  });

  it("cancels an in-flight search and keeps the last results visible", async () => {
    const user = userEvent.setup();
    let resolveFirst: ((value: IdentifierSearchResponse) => void) | undefined;
    mocked.fetchIdentifierSearch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );
    renderSearch();

    await submitSearch(user);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getAllByText("Search stopped.").length).toBeGreaterThan(0);

    mocked.fetchIdentifierSearch.mockResolvedValue(response());
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Apple Inc.")).toBeInTheDocument();
    resolveFirst?.(response());
  });

  it("aborts the superseded request when a new search starts", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch.mockReturnValueOnce(new Promise(() => {}));
    renderSearch();

    await submitSearch(user, "apple");
    await waitFor(() =>
      expect(mocked.fetchIdentifierSearch).toHaveBeenCalledTimes(1),
    );
    const firstSignal = mocked.fetchIdentifierSearch.mock
      .calls[0][1] as AbortSignal;

    mocked.fetchIdentifierSearch.mockResolvedValueOnce(
      response({ query: "micro" }),
    );
    const input = screen.getByLabelText("Search external identifiers");
    await user.clear(input);
    await user.type(input, "micro");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() =>
      expect(mocked.fetchIdentifierSearch).toHaveBeenCalledTimes(2),
    );
    expect(firstSignal.aborted).toBe(true);
  });
});

describe("IdentifierSearch add flows", () => {
  it("adds one result", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch.mockResolvedValue(response());
    const { onAddIdentifiers } = renderSearch();

    await submitSearch(user);
    await screen.findByText("Apple Inc.");
    await expandResult(user);
    await user.click(
      screen.getByRole("button", { name: /^Add TICKER:XNAS:AAPL/ }),
    );

    expect(onAddIdentifiers).toHaveBeenCalledWith([
      { scheme: "TICKER:XNAS", value: "AAPL" },
    ]);
    expect(screen.getByText("Added 1 identifier(s).")).toBeInTheDocument();
  });

  it("adds every selected result once", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch.mockResolvedValue(
      response({
        total: 2,
        results: [
          candidate(),
          candidate({
            symbol: "MSFT",
            display_name: "Microsoft",
            venue_mic: "XNAS",
            identifiers: [
              {
                ...PRIMARY,
                scheme: "TICKER:XNAS",
                value: "MSFT",
              },
            ],
          }),
        ],
      }),
    );
    const { onAddIdentifiers } = renderSearch();

    await submitSearch(user);
    await screen.findByText("Apple Inc.");
    await user.click(screen.getByLabelText("Select AAPL on XNAS"));
    await user.click(screen.getByLabelText("Select MSFT on XNAS"));
    await user.click(screen.getByRole("button", { name: "Add selected" }));

    expect(onAddIdentifiers).toHaveBeenCalledWith([
      { scheme: "TICKER:XNAS", value: "AAPL" },
      { scheme: "TICKER:XNAS", value: "MSFT" },
    ]);
  });

  it("discloses an exact duplicate and disables adding it", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch.mockResolvedValue(response());
    renderSearch({
      draft: draft({
        identifierText: "TICKER:XNAS:AAPL",
        identifiers: [{ scheme: "TICKER:XNAS", value: "AAPL" }],
      }),
    });

    await submitSearch(user);
    await screen.findByText("Apple Inc.");
    await expandResult(user);

    expect(screen.getAllByText("Already added").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /^Add TICKER:XNAS:AAPL/ }),
    ).toBeDisabled();
  });

  it("discloses skipped duplicates after an add", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch.mockResolvedValue(response());
    const { onAddIdentifiers } = renderSearch({
      onAddIdentifiers: jest.fn(() => ({ added: 0, skipped: 1 })),
    });

    await submitSearch(user);
    await screen.findByText("Apple Inc.");
    await expandResult(user);
    await user.click(
      screen.getByRole("button", { name: /^Add TICKER:XNAS:AAPL/ }),
    );

    expect(onAddIdentifiers).toHaveBeenCalled();
    expect(
      screen.getByText("Added 0; skipped 1 duplicate(s)."),
    ).toBeInTheDocument();
  });
});

describe("IdentifierSearch badges and creation", () => {
  it("labels a new, known, added, and not-addable result in text", async () => {
    const user = userEvent.setup();
    const known = candidate({
      symbol: "GOOG",
      display_name: "Alphabet",
      identifiers: [{ ...PRIMARY, value: "GOOG" }],
      known: {
        asset_id: "11111111-1111-4111-8111-111111111111",
        asset_type: "EQUITY",
        display_name: "Alphabet",
        currency: "USD",
        matched_scheme: "TICKER:XNAS",
        matched_value: "GOOG",
        match_kind: "exact",
      },
    });
    const notAddable = candidate({
      symbol: "ZZZZ",
      display_name: "Unknown",
      asset_type: null,
      venue_mic: null,
      exchange: null,
      addable: false,
      not_addable_reason:
        "The load cannot create an asset whose type is not recognized.",
      creatable: false,
      identifiers: [
        {
          ...PRIMARY,
          scheme: "TICKER",
          value: "ZZZZ",
          addable: false,
          creatable: false,
          reason: "The symbol cannot be expressed as a load identifier.",
        },
      ],
    });
    mocked.fetchIdentifierSearch.mockResolvedValue(
      response({
        total: 3,
        results: [candidate(), known, notAddable],
      }),
    );
    renderSearch({
      draft: draft({
        identifierText: "TICKER:XNAS:MSFT",
        identifiers: [{ scheme: "TICKER:XNAS", value: "MSFT" }],
      }),
    });

    await submitSearch(user);
    await screen.findAllByText("Apple Inc.");
    await expandResult(user, "ZZZZ on Unknown venue, Unknown type");

    expect(screen.getByText("New asset")).toBeInTheDocument();
    expect(screen.getByText("Already in system")).toBeInTheDocument();
    expect(screen.getByText("Not addable")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The load cannot create an asset whose type is not recognized.",
      ),
    ).toBeInTheDocument();
  });

  it("offers the creation opt-in for a new result and toggles the draft", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch.mockResolvedValue(response());
    const { onToggleCreateMissing } = renderSearch();

    await submitSearch(user);
    await screen.findByText("Apple Inc.");
    await expandResult(user);

    const checkbox = screen.getByLabelText(
      "Create missing assets when a ticker-style identifier resolves to none",
    );
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(onToggleCreateMissing).toHaveBeenCalledWith(true);
    expect(
      screen.getByText(/does not enable creation/),
    ).toBeInTheDocument();
  });

  it("does not offer creation for a known result", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch.mockResolvedValue(
      response({
        results: [
          candidate({
            known: {
              asset_id: "11111111-1111-4111-8111-111111111111",
              asset_type: "EQUITY",
              display_name: "Apple Inc.",
              currency: "USD",
              matched_scheme: "TICKER",
              matched_value: "AAPL",
              match_kind: "equivalent_ticker",
            },
          }),
        ],
      }),
    );
    renderSearch();

    await submitSearch(user);
    await screen.findByText("Apple Inc.");
    await expandResult(user);

    expect(
      screen.queryByLabelText(
        "Create missing assets when a ticker-style identifier resolves to none",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/equivalent ticker/)).toBeInTheDocument();
  });
});

describe("IdentifierSearch disambiguation and paging", () => {
  it("keeps same-symbol venues distinguishable by accessible name", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch.mockResolvedValue(
      response({
        total: 2,
        results: [
          candidate(),
          candidate({
            venue_mic: "XNYS",
            exchange: "NYQ",
            identifiers: [
              { ...PRIMARY, scheme: "TICKER:XNYS", label: "Ticker (XNYS)" },
            ],
          }),
        ],
      }),
    );
    renderSearch();

    await submitSearch(user);

    expect(
      await screen.findByRole("article", { name: "AAPL on XNAS, EQUITY" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("article", { name: "AAPL on XNYS, EQUITY" }),
    ).toBeInTheDocument();
  });

  it("applies the single-select filters", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch.mockResolvedValue(response());
    renderSearch();

    await submitSearch(user);
    await screen.findByText("Apple Inc.");

    await user.selectOptions(screen.getByLabelText("Source"), "yahoo_finance");
    await waitFor(() =>
      expect(mocked.fetchIdentifierSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({ source: "yahoo_finance", offset: 0 }),
        expect.anything(),
      ),
    );

    await user.selectOptions(screen.getByLabelText("Asset type"), "EQUITY");
    await waitFor(() =>
      expect(mocked.fetchIdentifierSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({ asset_type: "EQUITY" }),
        expect.anything(),
      ),
    );

    await user.selectOptions(screen.getByLabelText("Exchange"), "XNAS");
    await waitFor(() =>
      expect(mocked.fetchIdentifierSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({ exchange: "XNAS" }),
        expect.anything(),
      ),
    );
  });

  it("pages with previous and next while keeping the total", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch
      .mockResolvedValueOnce(response({ total: 60, results: [candidate()] }))
      .mockResolvedValueOnce(
        response({ total: 60, offset: 25, results: [candidate()] }),
      )
      .mockResolvedValueOnce(
        response({ total: 60, offset: 0, results: [candidate()] }),
      );
    renderSearch();

    await submitSearch(user);
    await screen.findByText("Apple Inc.");
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() =>
      expect(mocked.fetchIdentifierSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 25 }),
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(screen.getByText("Page 2 of 3")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Previous page" }));
    await waitFor(() =>
      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument(),
    );
  });

  it("discloses conflicting metadata with attribution", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch.mockResolvedValue(
      response({
        results: [
          candidate({
            conflicts: [
              {
                field: "display_name",
                values: [
                  { value: "Apple Inc.", sources: ["yahoo_finance"] },
                  { value: "Apple Incorporated", sources: ["other_source"] },
                ],
              },
            ],
          }),
        ],
      }),
    );
    renderSearch();

    await submitSearch(user);
    await screen.findAllByText("Apple Inc.");
    await expandResult(user);

    expect(
      screen.getByText("Sources disagree — review before adding"),
    ).toBeInTheDocument();
    expect(screen.getByText("Apple Incorporated")).toBeInTheDocument();
    expect(screen.getAllByText(/other_source/).length).toBeGreaterThan(0);
  });

  it("adds the alternate identifier the operator chose", async () => {
    const user = userEvent.setup();
    const alternate: CandidateIdentifier = {
      scheme: "ISIN",
      value: "US0378331005",
      label: "ISIN",
      primary: false,
      addable: true,
      creatable: false,
      reason: "The load can resolve this scheme but cannot create an asset from it.",
    };
    mocked.fetchIdentifierSearch.mockResolvedValue(
      response({
        results: [candidate({ identifiers: [PRIMARY, alternate] })],
      }),
    );
    const { onAddIdentifiers } = renderSearch();

    await submitSearch(user);
    await screen.findByText("Apple Inc.");
    await expandResult(user);

    await user.selectOptions(
      screen.getByLabelText("Identifier to add for AAPL on XNAS"),
      "ISIN\u0000US0378331005",
    );
    await user.click(
      screen.getByRole("button", { name: /^Add ISIN:US0378331005/ }),
    );

    expect(onAddIdentifiers).toHaveBeenCalledWith([
      { scheme: "ISIN", value: "US0378331005" },
    ]);
  });
});

describe("IdentifierSearch partial and failure states", () => {
  it("shows partial results and names the failed source", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch.mockResolvedValue(
      response({
        outcome: "partial",
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
      }),
    );
    renderSearch();

    await submitSearch(user);

    expect(
      (await screen.findAllByText(/Yahoo Finance could not be searched/)).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
  });

  it("shows a total failure as an alert, not a no-match", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch.mockResolvedValue(
      response({
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
        message: "Every consulted source failed. Try again or check the source catalog.",
      }),
    );
    renderSearch();

    await submitSearch(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Every consulted source failed.",
    );
    expect(screen.queryByText(/No instruments matched/)).not.toBeInTheDocument();
  });

  it("shows a rate limit with its cooldown", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch.mockResolvedValue(
      response({
        outcome: "partial",
        sources: [
          {
            source_id: "yahoo_finance",
            display_name: "Yahoo Finance",
            status: "rate_limited",
            hit_count: 0,
            error_code: "rate_limited",
            message: "budget",
            retry_after_seconds: 60,
          },
        ],
      }),
    );
    renderSearch();

    await submitSearch(user);

    expect(
      await screen.findByText(
        "Yahoo Finance is temporarily rate limited. Try again in 60 seconds.",
      ),
    ).toBeInTheDocument();
  });

  it("explains that no source can search", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch.mockResolvedValue(
      response({
        outcome: "no_sources",
        consulted_sources: [],
        sources: [],
        total: 0,
        results: [],
        message:
          "No enabled source can search market data. Enable a source in the source catalog.",
      }),
    );
    renderSearch();

    await submitSearch(user);

    expect(
      (await screen.findAllByText(/No enabled source can search market data/))
        .length,
    ).toBeGreaterThan(0);
  });

  it("distinguishes a filtered empty result from a genuine no-match", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch.mockResolvedValue(
      response({ total: 0, results: [] }),
    );
    renderSearch();

    await submitSearch(user);
    await screen.findAllByText(/No instruments matched/);

    await user.selectOptions(screen.getByLabelText("Source"), "yahoo_finance");

    expect(
      (await screen.findAllByText("No instruments match these filters."))
        .length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/No instruments matched/)).not.toBeInTheDocument();
  });

  it("marks an unrecognized outcome as unknown instead of no-match", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch.mockResolvedValue(
      response({
        outcome: "mystery" as IdentifierSearchOutcome,
        total: 0,
        results: [],
      }),
    );
    renderSearch();

    await submitSearch(user);

    expect(
      (await screen.findAllByText(/unrecognized outcome/)).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/No instruments matched/)).not.toBeInTheDocument();
  });

  it("disables search while offline but keeps manual entry available", () => {
    useOfflineStore.getState().setConnectivity("offline", "browser-offline");
    renderSearch();

    expect(
      screen.getByText(/Search is unavailable while offline/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeDisabled();
    expect(mocked.fetchIdentifierSearch).not.toHaveBeenCalled();
  });

  it("shows no sources and disables search when no source is eligible", () => {
    renderSearch({
      sources: [{ ...SOURCE, enabled: false }],
    });

    expect(
      screen.getByText(/No enabled source can search market data/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeDisabled();
  });
});

describe("IdentifierSearch accessibility", () => {
  it("submits from the keyboard and uses a polite live region", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch.mockResolvedValue(response());
    const { container } = renderSearch();

    const input = screen.getByLabelText("Search external identifiers");
    await user.type(input, "apple{Enter}");

    await waitFor(() =>
      expect(mocked.fetchIdentifierSearch).toHaveBeenCalledTimes(1),
    );
    expect(await screen.findByText("Apple Inc.")).toBeInTheDocument();
    const live = container.querySelector(".obolargus_search_live");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toHaveAttribute("role", "status");
  });

  it("gives every add control an accessible name with symbol, venue, and type", async () => {
    const user = userEvent.setup();
    mocked.fetchIdentifierSearch.mockResolvedValue(response());
    renderSearch();

    await submitSearch(user);
    await screen.findByText("Apple Inc.");
    await expandResult(user);

    expect(
      screen.getByRole("button", {
        name: "Add TICKER:XNAS:AAPL for AAPL on XNAS, EQUITY",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Select AAPL on XNAS")).toBeInTheDocument();
  });
});
