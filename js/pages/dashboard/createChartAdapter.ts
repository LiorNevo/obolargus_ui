import type { QueryClient } from "@tanstack/react-query";
import type {
  ChartCreateAndLoadRequest,
  ChartCreateAndLoadResult,
  ChartDataAdapter,
  ChartCoverage,
  ChartHistoryLoadRequest,
  ChartHistoryLoadResult,
  ChartRefreshResult,
  DateRange,
  InstrumentSearchCandidate,
  InstrumentSearchParams,
  InstrumentSearchResult,
} from "lx_client/js/components/Dashboard/types";
import {
  DashboardDataError,
} from "lx_client/js/components/Dashboard/types";
import { fetchIdentifierSearch, loadOnce } from "../../api/dataLoad";
import { historyLoad, loadCoverage, refreshAsset } from "../../api/chart";
import { loadSeriesPage } from "../../api/dashboard";
import { assertOnlineForWrite } from "../../offline/assertOnlineForWrite";
import { readThroughCache } from "../../query/dashboardCache";
import { marketCoverageQueryOptions } from "../../query/dashboardQueries";
import {
  invalidateAfterHistoryLoad,
  invalidateAfterLoad,
} from "../../query/invalidation";
import type {
  IdentifierSearchResponse,
  SearchCandidate,
} from "../../types/dataLoad";

const HISTORY_WINDOW_DAYS = 366;

export interface ChartApi {
  searchIdentifiers: typeof fetchIdentifierSearch;
  loadOnce: typeof loadOnce;
  historyLoad: typeof historyLoad;
  loadCoverage?: typeof loadCoverage;
  refreshAsset: typeof refreshAsset;
  loadSeriesPage: typeof loadSeriesPage;
}

const defaultApi: ChartApi = {
  searchIdentifiers: fetchIdentifierSearch,
  loadOnce,
  historyLoad,
  loadCoverage,
  refreshAsset,
  loadSeriesPage,
};

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const parsed = parseDate(date);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return iso(parsed);
}

function splitWindows(
  from: string,
  to: string,
  maximumDays = HISTORY_WINDOW_DAYS,
): Array<{ from: string; to: string }> {
  if (from > to) return [];
  const windows: Array<{ from: string; to: string }> = [];
  let cursor = from;
  while (cursor <= to) {
    const proposed = addDays(cursor, maximumDays - 1);
    const windowTo = proposed > to ? to : proposed;
    windows.push({ from: cursor, to: windowTo });
    cursor = addDays(windowTo, 1);
  }
  return windows;
}

function candidateKey(candidate: SearchCandidate): string {
  const venue = candidate.venue_mic ?? candidate.exchange ?? "";
  return `${candidate.symbol}\u0000${venue}\u0000${candidate.asset_type ?? ""}`;
}

function mapCandidate(candidate: SearchCandidate): InstrumentSearchCandidate {
  return {
    key: candidateKey(candidate),
    symbol: candidate.symbol,
    displayName: candidate.display_name,
    assetType: candidate.asset_type,
    exchange: candidate.exchange,
    venueMic: candidate.venue_mic,
    currency: candidate.currency,
    sources: candidate.sources.map((source) => ({
      sourceId: source.source_id,
      displayName: source.display_name,
      relevance: source.relevance,
    })),
    identifiers: candidate.identifiers.map((identifier) => ({
      scheme: identifier.scheme,
      value: identifier.value,
      label: identifier.label,
      primary: identifier.primary,
      addable: identifier.addable,
      creatable: identifier.creatable,
      reason: identifier.reason,
    })),
    knownAssetId: candidate.known?.asset_id ?? null,
    knownDisplayName: candidate.known?.display_name ?? null,
    knownIdentifier: candidate.known
      ? `${candidate.known.matched_scheme}:${candidate.known.matched_value}`
      : null,
    creatable: candidate.creatable,
    blockedReason:
      candidate.creation_blocked_reason ?? candidate.not_addable_reason ?? null,
  };
}

function mapSearch(response: IdentifierSearchResponse): InstrumentSearchResult {
  return {
    outcome: response.outcome,
    candidates: response.results.map(mapCandidate),
    total: response.total,
    offset: response.offset,
    limit: response.limit,
    sources: response.sources.map((source) => ({
      sourceId: source.source_id,
      displayName: source.display_name,
      status: source.status,
      message: source.message,
    })),
    message: response.message,
  };
}

