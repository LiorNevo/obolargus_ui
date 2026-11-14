import { API_BASE_URL } from "./config";
import type { HistoryLoadWire, RefreshWire } from "../types/chart";

interface RequestOptions {
  signal: AbortSignal;
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  options: RequestOptions,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: options.signal,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch (caught) {
    if (options.signal.aborted) throw caught;
    throw new Error("The market data service could not be reached.", {
      cause: caught,
    });
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}.`);
  }
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
