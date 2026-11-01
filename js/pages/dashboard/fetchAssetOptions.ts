import type { AssetOption } from "lx_client/js/components/Dashboard/types";
import type { AssetSearchResponse } from "../../types/dashboard";
import { toDataError } from "./toDataError";

/** The asset-search transport used by the dashboard adapter. */
export interface AssetSearchApi {
  searchAssets(
    query: string,
    options: { signal: AbortSignal; limit?: number },
  ): Promise<AssetSearchResponse>;
}

/** Reads and maps asset-search results for the dashboard picker. */
export async function fetchAssetOptions(
  api: AssetSearchApi,
  query: string,
  options: { signal: AbortSignal; limit: number },
): Promise<AssetOption[]> {
  try {
    const response = await api.searchAssets(query, options);
    return response.items.map((item) => ({
      id: item.id,
      displayName: item.display_name,
      assetType: item.asset_type,
      currency: item.currency,
      primaryIdentifier: item.primary_identifier,
    }));
  } catch (caught) {
    if (options.signal.aborted) throw caught;
    throw toDataError(caught);
  }
}
