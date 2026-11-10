/** Shared helpers for the automation pages. */

import { Badge, type BadgeTone } from "lx_client/js/components/Badge";
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

function statusTone(status: string): BadgeTone {
  switch (status) {
    case "succeeded":
    case "active":
    case "published":
      return "success";
    case "partial":
    case "draft":
      return "warning";
    case "failed":
    case "cancelled":
    case "interrupted":
      return "danger";
    case "running":
    case "queued":
      return "info";
    default:
      return "neutral";
  }
}

/** A small status pill shared by the list and detail pages. */
export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{status}</Badge>;
}
