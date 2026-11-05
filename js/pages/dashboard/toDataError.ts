import { DashboardDataError } from "lx_client/js/components/Dashboard/types";
import { DashboardApiError } from "../../api/dashboard";

/**
 * Normalizes a dashboard transport or mapping failure for `lx_client`.
 *
 * Aborted requests are rethrown unchanged so the caller can ignore them; all
 * other failures become `DashboardDataError` with a user-safe message.
 */
export function toDataError(caught: unknown): DashboardDataError {
  if (caught instanceof DashboardDataError) return caught;
  if (caught instanceof DashboardApiError) {
    const message =
      caught.code === "unknown_subject"
        ? "This instrument no longer exists. Choose another instrument."
        : caught.message;
    return new DashboardDataError(message, {
      code: caught.code,
      retryable: caught.retryable,
      status: caught.status,
    });
  }
  return new DashboardDataError(
    caught instanceof Error ? caught.message : "The market data request failed.",
    { code: "unknown", retryable: true },
  );
}
