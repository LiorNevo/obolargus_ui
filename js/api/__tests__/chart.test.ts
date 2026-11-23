import { historyLoad, refreshAsset } from "../chart";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
  } as Response;
}

describe("chart API client", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("posts a bounded history window and the refresh request", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: "complete" }))
      .mockResolvedValueOnce(jsonResponse({ run_id: "r1" }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      historyLoad(
        { asset_id: "a1", from: "2026-01-01", to: "2026-02-01" },
        { signal: new AbortController().signal },
      ),
    ).resolves.toEqual({ status: "complete" });
    await expect(
      refreshAsset("a1", { signal: new AbortController().signal }),
    ).resolves.toEqual({ run_id: "r1" });

    const [historyUrl, historyInit] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(historyUrl).toContain("/market-data/history-load");
    expect(historyInit.method).toBe("POST");
    expect(JSON.parse(String(historyInit.body))).toMatchObject({
      asset_id: "a1",
    });
    const [refreshUrl, refreshInit] = fetchMock.mock.calls[1] as unknown as [
      string,
      RequestInit,
    ];
    expect(refreshUrl).toContain("/market-data/refresh");
    expect(refreshInit.method).toBe("POST");
  });

  it("surfaces a non-2xx body as a readable error", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse("history unavailable", 503)) as unknown as typeof fetch;

    await expect(
      historyLoad(
        { asset_id: "a1", from: "2026-01-01", to: "2026-02-01" },
        { signal: new AbortController().signal },
      ),
    ).rejects.toThrow("history unavailable");
  });
});
