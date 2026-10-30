import { API_BASE_URL } from "./config";
import type {
  ApiErrorEnvelope,
  AssetSearchResponse,
  SeriesResponseWire,
} from "../types/dashboard";

/** A normalized dashboard request error with a stable code. */
export class DashboardApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;

  constructor(
    status: number,
    code: string,
    message: string,
    retryable = false,
  ) {
    super(message);
    this.name = "DashboardApiError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

async function requestJson<T>(
  path: string,
  options: { signal: AbortSignal },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      signal: options.signal,
      headers: { accept: "application/json" },
    });
  } catch (caught) {
    if (options.signal.aborted) throw caught;
    throw new DashboardApiError(
      0,
      "network",
      "The market data service could not be reached.",
      true,
    );
  }
  if (!response.ok) {
    let code = "request_failed";
    let message = `Request failed with status ${response.status}.`;
    try {
      const envelope = (await response.json()) as ApiErrorEnvelope;
      if (envelope.error?.code) code = envelope.error.code;
      if (envelope.error?.message) message = envelope.error.message;
    } catch {
      // Keep the generic message when the body is not JSON.
    }
    throw new DashboardApiError(
      response.status,
      code,
      message,
      response.status >= 500,
    );
  }
  return (await response.json()) as T;
}

/** Searches assets for the instrument picker. */
export function searchAssets(
  query: string,
  options: { signal: AbortSignal; limit?: number },
): Promise<AssetSearchResponse> {
  const limit = options.limit ?? 20;
  const params = new URLSearchParams({ limit: String(limit) });
  if (query.trim()) params.set("q", query.trim());
  return requestJson<AssetSearchResponse>(`/assets?${params.toString()}`, options);
}

/** Reads one page of a resolved daily series. */
export function loadSeriesPage(
  assetId: string,
  params: { from: string; to: string; limit?: number; cursor?: string | null },
  options: { signal: AbortSignal },
): Promise<SeriesResponseWire> {
  const search = new URLSearchParams({
    from: params.from,
    to: params.to,
    limit: String(params.limit ?? 5_000),
  });
  if (params.cursor) search.set("cursor", params.cursor);
  return requestJson<SeriesResponseWire>(
    `/domain/assets/${encodeURIComponent(assetId)}/facts/market_price/series?${search.toString()}`,
    options,
  );
}
