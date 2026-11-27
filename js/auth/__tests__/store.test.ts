import { useAuthStore } from "../store";

function jsonResponse(body: unknown, status = 200, headers = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const session = {
  access_token: "access-1",
  refresh_token: "refresh-1",
  token_type: "Bearer",
  expires_in: 900,
  actor: {
    id: "actor-1",
    email: "owner@example.com",
    is_primary_owner: true,
  },
};

function resetStore(): void {
  useAuthStore.setState({
    status: "signedOut",
    actor: null,
    accessToken: null,
    accessTokenExpiresAt: null,
    refreshToken: null,
    error: null,
  });
}

describe("auth store", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    await useAuthStore.persist.rehydrate();
    resetStore();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("exchanges a Google credential for an in-memory access token", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(session));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await useAuthStore.getState().signInWithGoogleCredential("google-cred");

    const state = useAuthStore.getState();
    expect(state.status).toBe("signedIn");
    expect(state.actor).toEqual({
      id: "actor-1",
      email: "owner@example.com",
      isPrimaryOwner: true,
    });
    expect(state.accessToken).toBe("access-1");
    expect(state.accessTokenExpiresAt).toBeGreaterThan(Date.now());
    expect(state.refreshToken).toBe("refresh-1");
    expect(state.error).toBeNull();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain("/auth/login");
    expect(new Headers(init.headers).get("content-type")).toBe(
      "application/json",
    );
    expect(JSON.parse(String(init.body))).toEqual({ id_token: "google-cred" });
  });

  it("never persists the access token", () => {
    const partialize = useAuthStore.persist.getOptions().partialize;
    const persisted = partialize?.(useAuthStore.getState());
    expect(persisted).toMatchObject({ actor: null, refreshToken: null });
    expect(persisted).not.toHaveProperty("accessToken");
    expect(persisted).not.toHaveProperty("accessTokenExpiresAt");
  });

  it("rejects a malformed sign-in response", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({})) as unknown as typeof fetch;

    await useAuthStore.getState().signInWithGoogleCredential("google-cred");

    expect(useAuthStore.getState().actor).toBeNull();
    expect(useAuthStore.getState().error).toMatchObject({
      code: "invalid_response",
    });
  });

  it("reports a network failure on sign-in", async () => {
    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch")) as unknown as typeof fetch;

    await useAuthStore.getState().signInWithGoogleCredential("google-cred");

    expect(useAuthStore.getState().error).toMatchObject({
      code: "network",
    });
    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });

  it("rejects a malformed refresh response and keeps the session", async () => {
    useAuthStore.setState({
      status: "signedIn",
      actor: session.actor,
      refreshToken: "refresh-1",
    });
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({})) as unknown as typeof fetch;

    await expect(
      useAuthStore.getState().refreshAccessToken(),
    ).resolves.toBe(false);

    expect(useAuthStore.getState().refreshToken).toBe("refresh-1");
    expect(useAuthStore.getState().error).toMatchObject({
      code: "invalid_response",
    });
  });

  it("ignores a refresh result after the session was cleared", async () => {
    useAuthStore.setState({
      status: "signedIn",
      actor: session.actor,
      refreshToken: "refresh-1",
    });
    let resolveResponse: (response: Response) => void = () => {};
    globalThis.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
    ) as unknown as typeof fetch;

    const pending = useAuthStore.getState().refreshAccessToken();
    useAuthStore.getState().clearSession();
    resolveResponse(
      jsonResponse({
        access_token: "access-2",
        token_type: "Bearer",
        expires_in: 900,
      }),
    );

    await expect(pending).resolves.toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().accessTokenExpiresAt).toBeNull();
    expect(useAuthStore.getState().actor).toBeNull();
  });

  it("maps an allowlist rejection without leaking allowlist details", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "account_not_allowed",
            message: "account not allowed",
          },
        },
        403,
      ),
    ) as unknown as typeof fetch;

    await useAuthStore.getState().signInWithGoogleCredential("google-cred");

    const state = useAuthStore.getState();
    expect(state.status).toBe("signedOut");
    expect(state.actor).toBeNull();
    expect(state.error).toMatchObject({ code: "account_not_allowed" });
    expect(state.error?.message).not.toContain("allowlist");
  });

  it("reports the rate-limit wait from Retry-After", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      jsonResponse(
        { error: { code: "rate_limited", message: "slow down" } },
        429,
        { "retry-after": "42" },
      ),
    ) as unknown as typeof fetch;

    await useAuthStore.getState().signInWithGoogleCredential("google-cred");

    expect(useAuthStore.getState().error).toMatchObject({
      code: "rate_limited",
      retryAfterSeconds: 42,
    });
  });

  it("refreshes the access token once for concurrent refreshes", async () => {
    useAuthStore.setState({
      status: "signedIn",
      actor: session.actor,
      refreshToken: "refresh-1",
    });
    let resolveResponse: (response: Response) => void = () => {};
    const fetchMock = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const first = useAuthStore.getState().refreshAccessToken();
    const second = useAuthStore.getState().refreshAccessToken();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveResponse(
      jsonResponse({
        access_token: "access-2",
        token_type: "Bearer",
        expires_in: 900,
      }),
    );

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(useAuthStore.getState().accessToken).toBe("access-2");
    expect(useAuthStore.getState().accessTokenExpiresAt).toBeGreaterThan(
      Date.now(),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain("/auth/refresh");
    expect(JSON.parse(String(init.body))).toEqual({
      refresh_token: "refresh-1",
    });
  });

  it("signs out when the refresh token is rejected", async () => {
    useAuthStore.setState({
      status: "signedIn",
      actor: session.actor,
      refreshToken: "refresh-1",
      accessToken: "access-1",
    });
    globalThis.fetch = jest.fn().mockResolvedValue(
      jsonResponse(
        { error: { code: "unauthorized", message: "expired" } },
        401,
      ),
    ) as unknown as typeof fetch;

    await expect(
      useAuthStore.getState().refreshAccessToken(),
    ).resolves.toBe(false);

    const state = useAuthStore.getState();
    expect(state.status).toBe("signedOut");
    expect(state.actor).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.error?.code).toBe("session_expired");
  });

  it("keeps the session on a network refresh failure", async () => {
    useAuthStore.setState({
      status: "signedIn",
      actor: session.actor,
      refreshToken: "refresh-1",
    });
    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch")) as unknown as typeof fetch;

    await expect(
      useAuthStore.getState().refreshAccessToken(),
    ).resolves.toBe(false);

    const state = useAuthStore.getState();
    expect(state.refreshToken).toBe("refresh-1");
    expect(state.actor).not.toBeNull();
    expect(state.error?.code).toBe("network");
  });

  it("clears the session and its persisted identity", () => {
    useAuthStore.setState({
      status: "signedIn",
      actor: session.actor,
      accessToken: "access-1",
      refreshToken: "refresh-1",
    });

    useAuthStore.getState().clearSession();

    const state = useAuthStore.getState();
    expect(state).toMatchObject({
      status: "signedOut",
      actor: null,
      accessToken: null,
      refreshToken: null,
      error: null,
    });
  });
});
