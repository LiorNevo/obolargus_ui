import {
  DataLoadApiError,
  fetchHistory,
  fetchHistoryDetail,
  fetchIdentifierSearch,
  fetchProgress,
  fetchSources,
  loadOnce,
  loadRange,
  startLoadRange,
  stopLoadRange,
  toggleSource,
} from "../dataLoad";

function mockFetch(response: Response) {
  return jest.spyOn(globalThis, "fetch").mockResolvedValue(response);
}

describe("dataLoad API client", () => {
  afterEach(() => jest.restoreAllMocks());

  it("builds the history query from filters", async () => {
    const spy = mockFetch(
      new Response(JSON.stringify({ entries: [], total: 0, limit: 50, offset: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await fetchHistory(
      { from: "2026-10-01", status: "partial", entry_type: "run" },
      50,
      100,
    );

    const url = String(spy.mock.calls[0][0]);
    expect(url).toContain("/data-load/history?");
    expect(url).toContain("from=2026-10-01");
    expect(url).toContain("status=partial");
    expect(url).toContain("entry_type=run");
    expect(url).toContain("limit=50");
    expect(url).toContain("offset=100");
  });

  it("passes the domain to the source catalog", async () => {
    const spy = mockFetch(
      new Response(JSON.stringify({ domain: "market_data", sources: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await fetchSources("market_data");
    expect(String(spy.mock.calls[0][0])).toContain(
      "/data-load/sources?domain=market_data",
    );
  });

  it("maps a JSON error envelope to DataLoadApiError", async () => {
    mockFetch(
      new Response(
        JSON.stringify({
          error: { code: "validation_error", message: "bad range" },
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(
      loadOnce({
        identifiers: [],
        date: "2026-01-01",
        source: null,
        create_missing_assets: false,
        data_domain: "market_data",
      }),
    ).rejects.toMatchObject({
      name: "DataLoadApiError",
      status: 400,
      code: "validation_error",
      message: "bad range",
    });
  });

  it("keeps a legacy text/plain error message", async () => {
    mockFetch(
      new Response("validation error: empty batch", {
        status: 400,
        headers: { "content-type": "text/plain" },
      }),
    );

    await expect(
      loadOnce({
        identifiers: [],
        date: "2026-01-01",
        source: null,
        create_missing_assets: false,
        data_domain: "market_data",
      }),
    ).rejects.toBeInstanceOf(DataLoadApiError);
  });
});


describe("dataLoad API mutations and reads", () => {
  afterEach(() => jest.restoreAllMocks());

  it("toggles a source with a JSON body", async () => {
    const spy = mockFetch(
      new Response(JSON.stringify({ changed: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await toggleSource("yahoo_finance", false, "outage");
    const init = spy.mock.calls[0][1];
    expect(init?.method).toBe("PATCH");
    expect(init?.body).toBe(JSON.stringify({ enabled: false, reason: "outage" }));
  });

  it("posts a range load", async () => {
    const spy = mockFetch(
      new Response(JSON.stringify({ range_group_id: "g" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await loadRange({
      identifiers: [{ type: "TICKER", value: "AAPL" }],
      from: "2026-10-01",
      to: "2026-10-02",
      concurrency: 2,
      source: null,
      create_missing_assets: false,
      data_domain: "market_data",
      client_group_id: "g",
    });
    expect(String(spy.mock.calls[0][0])).toContain("/market-data/load-range");
    expect(spy.mock.calls[0][1]?.body).toContain('"client_group_id":"g"');
  });

  it("posts a fire-and-forget range load", async () => {
    const spy = mockFetch(
      new Response(JSON.stringify({ group_id: "g", status: "accepted" }), {
        status: 202,
        headers: { "content-type": "application/json" },
      }),
    );
    const accepted = await startLoadRange({
      identifiers: [{ type: "TICKER", value: "AAPL" }],
      from: "2026-10-01",
      to: "2026-10-02",
      concurrency: 2,
      source: null,
      create_missing_assets: false,
      data_domain: "market_data",
      client_group_id: "g",
    });
    expect(accepted.group_id).toBe("g");
    expect(accepted.status).toBe("accepted");
    expect(String(spy.mock.calls[0][0])).toContain(
      "/market-data/load-range/async",
    );
  });

  it("requests cancellation of a range run", async () => {
    const spy = mockFetch(
      new Response(JSON.stringify({ stopped: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const result = await stopLoadRange("group-1");
    expect(result.stopped).toBe(true);
    expect(String(spy.mock.calls[0][0])).toContain(
      "/data-load/history/groups/group-1/stop",
    );
    expect(spy.mock.calls[0][1]?.method).toBe("POST");
  });

  it("builds an identifier-search query from every set parameter", async () => {
    const spy = mockFetch(
      new Response(JSON.stringify({ query: "apple", results: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const controller = new AbortController();

    await fetchIdentifierSearch(
      {
        q: "Apple Inc.",
        domain: "market_data",
        source: "yahoo_finance",
        asset_type: "EQUITY",
        exchange: "XNAS",
        limit: 25,
        offset: 50,
      },
      controller.signal,
    );

    const url = new URL(String(spy.mock.calls[0][0]), "http://localhost");
    expect(url.pathname).toContain("/data-load/identifier-search");
    expect(url.searchParams.get("q")).toBe("Apple Inc.");
    expect(url.searchParams.get("domain")).toBe("market_data");
    expect(url.searchParams.get("source")).toBe("yahoo_finance");
    expect(url.searchParams.get("asset_type")).toBe("EQUITY");
    expect(url.searchParams.get("exchange")).toBe("XNAS");
    expect(url.searchParams.get("limit")).toBe("25");
    expect(url.searchParams.get("offset")).toBe("50");
    expect(spy.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it("omits unset identifier-search filters", async () => {
    const spy = mockFetch(
      new Response(JSON.stringify({ query: "apple", results: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await fetchIdentifierSearch({ q: "apple" });

    const url = new URL(String(spy.mock.calls[0][0]), "http://localhost");
    expect(url.searchParams.get("q")).toBe("apple");
    expect(url.searchParams.has("source")).toBe(false);
    expect(url.searchParams.has("asset_type")).toBe(false);
    expect(url.searchParams.has("exchange")).toBe(false);
    expect(url.searchParams.has("limit")).toBe(false);
    expect(url.searchParams.has("offset")).toBe(false);
  });

  it("reads detail and progress", async () => {
    const spy = jest.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ entry: { entry_id: "e" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    await fetchHistoryDetail("e");
    await fetchProgress("g");
    expect(String(spy.mock.calls[0][0])).toContain("/data-load/history/e");
    expect(String(spy.mock.calls[1][0])).toContain(
      "/data-load/history/groups/g/progress",
    );
  });
});
