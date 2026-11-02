import {
  OfflineUnavailableError,
  OfflineWriteError,
  isBrowserOnline,
  isOfflineUnavailableError,
  normalizeOfflineError,
} from "../errors";

describe("offline errors", () => {
  it("normalizes network failures while offline", () => {
    expect(normalizeOfflineError(new TypeError("fetch failed"), false)).toBeInstanceOf(
      OfflineUnavailableError,
    );
    expect(normalizeOfflineError({ status: 0 }, false)).toBeInstanceOf(
      OfflineUnavailableError,
    );
    expect(normalizeOfflineError({ status: 0 }, true)).toEqual({ status: 0 });
  });

  it("keeps server and aborted errors intact", () => {
    const serverError = new Error("500");
    expect(normalizeOfflineError(serverError, false)).toBe(serverError);
    const existing = new OfflineUnavailableError();
    expect(normalizeOfflineError(existing, false)).toBe(existing);
  });

  it("exposes an explicit retryable offline-unavailable error", () => {
    const error = new OfflineUnavailableError();
    expect(error.code).toBe("offline_unavailable");
    expect(error.retryable).toBe(true);
    expect(error.retryAction).toBe("retry");
    expect(error.message).toMatch(/not available offline/i);
    expect(isOfflineUnavailableError(error)).toBe(true);
    expect(isOfflineUnavailableError(new Error("x"))).toBe(false);
  });

  it("rejects writes with a non-retryable message", () => {
    const error = new OfflineWriteError();
    expect(error.code).toBe("offline_write");
    expect(error.retryable).toBe(false);
    expect(error.message).toMatch(/needs an internet connection/i);
  });

  it("reads browser connectivity", () => {
    const original = navigator.onLine;
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });
    expect(isBrowserOnline()).toBe(false);
    Object.defineProperty(navigator, "onLine", {
      value: original,
      configurable: true,
    });
  });
});
