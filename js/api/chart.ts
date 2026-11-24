import { apiFetch } from "./http";
import type { CoverageWire, HistoryLoadWire, RefreshWire } from "../types/chart";
import { readResponseMeta, type ReadMeta } from "../offline/responseProvenance";

interface RequestOptions {
  signal: AbortSignal;
  onMeta?: (meta: ReadMeta) => void;
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  options: RequestOptions,
): Promise<T> {
  let response: Response;
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  headers.set("content-type", "application/json");
  try {
    response = await apiFetch(path, {
      ...init,
      signal: options.signal,
      headers,
    });
  } catch (caught) {
    if (options.signal.aborted) throw caught;
    if (caught instanceof Error) throw caught;
    throw new Error("The market data service could not be reached.", {
      cause: caught,
    });
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}.`);
  }
  options.onMeta?.(readResponseMeta(response));
  return (await response.json()) as T;
}

/** Loads one bounded history window for an existing asset. */
export function historyLoad(
  body: { asset_id: string; from: string; to: string; source?: string | null },
  options: RequestOptions,
): Promise<HistoryLoadWire> {
  return requestJson<HistoryLoadWire>(
    "/market-data/history-load",
    { method: "POST", body: JSON.stringify(body) },
    options,
  );
}

/** Refreshes one asset's latest available bar. */
export function refreshAsset(
  assetId: string,
  options: RequestOptions,
): Promise<RefreshWire> {
  return requestJson<RefreshWire>(
    "/market-data/refresh",
    { method: "POST", body: JSON.stringify({ asset_id: assetId }) },
    options,
  );
}

/** Reads calendar-aware coverage for one asset and inclusive date range. */
export function loadCoverage(
  assetId: string,
  params: { from: string; to: string },
  options: RequestOptions,
): Promise<CoverageWire> {
  const query = new URLSearchParams({
    from: params.from,
    to: params.to,
  });
  return requestJson<CoverageWire>(
    `/market-data/assets/${assetId}/coverage?${query.toString()}`,
    { method: "GET" },
    options,
  );
}
