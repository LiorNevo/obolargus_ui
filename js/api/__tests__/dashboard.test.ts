import { DashboardApiError, loadSeriesPage, searchAssets } from "../dashboard";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe("dashboard API client", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("builds the asset search query and returns items", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        items: [
          {
            id: "id",
            display_name: "Name",
            asset_type: "stock",
            currency: "USD",
            primary_identifier: "TST",
          },
        ],
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const controller = new AbortController();
    const response = await searchAssets("A B", {
      signal: controller.signal,
      limit: 5,
    });
    expect(response.items).toHaveLength(1);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/assets?");
    expect(url).toContain("q=A+B");
    expect(url).toContain("limit=5");
  });

  it("maps an error envelope to a typed error", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      jsonResponse(
        { error: { code: "invalid_limit", message: "bad limit" } },
        400,
      ),
    ) as unknown as typeof fetch;
    await expect(
      searchAssets("x", { signal: new AbortController().signal }),
    ).rejects.toMatchObject({
      code: "invalid_limit",
      status: 400,
      retryable: false,
    });
  });

  it("passes the series query and cursor through", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        subject: "asset",
        subject_id: "id",
        fact_type: "market_price",
        known_at: null,
        points: [],
        coverage: { points: 0, first: null, last: null },
        next_cursor: null,
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await loadSeriesPage(
      "asset-id",
      {
        from: "2026-01-01T00:00:00Z",
        to: "2026-02-01T00:00:00Z",
        limit: 3,
        cursor: "2026-01-02T00:00:00Z",
      },
      { signal: new AbortController().signal },
    );
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/domain/assets/asset-id/facts/market_price/series?");
    expect(url).toContain("cursor=2026-01-02T00%3A00%3A00Z");
  });

  it("exposes a stable error class", () => {
    const error = new DashboardApiError(500, "infrastructure", "boom", true);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("infrastructure");
  });
});
