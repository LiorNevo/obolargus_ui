import type { HistoryFiltersValue } from "../types/dataLoad";

/** The list-request parameters that identify one history page. */
export interface NormalizedHistoryFilters {
  from: string | null;
  to: string | null;
  domain: string | null;
  source: string | null;
  status: string | null;
  entry_type: string | null;
}

/** Removes URL-only state and writes absent filters as null. */
export function normalizeHistoryFilters(
  filters: HistoryFiltersValue,
): NormalizedHistoryFilters {
  return {
    from: filters.from ?? null,
    to: filters.to ?? null,
    domain: filters.domain ?? null,
    source: filters.source ?? null,
    status: filters.status ?? null,
    entry_type: filters.entry_type ?? null,
  };
}

/** Trims and collapses insignificant whitespace without changing casing. */
export function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

/**
 * Central registry of every cached read identity.
 *
 * Pages and API modules must not build key arrays directly. Prefix helpers are
 * used by invalidation so a list and its detail entries refresh together.
 */
export const queryKeys = {
  health: () => ["health"] as const,

  assets: {
    search: (query: string, limit: number) =>
      ["assets", "search", { query, limit }] as const,
    allSearches: () => ["assets", "search"] as const,
  },

  marketSeries: {
    detail: (assetId: string, from: string, to: string) =>
      ["market-series", assetId, { from, to }] as const,
    forAsset: (assetId: string) => ["market-series", assetId] as const,
    all: () => ["market-series"] as const,
  },

  dataLoad: {
    domains: () => ["data-load", "domains"] as const,
    sources: (domain: string | null) =>
      ["data-load", "sources", domain] as const,
    allSources: () => ["data-load", "sources"] as const,
    historyList: (
      filters: NormalizedHistoryFilters,
      limit: number,
      offset: number,
    ) =>
      [
        "data-load",
        "history",
        "list",
        filters,
        { limit, offset },
      ] as const,
    historyDetail: (entryId: string) =>
      ["data-load", "history", "detail", entryId] as const,
    allHistory: () => ["data-load", "history"] as const,
    progress: (groupId: string) =>
      ["data-load", "progress", groupId] as const,
    allProgress: () => ["data-load", "progress"] as const,
  },
};
