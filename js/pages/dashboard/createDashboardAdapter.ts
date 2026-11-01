import type { QueryClient } from "@tanstack/react-query";
import type {
  AssetOption,
  DailyBarSeries,
  DashboardDataAdapter,
  DateRange,
} from "lx_client/js/components/Dashboard/types";
import { loadSeriesPage, searchAssets } from "../../api/dashboard";
import { readThroughCache } from "../../query/dashboardCache";
import {
  assetSearchQueryOptions,
  marketSeriesQueryOptions,
} from "../../query/dashboardQueries";
import type { AssetSearchApi } from "./fetchAssetOptions";
import type { SeriesApi } from "./fetchDailyBars";

/** The dashboard transport seam; tests inject a mock implementation. */
export type DashboardApi = AssetSearchApi & SeriesApi;

const defaultApi: DashboardApi = { searchAssets, loadSeriesPage };

/**
 * Builds the dashboard adapter over the shared query cache.
 *
 * `lx_client` still sees the same promise-based adapter; this function only
 * decides where the data comes from and when the network is contacted.
 */
export function createDashboardAdapter(
  queryClient: QueryClient,
  api: DashboardApi = defaultApi,
): DashboardDataAdapter {
  return {
    searchAssets(
      query: string,
      options: { signal: AbortSignal; limit?: number },
    ): Promise<AssetOption[]> {
      return readThroughCache(
        queryClient,
        assetSearchQueryOptions(api, query, options.limit ?? 20),
        options.signal,
      );
    },

    loadDailyBars(
      assetId: string,
      range: DateRange,
      options: { signal: AbortSignal },
    ): Promise<DailyBarSeries> {
      return readThroughCache(
        queryClient,
        marketSeriesQueryOptions(api, assetId, range),
        options.signal,
      );
    },
  };
}
