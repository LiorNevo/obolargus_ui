import { queryOptions, useQuery } from "@tanstack/react-query";
import {
  fetchDomains,
  fetchHistory,
  fetchHistoryDetail,
  fetchSources,
} from "../api/dataLoad";
import type {
  DataDomainId,
  HistoryFiltersValue,
} from "../types/dataLoad";
import { normalizeHistoryFilters, queryKeys } from "./keys";

const CATALOG_STALE_MS = 60_000;
const CATALOG_GC_MS = 600_000;
const HISTORY_STALE_MS = 30_000;
const HISTORY_GC_MS = 600_000;

/** Cache options for the data-domain catalog. */
export function domainsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.dataLoad.domains(),
    queryFn: ({ signal }) => fetchDomains(signal),
    staleTime: CATALOG_STALE_MS,
    gcTime: CATALOG_GC_MS,
  });
}

/** Cache options for one domain's source catalog. */
export function sourcesQueryOptions(domain: DataDomainId) {
  return queryOptions({
    queryKey: queryKeys.dataLoad.sources(domain),
    queryFn: ({ signal }) => fetchSources(domain, signal),
    staleTime: CATALOG_STALE_MS,
    gcTime: CATALOG_GC_MS,
  });
}

/** Cache options for one filtered history page. */
export function historyQueryOptions(
  filters: HistoryFiltersValue,
  limit: number,
  offset: number,
) {
  return queryOptions({
    queryKey: queryKeys.dataLoad.historyList(
      normalizeHistoryFilters(filters),
      limit,
      offset,
    ),
    queryFn: ({ signal }) => fetchHistory(filters, limit, offset, signal),
    staleTime: HISTORY_STALE_MS,
    gcTime: HISTORY_GC_MS,
  });
}

/** Cache options for one history entry's detail. */
export function historyDetailQueryOptions(entryId: string | undefined) {
  return queryOptions({
    queryKey: queryKeys.dataLoad.historyDetail(entryId ?? ""),
    queryFn: ({ signal }) => {
      if (!entryId) {
        throw new Error("History detail requires an entry id.");
      }
      return fetchHistoryDetail(entryId, signal);
    },
    staleTime: HISTORY_STALE_MS,
    gcTime: HISTORY_GC_MS,
  });
}

/** Reads the declared data domains through the shared cache. */
export function useDomainsQuery() {
  return useQuery(domainsQueryOptions());
}

/** Reads the configured sources for one domain through the shared cache. */
export function useSourcesQuery(domain: DataDomainId) {
  return useQuery(sourcesQueryOptions(domain));
}

/** Reads one history page through the shared cache. */
export function useHistoryQuery(
  filters: HistoryFiltersValue,
  limit: number,
  offset: number,
) {
  return useQuery(historyQueryOptions(filters, limit, offset));
}

/** Reads one history entry's detail through the shared cache. */
export function useHistoryDetailQuery(entryId: string | undefined) {
  return useQuery({
    ...historyDetailQueryOptions(entryId),
    enabled: Boolean(entryId),
  });
}
