import {
  DEFAULT_TIMEOUT_MS,
  HttpError,
  SINGLE_LOAD_TIMEOUT_MS,
  apiFetch,
  configureAuthBridge,
  type AuthBridge,
} from "../http";

function response(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(""),
  } as Response;
}

function requestHeaders(init: RequestInit | undefined): Headers {
  return new Headers(init?.headers);
}

function bridge(overrides: Partial<AuthBridge> = {}): AuthBridge {
  return {
    getAccessToken: () => "access-1",
    getAccessTokenExpiresAt: () => null,
    hasSession: () => true,
    refreshAccessToken: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe("apiFetch", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    configureAuthBridge(null);
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("attaches the in-memory access token", async () => {
    const fetchMock = jest.fn().mockResolvedValue(response(200));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    configureAuthBridge(bridge());

    await apiFetch("/assets?limit=5");

    expect(fetchMock.mock.calls[0][0]).toContain("/assets?limit=5");
    expect(requestHeaders(fetchMock.mock.calls[0][1]).get("authorization")).toBe(
      "Bearer access-1",
    );
  });

  it("refreshes an expiring access token before sending the request", async () => {
    let token = "old";
    let expiresAt = Date.now() + 5_000;
    const refresh = jest.fn(async () => {
      token = "new";
      expiresAt = Date.now() + 15 * 60_000;
      return true;
    });
    const fetchMock = jest.fn().mockResolvedValue(response(200));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    configureAuthBridge(
      bridge({
        getAccessToken: () => token,
        getAccessTokenExpiresAt: () => expiresAt,
        refreshAccessToken: refresh,
      }),
    );

    const result = await apiFetch("/assets");

    expect(result.status).toBe(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestHeaders(fetchMock.mock.calls[0][1]).get("authorization")).toBe(
      "Bearer new",
    );
  });

  it("does not refresh a token that is not near expiry", async () => {
    const refresh = jest.fn().mockResolvedValue(true);
    const fetchMock = jest.fn().mockResolvedValue(response(200));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    configureAuthBridge(
      bridge({
        getAccessTokenExpiresAt: () => Date.now() + 10 * 60_000,
        refreshAccessToken: refresh,
      }),
    );

    await apiFetch("/assets");

    expect(refresh).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not send an already-expired token when refresh fails", async () => {
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    configureAuthBridge(
      bridge({
        getAccessToken: () => "expired",
        getAccessTokenExpiresAt: () => Date.now() - 1_000,
        refreshAccessToken: jest.fn().mockResolvedValue(false),
      }),
    );

    await expect(apiFetch("/assets")).rejects.toMatchObject({
      status: 401,
      code: "unauthorized",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes once for concurrent 401s and retries each request once", async () => {
    let token = "old";
    const refresh = jest.fn(async () => {
      token = "new";
      return true;
    });
    const fetchMock = jest.fn(async (_url: string, init: RequestInit) => {
      return requestHeaders(init).get("authorization") === "Bearer new"
        ? response(200)
        : response(401);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    configureAuthBridge(
      bridge({ getAccessToken: () => token, refreshAccessToken: refresh }),
    );

    const [first, second] = await Promise.all([
      apiFetch("/automation/flows"),
      apiFetch("/automation/runs"),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("stops after one refresh retry when the token is still rejected", async () => {
    const refresh = jest.fn().mockResolvedValue(true);
    const fetchMock = jest.fn().mockResolvedValue(response(401));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    configureAuthBridge(bridge({ refreshAccessToken: refresh }));

    await expect(apiFetch("/automation/runs")).rejects.toMatchObject({
      name: "HttpError",
      status: 401,
      code: "unauthorized",
      retryable: false,
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never refreshes or retries auth endpoints", async () => {
    const refresh = jest.fn().mockResolvedValue(true);
    const fetchMock = jest.fn().mockResolvedValue(response(401));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    configureAuthBridge(bridge({ refreshAccessToken: refresh }));

    const login = await apiFetch("/auth/login", { method: "POST" });
    const refreshResponse = await apiFetch("/auth/refresh", {
      method: "POST",
      auth: false,
    });

    expect(login.status).toBe(401);
    expect(refreshResponse.status).toBe(401);
    expect(refresh).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestHeaders(fetchMock.mock.calls[0][1]).has("authorization")).toBe(
      false,
    );
  });

  it("returns a 401 unchanged when no session can be refreshed", async () => {
    const fetchMock = jest.fn().mockResolvedValue(response(401));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    configureAuthBridge(bridge({ hasSession: () => false }));

    const result = await apiFetch("/assets");

    expect(result.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("classifies a stalled request as a retryable timeout", async () => {
    jest.useFakeTimers();
    globalThis.fetch = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        }),
    ) as unknown as typeof fetch;

    const pending = apiFetch("/assets");
    const assertion = expect(pending).rejects.toMatchObject({
      name: "HttpError",
      status: 0,
      code: "timeout",
      retryable: true,
    });
    await jest.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS + 1);
    await assertion;
  });

  it("honours the 55 s single-load override", async () => {
    jest.useFakeTimers();
    globalThis.fetch = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        }),
    ) as unknown as typeof fetch;

    let settled = false;
    const pending = apiFetch("/market-data/load", {
      method: "POST",
      timeoutMs: SINGLE_LOAD_TIMEOUT_MS,
    }).finally(() => {
      settled = true;
    });
    const assertion = expect(pending).rejects.toMatchObject({ code: "timeout" });

    await jest.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS + 1);
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(
      SINGLE_LOAD_TIMEOUT_MS - DEFAULT_TIMEOUT_MS + 1,
    );
    await assertion;
    expect(SINGLE_LOAD_TIMEOUT_MS).toBeLessThan(60_000);
  });

  it("propagates caller aborts without refreshing or retrying", async () => {
    const refresh = jest.fn().mockResolvedValue(true);
    const controller = new AbortController();
    const fetchMock = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          const abort = () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          if (init.signal?.aborted) abort();
          else init.signal?.addEventListener("abort", abort);
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    configureAuthBridge(bridge({ refreshAccessToken: refresh }));

    const pending = apiFetch("/assets", { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(refresh).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps a network failure to a retryable HttpError", async () => {
    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch")) as unknown as typeof fetch;

    await expect(apiFetch("/assets")).rejects.toMatchObject({
      name: "HttpError",
      status: 0,
      code: "network",
      retryable: true,
    });
  });

  it("exposes the default deadline", () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(15_000);
    expect(new HttpError(0, "timeout", "slow", true).retryable).toBe(true);
  });
});
