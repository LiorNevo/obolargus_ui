/**
 * Normalised offline and write-rejection errors.
 */

/** A read that cannot be satisfied from the network or the offline cache. */
export class OfflineUnavailableError extends Error {
  readonly code = "offline_unavailable";
  readonly retryable = true;
  readonly retryAction = "retry" as const;

  constructor(
    message = "This data is not available offline. Reconnect and retry.",
  ) {
    super(message);
    this.name = "OfflineUnavailableError";
  }
}

/** A write that was rejected because the browser is offline. */
export class OfflineWriteError extends Error {
  readonly code = "offline_write";
  readonly retryable = false;

  constructor(
    message = "This action needs an internet connection. Reconnect and try again.",
  ) {
    super(message);
    this.name = "OfflineWriteError";
  }
}

/** Returns true when the browser reports no usable connection. */
export function isBrowserOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

/** Returns true for the shared offline-unavailable error. */
export function isOfflineUnavailableError(
  error: unknown,
): error is OfflineUnavailableError {
  return error instanceof OfflineUnavailableError;
}

/**
 * Maps a transport failure to the offline-unavailable error while offline.
 *
 * Server errors and aborted requests keep their original identity.
 */
export function normalizeOfflineError(
  error: unknown,
  online: boolean = isBrowserOnline(),
): unknown {
  if (online) return error;
  if (error instanceof OfflineUnavailableError) return error;
  if (error instanceof TypeError) return new OfflineUnavailableError();
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === 0
  ) {
    return new OfflineUnavailableError();
  }
  return error;
}