function mapHistory(
  wire: Awaited<ReturnType<ChartApi["historyLoad"]>>,
): ChartHistoryLoadResult {
  return {
    status: wire.status,
    sourceId: wire.source_id,
    loaded: wire.loaded,
    noOp: wire.no_op,
    expectedSessions: wire.expected_sessions,
    closedSessions: wire.closed_sessions,
    unexpectedSessions: wire.unexpected_sessions,
    calendarMic: wire.calendar_mic,
    noData: wire.no_data,
    sourceUnavailable: wire.source_unavailable,
    rateLimited: wire.rate_limited,
    rejected: wire.rejected,
    storageFailure: wire.storage_failure,
    durationMs: wire.duration_ms,
    message: wire.message,
  };
}

function failureMessage(history: ChartHistoryLoadResult): string {
  if (history.message) return history.message;
  if (history.rateLimited > 0) return "The data source rate-limited the history request.";
  if (history.rejected > 0) return "The data source refused the history request.";
  if (history.storageFailure > 0) return "The history data could not be stored.";
  return "The history data could not be loaded.";
}

/** Builds the chart capabilities over HTTP and the shared query cache. */
export function createChartAdapter(
  queryClient: QueryClient,
  api: ChartApi = defaultApi,
): ChartDataAdapter {
  const historyInFlight = new Map<string, Promise<ChartHistoryLoadResult>>();
  const creationInFlight = new Map<string, Promise<ChartCreateAndLoadResult>>();
  const refreshInFlight = new Map<string, Promise<ChartRefreshResult>>();

  const adapter: ChartDataAdapter = {
    async searchInstruments(
      params: InstrumentSearchParams,
      options: { signal: AbortSignal },
    ): Promise<InstrumentSearchResult> {
      const response = await api.searchIdentifiers(
        {
          q: params.q,
          domain: "market_data",
          source: params.source,
          asset_type: params.assetType,
          exchange: params.exchange,
          limit: params.limit ?? 25,
          offset: params.offset ?? 0,
        },
        options.signal,
      );
      return mapSearch(response);
    },

    loadHistory(
      request: ChartHistoryLoadRequest,
      options,
    ): Promise<ChartHistoryLoadResult> {
      assertOnlineForWrite();
      const key = `${request.assetId}|${request.from}|${request.to}|${request.source ?? ""}`;
      const existing = historyInFlight.get(key);
      if (existing) return existing;
      const promise = (async () => {
        try {
          const wire = await api.historyLoad(
            {
              asset_id: request.assetId,
              from: request.from,
              to: request.to,
              source: request.source ?? null,
            },
            { signal: options.signal },
          );
          const mapped = mapHistory(wire);
          await invalidateAfterHistoryLoad(queryClient, request.assetId);
          return mapped;
        } catch (caught) {
          const error =
            caught instanceof Error
              ? caught
              : new Error("The history data could not be loaded.");
          throw new DashboardDataError(error.message, {
            code: "history_load_failed",
            retryable: true,
          });
        } finally {
          historyInFlight.delete(key);
        }
      })();
      historyInFlight.set(key, promise);
      return promise;
    },

    createAndLoadInstrument(
      request: ChartCreateAndLoadRequest,
      options,
    ): Promise<ChartCreateAndLoadResult> {
      assertOnlineForWrite();
      const key = `${request.identifier.scheme}:${request.identifier.value}|${request.from}|${request.to}`;
      const existing = creationInFlight.get(key);
      if (existing) return existing;
      const promise = (async () => {
        try {
          options.onPhase?.("creating_instrument");
          const report = await api.loadOnce(
            {
              identifiers: [
                {
                  type: request.identifier.scheme,
                  value: request.identifier.value,
                },
              ],
              date: request.from,
              source: request.source ?? null,
              create_missing_assets: true,
              data_domain: "market_data",
            },
            options.signal,
          );
          const line = report.identifiers.find(
            (outcome) =>
              outcome.identifier.scheme === request.identifier.scheme &&
              outcome.identifier.value === request.identifier.value,
          );
          const assetId = line?.asset_id;
          if (!assetId) {
            throw new DashboardDataError(
              line
                ? `The instrument could not be created (${line.outcome}).`
                : "The instrument could not be resolved.",
              { code: line?.outcome ?? "not_resolved", retryable: false },
            );
          }
          await invalidateAfterLoad(queryClient, { report });
          const windows = splitWindows(request.from, request.to);
          let loaded = 0;
          let noOp = 0;
          let noData = false;
          let sourceId: string | null = null;
          let durationMs = 0;
          let windowsLoaded = 0;
          for (const window of windows) {
            options.onPhase?.("loading_history");
            const wire = await api.historyLoad(
              {
                asset_id: assetId,
                from: window.from,
                to: window.to,
                source: request.source ?? null,
              },
              { signal: options.signal },
            );
            const history = mapHistory(wire);
            loaded += history.loaded;
            noOp += history.noOp;
            noData = noData || history.noData;
            sourceId = history.sourceId ?? sourceId;
            durationMs += history.durationMs;
            windowsLoaded += 1;
            if (history.status === "failed" || history.storageFailure > 0) {
              throw new DashboardDataError(
                `The instrument was created, but history could not be loaded: ${failureMessage(history)}`,
                { code: "history_load_failed", retryable: true },
              );
            }
          }
          await invalidateAfterHistoryLoad(queryClient, assetId, {
            createdAssets: true,
          });
          return {
            assetId,
            displayName: request.displayName ?? request.identifier.value,
            identifier: `${request.identifier.scheme}:${request.identifier.value}`,
            history: {
              status: "complete" as const,
              sourceId,
              loaded,
              noOp,
              noData,
              sourceUnavailable: 0,
              rateLimited: 0,
              rejected: 0,
              storageFailure: 0,
              durationMs,
              message: noData
                ? "The source returned no bars for this period."
                : null,
            },
            windowsLoaded,
            windowsTotal: windows.length,
          };
        } catch (caught) {
          if (caught instanceof DashboardDataError) throw caught;
          throw new DashboardDataError(
            caught instanceof Error
              ? caught.message
              : "The instrument could not be created and loaded.",
            { code: "instrument_load_failed", retryable: true },
          );
        } finally {
          creationInFlight.delete(key);
        }
      })();
      creationInFlight.set(key, promise);
      return promise;
    },

    refreshLatest(assetId: string, options): Promise<ChartRefreshResult> {
      assertOnlineForWrite();
      const existing = refreshInFlight.get(assetId);
      if (existing) return existing;
      const promise = (async () => {
        try {
          const summary = await api.refreshAsset(assetId, {
            signal: options.signal,
          });
          const today = new Date().toISOString().slice(0, 10);
          const page = await api.loadSeriesPage(
            assetId,
            {
              from: `${addDays(today, -7)}T00:00:00Z`,
              to: `${addDays(today, 1)}T00:00:00Z`,
              limit: 100,
            },
            { signal: options.signal },
          );
          const latest =
            page.points.at(-1)?.valid_at.slice(0, 10) ?? null;
          await invalidateAfterHistoryLoad(queryClient, assetId);
          return {
            status: (latest === null
              ? "no_data"
              : summary.assets_refreshed > 0
                ? "updated"
                : "up_to_date") as ChartRefreshResult["status"],
            latestBarDate: latest,
            lastUpdatedAt: new Date().toISOString(),
            message:
              latest === null
                ? "No bar is available for the latest session yet."
                : null,
          };
        } catch (caught) {
          throw new DashboardDataError(
            caught instanceof Error
              ? caught.message
              : "The latest data could not be refreshed.",
            { code: "refresh_failed", retryable: true },
          );
        } finally {
          refreshInFlight.delete(assetId);
        }
      })();
      refreshInFlight.set(assetId, promise);
      return promise;
    },
  };

  if (api.loadCoverage) {
    const load = api.loadCoverage;
    adapter.loadCoverage = (
      assetId: string,
      range: DateRange,
      options: { signal: AbortSignal },
    ): Promise<ChartCoverage> =>
      readThroughCache(
        queryClient,
        marketCoverageQueryOptions({ loadCoverage: load }, assetId, range),
        options.signal,
      );
  }

  return adapter;
}
