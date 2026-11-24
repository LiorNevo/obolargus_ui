import { apiFetch } from "./http";
import type {
  CalendarAssignment,
  CalendarAssignmentPage,
  CalendarDetail,
  CalendarDocument,
  CalendarImportResponse,
  CalendarListResponse,
} from "../types/calendar";

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  headers.set("content-type", "application/json");
  const response = await apiFetch(path, {
    ...init,
    headers,
    signal: init.signal ?? undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}.`);
  }
  return (await response.json()) as T;
}

/** Lists exchange calendars. */
export function fetchCalendarList(): Promise<CalendarListResponse> {
  return requestJson<CalendarListResponse>("/market-data/calendars", {
    method: "GET",
  });
}

/** Reads one calendar and its recent audit trail. */
export function fetchCalendarDetail(mic: string): Promise<CalendarDetail> {
  return requestJson<CalendarDetail>(
    `/market-data/calendars/${encodeURIComponent(mic)}`,
    { method: "GET" },
  );
}

/** Exports one calendar as an importable document. */
export function fetchCalendarExport(mic: string): Promise<CalendarDocument> {
  return requestJson<CalendarDocument>(
    `/market-data/calendars/${encodeURIComponent(mic)}/export`,
    { method: "GET" },
  );
}

/** Imports one calendar document with an optional version guard. */
export function importCalendar(
  document: CalendarDocument,
  expectedVersion: number | null,
): Promise<CalendarImportResponse> {
  const query =
    expectedVersion === null ? "" : `?expected_version=${expectedVersion}`;
  return requestJson<CalendarImportResponse>(
    `/market-data/calendars/${encodeURIComponent(document.mic)}${query}`,
    { method: "PUT", body: JSON.stringify(document) },
  );
}

/** Retires one calendar, optionally confirming the affected fallback. */
export function retireCalendar(
  mic: string,
  confirm: boolean,
): Promise<{ calendar: CalendarDocument; affected_count: number }> {
  return requestJson(`/market-data/calendars/${encodeURIComponent(mic)}/retire`, {
    method: "POST",
    body: JSON.stringify({ confirm }),
  });
}

/** Lists calendar assignments. */
export function fetchAssignments(params: {
  assetId?: string;
  mic?: string;
  limit?: number;
  offset?: number;
}): Promise<CalendarAssignmentPage> {
  const query = new URLSearchParams();
  if (params.assetId) query.set("asset_id", params.assetId);
  if (params.mic) query.set("mic", params.mic);
  query.set("limit", String(params.limit ?? 50));
  query.set("offset", String(params.offset ?? 0));
  return requestJson<CalendarAssignmentPage>(
    `/market-data/calendar-assignments?${query.toString()}`,
    { method: "GET" },
  );
}

/** Creates one effective-dated assignment. */
export function createCalendarAssignment(body: {
  asset_id: string;
  mic: string;
  valid_from: string;
  valid_to: string | null;
}): Promise<CalendarAssignment> {
  return requestJson<CalendarAssignment>("/market-data/calendar-assignments", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Removes one assignment. */
export function deleteCalendarAssignment(id: string): Promise<void> {
  return requestJson<{ removed: boolean }>(
    `/market-data/calendar-assignments/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  ).then(() => undefined);
}
