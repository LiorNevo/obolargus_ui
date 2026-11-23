import { DashboardApiError } from "../api/dashboard";
import { DataLoadApiError } from "../api/dataLoad";
import { isOfflineUnavailableError } from "../offline/errors";

/** Reads a `retryable` flag from an error without assuming a concrete class. */
function retryableFlag(error: unknown): boolean | undefined {
  if (typeof error !== "object" || error === null || !("retryable" in error)) {
    return undefined;
  }
  const value = (error as { retryable?: unknown }).retryable;
  return typeof value === "boolean" ? value : undefined;
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "CancelledError")
  );
}

/**
 * A 15 s deadline has already spent the user's patience; the UI offers a
 * manual Retry instead of stacking automatic attempts past the deadline.
 */
function isDeadlineError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "timeout"
  );
}

/**
 * Classifies an API or transport failure for automatic query retry.
 *
 * Permanent client errors and aborted requests are never retryable. Network
 * failures, server failures, and errors that already carry an explicit
 * `retryable` flag are.
 */
export function isRetryableError(error: unknown): boolean {
  if (isAbortError(error)) return false;
  if (isDeadlineError(error)) return false;
  if (isOfflineUnavailableError(error)) return false;

  const flag = retryableFlag(error);
  if (flag !== undefined) return flag;

  if (error instanceof DashboardApiError) return error.retryable;
  if (error instanceof DataLoadApiError) {
    return error.status === 0 || error.status >= 500;
  }
  if (error instanceof TypeError) return true;

  return false;
}

/** Allows at most two automatic retries. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < 2 && isRetryableError(error);
}

/** Exponential delay capped at thirty seconds. */
export function retryDelay(attemptIndex: number): number {
  return Math.min(1_000 * 2 ** attemptIndex, 30_000);
}
