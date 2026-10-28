import {
  DataLoadApiError,
  fetchHistory,
  fetchHistoryDetail,
  fetchProgress,
  fetchSources,
  loadOnce,
  loadRange,
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
