import type { QueryKey } from "@tanstack/react-query";
import type { DateRange } from "lx_client/js/components/Dashboard/types";
import {
  fetchAssetOptions,
  type AssetSearchApi,
} from "../pages/dashboard/fetchAssetOptions";
import {
  fetchDailyBars,
  type SeriesApi,
} from "../pages/dashboard/fetchDailyBars";
import { normalizeSearchQuery, queryKeys } from "./keys";

const SEARCH_STALE_MS = 300_000;
const SEARCH_GC_MS = 600_000;
const SERIES_STALE_MS = 300_000;
const SERIES_GC_MS = 900_000;

/** Plain cache options consumed by the promise bridge. */
export interface DashboardQueryOptions<TData> {
  queryKey: QueryKey;
  queryFn: (context: { signal: AbortSignal }) => Promise<TData>;
  staleTime: number;
  gcTime: number;
}

/** Cache options for one asset search. */
export function assetSearchQueryOptions(
  api: AssetSearchApi,
  query: string,
  limit = 20,
): DashboardQueryOptions<Awaited<ReturnType<typeof fetchAssetOptions>>> {
  const normalized = normalizeSearchQuery(query);
  return {
    queryKey: queryKeys.assets.search(normalized, limit),
    queryFn: ({ signal }) =>
      fetchAssetOptions(api, normalized, { signal, limit }),
    staleTime: SEARCH_STALE_MS,
    gcTime: SEARCH_GC_MS,
  };
}

/** Cache options for one logical daily-price series. */
export function marketSeriesQueryOptions(
  api: SeriesApi,
  assetId: string,
  range: DateRange,
): DashboardQueryOptions<Awaited<ReturnType<typeof fetchDailyBars>>> {
  return {
    queryKey: queryKeys.marketSeries.detail(assetId, range.from, range.to),
    queryFn: ({ signal }) => fetchDailyBars(api, assetId, range, { signal }),
    staleTime: SERIES_STALE_MS,
    gcTime: SERIES_GC_MS,
  };
}
