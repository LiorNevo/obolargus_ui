/** Shared helpers for the automation pages. */

import { AutomationApiError } from "../../api/automation";

/** Normalizes any thrown value to an operator-facing message. */
export function errorMessage(error: unknown): string {
  if (error instanceof AutomationApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "The request failed.";
}

/** Formats an ISO instant for display, or returns a fallback. */
export function formatInstant(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

/** Formats a duration in milliseconds. */
export function formatDuration(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value < 1_000) return `${value} ms`;
  return `${(value / 1_000).toFixed(1)} s`;
}

/** A small status pill shared by the list and detail pages. */
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`obolargus_automation_status obolargus_automation_status--${status}`}>
      {status}
    </span>
  );
}
