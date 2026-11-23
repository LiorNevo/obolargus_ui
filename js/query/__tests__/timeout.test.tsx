import { DEFAULT_TIMEOUT_MS } from "../../api/http";
import { searchAssets } from "../../api/dashboard";
import { createTestQueryClient } from "../client";
import { isRetryableError } from "../retry";

function abortableFetch(): jest.Mock {
  return jest.fn(
    (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      }),
  );
}

describe("UI request deadline and supersession", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("surfaces a retryable timeout from a stalled dashboard read", async () => {
    jest.useFakeTimers();
    globalThis.fetch = abortableFetch() as unknown as typeof fetch;
    const client = createTestQueryClient();

    const pending = client
      .fetchQuery({
        queryKey: ["assets", "stalled"],
        queryFn: ({ signal }) => searchAssets("stalled", { signal }),
      })
      .catch((error: unknown) => error);

    await jest.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS + 1);
    const error = await pending;

    expect(error).toMatchObject({ code: "timeout", retryable: true });
    // The widget offers a manual Retry, but the query layer must not stack
    // more 15 s attempts past the deadline.
    expect(isRetryableError(error)).toBe(false);
  });

  it("aborts a superseded request instead of retrying it", async () => {
    const fetchMock = abortableFetch();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const controller = new AbortController();

    const pending = searchAssets("AAPL", { signal: controller.signal }).catch(
      (error: unknown) => error,
    );
    controller.abort();
    const error = await pending;

    const signal = (fetchMock.mock.calls[0][1] as RequestInit)
      .signal as AbortSignal;
    expect(signal.aborted).toBe(true);
    expect(error).toMatchObject({ name: "AbortError" });
    expect(isRetryableError(error)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
