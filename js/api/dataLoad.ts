import { API_BASE_URL } from "./config";
import type {
  DomainCatalog,
  HistoryDetail,
  HistoryFiltersValue,
  HistoryPage,
  LoadReport,
  RangeProgress,
  RangeReport,
  SourceCatalogResponse,
} from "../types/dataLoad";

/** A normalized request error with a stable code. */
export class DataLoadApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "DataLoadApiError";
    this.status = status;
    this.code = code;
  }
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

async function request<T>(
  path: string,
  init?: Parameters<typeof fetch>[1],
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (response.ok) {
    return (await response.json()) as T;
  }
  const text = await response.text();
  let code = "request_failed";
  let message = text || `request failed with status ${response.status}`;
  try {
    const envelope = JSON.parse(text) as ErrorEnvelope;
    code = envelope.error?.code ?? code;
    message = envelope.error?.message ?? message;
  } catch {
    // Legacy load endpoints return text/plain; keep the text as the message.
  }
  throw new DataLoadApiError(response.status, code, message);
}

/** Loads the declared data domains. */
export function fetchDomains(signal?: AbortSignal): Promise<DomainCatalog> {
  return request<DomainCatalog>("/data-load/domains", { signal });
}

/** Loads the configured source catalog, optionally for one domain. */
export function fetchSources(
  domain?: string,
  signal?: AbortSignal,
): Promise<SourceCatalogResponse> {
  const query = domain ? `?domain=${encodeURIComponent(domain)}` : "";
  return request<SourceCatalogResponse>(`/data-load/sources${query}`, { signal });
}

/** Enables or disables one configured source. */
export function toggleSource(
  sourceId: string,
  enabled: boolean,
  reason?: string | null,
  signal?: AbortSignal,
): Promise<unknown> {
  return request(`/data-load/sources/${encodeURIComponent(sourceId)}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled, reason: reason ?? null }),
    signal,
  });
}

export interface SingleLoadRequest {
  identifiers: Array<{ type: string; value: string }>;
  date: string;
  source: string | null;
  create_missing_assets: boolean;
  data_domain: string;
}

/** Runs a single-date load. */
export function loadOnce(
  body: SingleLoadRequest,
  signal?: AbortSignal,
): Promise<LoadReport> {
  return request<LoadReport>("/market-data/load", {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });
}

export interface RangeLoadRequest {
  identifiers: Array<{ type: string; value: string }>;
  from: string;
  to: string;
  concurrency: number;
  source: string | null;
  create_missing_assets: boolean;
  data_domain: string;
  client_group_id: string;
}

/** Runs a date-range load. */
export function loadRange(
  body: RangeLoadRequest,
  signal?: AbortSignal,
): Promise<RangeReport> {
  return request<RangeReport>("/market-data/load-range", {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });
}

function historyQuery(filters: HistoryFiltersValue, limit: number, offset: number): string {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.domain) params.set("domain", filters.domain);
  if (filters.source) params.set("source", filters.source);
  if (filters.status) params.set("status", filters.status);
  if (filters.entry_type) params.set("entry_type", filters.entry_type);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return params.toString();
}

/** Loads one page of history. */
export function fetchHistory(
  filters: HistoryFiltersValue,
  limit = 50,
  offset = 0,
  signal?: AbortSignal,
): Promise<HistoryPage> {
  return request<HistoryPage>(`/data-load/history?${historyQuery(filters, limit, offset)}`, {
    signal,
  });
}

/** Loads one history entry's full detail. */
export function fetchHistoryDetail(
  entryId: string,
  signal?: AbortSignal,
): Promise<HistoryDetail> {
  return request<HistoryDetail>(`/data-load/history/${encodeURIComponent(entryId)}`, {
    signal,
  });
}

/** Loads a range group's progress. */
export function fetchProgress(
  groupId: string,
  signal?: AbortSignal,
): Promise<RangeProgress> {
  return request<RangeProgress>(
    `/data-load/history/groups/${encodeURIComponent(groupId)}/progress`,
    { signal },
  );
}
