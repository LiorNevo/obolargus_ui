import { DashboardApiError } from "../../api/dashboard";
import { DataLoadApiError } from "../../api/dataLoad";
import { isRetryableError, retryDelay, shouldRetry } from "../retry";

function abortError(): Error {
  const error = new Error("aborted");
  error.name = "AbortError";
  return error;
}

describe("query retry policy", () => {
  it("retries retryable dashboard errors and stops after two retries", () => {
    const error = new DashboardApiError(503, "unavailable", "offline", true);
    expect(isRetryableError(error)).toBe(true);
    expect(shouldRetry(0, error)).toBe(true);
    expect(shouldRetry(1, error)).toBe(true);
    expect(shouldRetry(2, error)).toBe(false);
  });

  it("does not retry permanent dashboard errors", () => {
    const error = new DashboardApiError(400, "validation", "bad", false);
    expect(isRetryableError(error)).toBe(false);
  });

  it("retries data-load server and network failures", () => {
    expect(isRetryableError(new DataLoadApiError(500, "server", "boom"))).toBe(
      true,
    );
    expect(isRetryableError(new DataLoadApiError(0, "network", "down"))).toBe(
      true,
    );
    expect(isRetryableError(new DataLoadApiError(404, "missing", "no"))).toBe(
      false,
    );
    expect(isRetryableError(new TypeError("fetch failed"))).toBe(true);
  });

  it("never retries aborts or unknown errors", () => {
    expect(isRetryableError(abortError())).toBe(false);
    expect(isRetryableError(new Error("unexpected"))).toBe(false);
  });

  it("backs off exponentially and caps at thirty seconds", () => {
    expect(retryDelay(0)).toBe(1_000);
    expect(retryDelay(1)).toBe(2_000);
    expect(retryDelay(5)).toBe(30_000);
  });
});
