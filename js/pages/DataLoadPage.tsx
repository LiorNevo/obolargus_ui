import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { usePageTitle } from "lx_client/js/navigation/usePageTitle";
import Loading from "lx_client/js/components/Loading";
import { Button } from "lx_client/js/components/Button";
import { Skeleton } from "lx_client/js/components/Skeleton";
import type {
  DomainEntry,
  HistoryFiltersValue,
  LoadReport as LoadReportType,
  ParsedIdentifier,
  RangeProgress,
  RangeReport as RangeReportType,
  SourceCatalogEntry,
} from "../types/dataLoad";
import { DataLoadApiError } from "../api/dataLoad";
import {
  OfflineUnavailableError,
  normalizeOfflineError,
} from "../offline/errors";
import { LastUpdatedLabel } from "../offline/LastUpdatedLabel";
import { useOfflineStore } from "../offline/offlineStore";
import { useDataLoadStore } from "../store/dataLoadStore";
import {
  historyDetailQueryOptions,
  useDomainsQuery,
  useHistoryDetailQuery,
  useHistoryQuery,
  useSourcesQuery,
} from "../query/dataLoadQueries";
import { useRangeProgressQuery } from "../query/progressQueries";
import {
  useLoadOnceMutation,
  useStartRangeLoadMutation,
  useStopRangeLoadMutation,
  useToggleSourceMutation,
} from "../query/mutations";
import {
  invalidateAfterLoad,
  invalidateAfterProgressTerminal,
} from "../query/invalidation";
import { normalizeHistoryFilters, queryKeys } from "../query/keys";
import { IdentifierBatchInput } from "./data-load/IdentifierBatchInput";
import { IdentifierSearch } from "./data-load/IdentifierSearch";
import { appendIdentifiersToDraft } from "./data-load/searchSelection";
import { LoadForm, validateDraft } from "./data-load/LoadForm";
import { LoadReport } from "./data-load/LoadReport";
import { RangeReport } from "./data-load/RangeReport";
import { SourceCatalog } from "./data-load/SourceCatalog";
import { HistoryPanel } from "./data-load/HistoryPanel";
import { HistoryDetail } from "./data-load/HistoryDetail";
import { rangeReportFromDetail } from "./data-load/reportFromDetail";
import "./data-load/data-load.css";

const FALLBACK_DOMAINS: DomainEntry[] = [
  {
    id: "market_data",
    label: "Market & reference data",
    loadable: true,
    unavailable_reason: null,
  },
  {
    id: "holdings",
    label: "Holdings",
    loadable: false,
    unavailable_reason: "Holdings loading is not available in this release.",
  },
];

const TERMINAL_PROGRESS_STATUSES: ReadonlySet<RangeProgress["status"]> =
  new Set(["complete", "partial", "failed"]);

function newGroupId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0").slice(0, 12)}`;
}

function isRangeReport(
  report: LoadReportType | RangeReportType,
): report is RangeReportType {
  return "dates" in report && Array.isArray((report as RangeReportType).dates);
}

function requestMessage(error: unknown): string {
  const normalized = normalizeOfflineError(error);
  if (normalized instanceof OfflineUnavailableError) return normalized.message;
  if (normalized instanceof DataLoadApiError) return normalized.message;
  if (normalized instanceof Error) return normalized.message;
  return "The request failed.";
}

/** Filter state derived from the URL. */
function filtersFromSearch(params: URLSearchParams): HistoryFiltersValue {
  const page = Number(params.get("page") ?? "1");
  return {
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    domain: params.get("domain") ?? undefined,
    source: params.get("source") ?? undefined,
    status: params.get("status") ?? undefined,
    entry_type: params.get("entry_type") ?? undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    selected: params.get("selected") ?? undefined,
  };
}

interface LoadPanelProps {
  domains: DomainEntry[];
  sources: SourceCatalogEntry[];
  errors: Record<string, string[]>;
  running: boolean;
  catalogError: string | null;
  domainsLoading: boolean;
  catalogLoading: boolean;
  onSubmit: () => void;
}

/**
 * Draft-backed load panel. Subscribing to the draft here keeps date and
 * identifier edits local: the page shell and the data tables do not re-render.
 */
function LoadPanel({
  domains,
  sources,
  errors,
  running,
  catalogError,
  domainsLoading,
  catalogLoading,
  onSubmit,
}: LoadPanelProps) {
  const draft = useDataLoadStore((state) => state.draft);
  const setDraft = useDataLoadStore((state) => state.setDraft);
  const handleIdentifierChange = useCallback(
    (text: string, identifiers: ParsedIdentifier[]) => {
      setDraft({ identifierText: text, identifiers });
    },
    [setDraft],
  );
  const handleAddIdentifiers = useCallback(
    (additions: ParsedIdentifier[]) => {
      const current = useDataLoadStore.getState().draft;
      const result = appendIdentifiersToDraft(current, additions);
      setDraft({
        identifierText: result.text,
        identifiers: result.identifiers,
      });
      return { added: result.added.length, skipped: result.skipped };
    },
    [setDraft],
  );
  const handleToggleCreateMissing = useCallback(
    (checked: boolean) => setDraft({ createMissingAssets: checked }),
    [setDraft],
  );

  return (
    <div className="obolargus_panel obolargus_load_panel">
      <IdentifierSearch
        draft={draft}
        sources={sources}
        onAddIdentifiers={handleAddIdentifiers}
        onToggleCreateMissing={handleToggleCreateMissing}
      />
      <IdentifierBatchInput
        text={draft.identifierText}
        identifiers={draft.identifiers}
        errors={errors.identifiers}
        onChange={handleIdentifierChange}
      />
      <LoadForm
        draft={draft}
        domains={domains}
        sources={sources}
        errors={errors}
        running={running}
        catalogError={catalogError}
        domainsLoading={domainsLoading}
        catalogLoading={catalogLoading}
        onChange={setDraft}
        onSubmit={onSubmit}
      />
    </div>
  );
}

/**
 * Data Load page: compose a load, inspect the report, control sources, and
 * browse durable history.
 */
export function DataLoadPage() {
  usePageTitle("Data Load");
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(
    () => filtersFromSearch(searchParams),
    [searchParams],
  );

  const domain = useDataLoadStore((state) => state.draft.domain);
  const lastReport = useDataLoadStore((state) => state.lastReport);
  const inFlightRange = useDataLoadStore((state) => state.inFlightRange);
  const setLastReport = useDataLoadStore((state) => state.setLastReport);
  const setInFlightRange = useDataLoadStore((state) => state.setInFlightRange);
  const reset = useDataLoadStore((state) => state.reset);

  const domainsQuery = useDomainsQuery();
  const sourcesQuery = useSourcesQuery(domain);
  const historyPageNumber = filters.page ?? 1;
  const historyQuery = useHistoryQuery(
    filters,
    50,
    (historyPageNumber - 1) * 50,
  );

  const [restoredDetailId, setRestoredDetailId] = useState<string | null>(null);
  const detailEntryId = filters.selected ?? restoredDetailId ?? undefined;
  const detailQuery = useHistoryDetailQuery(detailEntryId);
  const progressQuery = useRangeProgressQuery(inFlightRange?.groupId ?? null);
  const online = useOfflineStore((state) => state.status.state === "online");
  const historyOffset = (historyPageNumber - 1) * 50;
  const historyKey = useMemo(
    () =>
      queryKeys.dataLoad.historyList(
        normalizeHistoryFilters(filters),
        50,
        historyOffset,
      ),
    [filters, historyOffset],
  );
  const loadOnceMutation = useLoadOnceMutation();
  const startRangeLoadMutation = useStartRangeLoadMutation();
  const stopRangeLoadMutation = useStopRangeLoadMutation();
  const toggleSourceMutation = useToggleSourceMutation(domain);

  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busySourceId, setBusySourceId] = useState<string | null>(null);
  const [sourceMessage, setSourceMessage] = useState<string | null>(null);
  const [returnNotice, setReturnNotice] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const restoredNoticeRef = useRef(false);
  const terminalHandledRef = useRef<string | null>(null);

  const domains = domainsQuery.data?.domains ?? FALLBACK_DOMAINS;
  const domainsLoading = domainsQuery.isPending;
  const sources = sourcesQuery.data?.sources ?? [];
  const catalogLoading = sourcesQuery.isPending;
  const catalogRefreshing =
    sourcesQuery.isFetching && sourcesQuery.data !== undefined;
  const catalogFailure = sourcesQuery.error ?? sourcesQuery.failureReason;
  const catalogError = catalogFailure
    ? requestMessage(catalogFailure)
    : null;

  const historyPage = historyQuery.data ?? null;
  const historyLoading = historyQuery.isPending;
  const historyRefreshing =
    historyQuery.isFetching && historyQuery.data !== undefined;
  const historyFailure = historyQuery.error ?? historyQuery.failureReason;
  const historyError = historyFailure
    ? requestMessage(historyFailure)
    : null;

  const detail = detailQuery.data ?? null;
  const detailLoading = detailQuery.isPending && Boolean(detailEntryId);
  const detailError = detailQuery.error
    ? requestMessage(detailQuery.error)
    : null;
  const detailKey = queryKeys.dataLoad.historyDetail(detailEntryId ?? "");

  const progress = inFlightRange ? progressQuery.data ?? null : null;
  const isBackgroundRefresh = [
    domainsQuery,
    sourcesQuery,
    historyQuery,
    detailQuery,
  ].some((query) => query.isFetching && query.data !== undefined);

  const monitorActive = running || Boolean(inFlightRange);
  useEffect(() => {
    if (!monitorActive) return undefined;
    const started = inFlightRange?.startedAt
      ? Date.parse(inFlightRange.startedAt)
      : Date.now();
    const tick = () =>
      setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [
    monitorActive,
    inFlightRange?.groupId,
    inFlightRange?.startedAt,
  ]);

  useEffect(() => {
    restoredNoticeRef.current = false;
    terminalHandledRef.current = null;
  }, [inFlightRange?.groupId]);

  useEffect(() => {
    if (!inFlightRange) return;
    const snapshot = progressQuery.data;
    if (!snapshot) {
      if (progressQuery.isError && !restoredNoticeRef.current) {
        restoredNoticeRef.current = true;
        setReturnNotice(
          "This run may still be running on the server. Re-running is safe.",
        );
      }
      return;
    }

    if (!restoredNoticeRef.current) {
      restoredNoticeRef.current = true;
      setReturnNotice(
        TERMINAL_PROGRESS_STATUSES.has(snapshot.status)
          ? "The range run completed on the server."
          : `This run may still be running on the server (${snapshot.dates_completed} date(s) completed). Re-running is safe.`,
      );
    }

    if (
      TERMINAL_PROGRESS_STATUSES.has(snapshot.status) &&
      terminalHandledRef.current !== inFlightRange.groupId
    ) {
      const groupId = inFlightRange.groupId;
      terminalHandledRef.current = groupId;
      setRestoredDetailId(groupId);
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set("selected", groupId);
          return next;
        },
        { replace: true },
      );
      setReturnNotice("The range run completed on the server.");

      void (async () => {
        try {
          const detail = await queryClient.fetchQuery(
            historyDetailQueryOptions(groupId),
          );
          const report = rangeReportFromDetail(detail, groupId);
          if (report) {
            setLastReport({
              domain: report.data_domain,
              mode: "range",
              completedAt: new Date().toISOString(),
              groupId,
              report,
            });
            await invalidateAfterLoad(queryClient, { report, groupId });
          } else {
            await invalidateAfterProgressTerminal(queryClient, groupId);
          }
        } catch {
          setReturnNotice(
            "The run completed, but its report could not be loaded. Refresh history to try again.",
          );
          await invalidateAfterProgressTerminal(queryClient, groupId);
        } finally {
          setInFlightRange(null);
        }
      })();
    }
  }, [
    inFlightRange,
    progressQuery.data,
    progressQuery.isError,
    queryClient,
    setInFlightRange,
    setLastReport,
    setRestoredDetailId,
    setSearchParams,
  ]);

  const updateFilters = useCallback(
    (patch: Partial<HistoryFiltersValue>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === null || value === "") {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      if (!("page" in patch) && !("selected" in patch)) {
        next.set("page", "1");
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const submit = useCallback(async () => {
    if (useDataLoadStore.getState().inFlightRange) return;
    const draft = useDataLoadStore.getState().draft;
    const errors = validateDraft(draft, domains, sources);
    setValidationErrors(errors);
    setRequestError(null);
    if (Object.keys(errors).length > 0) return;
    setRunning(true);
    setElapsed(0);
    setReturnNotice(null);
    terminalHandledRef.current = null;
    const identifiers = draft.identifiers.map((identifier) => ({
      type: identifier.scheme,
      value: identifier.value,
    }));

    let rangeStarted = false;
    try {
      if (draft.mode === "single") {
        const report = await loadOnceMutation.mutateAsync({
          identifiers,
          date: draft.date,
          source: draft.sourceId,
          create_missing_assets: draft.createMissingAssets,
          data_domain: draft.domain,
        });
        setLastReport({
          domain: draft.domain,
          mode: "single",
          completedAt: new Date().toISOString(),
          groupId: null,
          report,
        });
      } else {
        const groupId = newGroupId();
        setInFlightRange({
          groupId,
          startedAt: new Date().toISOString(),
          from: draft.from,
          to: draft.to,
        });
        await startRangeLoadMutation.mutateAsync({
          identifiers,
          from: draft.from,
          to: draft.to,
          concurrency: draft.concurrency,
          source: draft.sourceId,
          create_missing_assets: draft.createMissingAssets,
          data_domain: draft.domain,
          client_group_id: groupId,
        });
        rangeStarted = true;
      }
    } catch (error) {
      setRequestError(requestMessage(error));
    } finally {
      if (!rangeStarted) setInFlightRange(null);
      setRunning(false);
    }
  }, [
    domains,
    loadOnceMutation,
    startRangeLoadMutation,
    setInFlightRange,
    setLastReport,
    sources,
  ]);

  const onToggle = useCallback(
    async (source: SourceCatalogEntry, enabled: boolean) => {
      setBusySourceId(source.source_id);
      setSourceMessage(null);
      try {
        const response = (await toggleSourceMutation.mutateAsync({
          sourceId: source.source_id,
          enabled,
        })) as {
          changed?: boolean;
          source?: SourceCatalogEntry;
          error?: { message?: string };
        };
        setSourceMessage(
          response.changed === false
            ? "The source was already in that state."
            : `Source ${enabled ? "enabled" : "disabled"} — recorded in history.`,
        );
      } catch (error) {
        setSourceMessage(requestMessage(error));
      } finally {
        setBusySourceId(null);
      }
    },
    [toggleSourceMutation],
  );

  const handleSourceRefresh = useCallback(() => {
    void sourcesQuery.refetch();
  }, [sourcesQuery]);

  const handleSelectHistory = useCallback(
    (entryId: string) => {
      setRestoredDetailId(null);
      updateFilters({ selected: entryId });
    },
    [updateFilters],
  );

  const handleHistoryPage = useCallback(
    (page: number) => updateFilters({ page }),
    [updateFilters],
  );

  const handleCloseDetail = useCallback(() => {
    setRestoredDetailId(null);
    updateFilters({ selected: undefined });
  }, [updateFilters]);

  const handleHistoryRefresh = useCallback(() => {
    void historyQuery.refetch();
  }, [historyQuery]);

  const handleStopRange = useCallback(async () => {
    if (!inFlightRange) return;
    const groupId = inFlightRange.groupId;
    setStopping(true);
    setRequestError(null);
    try {
      const result = await stopRangeLoadMutation.mutateAsync(groupId);
      setReturnNotice(
        result.stopped
          ? "Stop requested. No new dates will start; in-flight dates are allowed to finish."
          : "This run is not active on the server (for example after a restart). Dismissed it locally.",
      );
      setInFlightRange(null);
      setRestoredDetailId(null);
      void historyQuery.refetch();
    } catch (error) {
      setRequestError(requestMessage(error));
    } finally {
      setStopping(false);
    }
  }, [
    historyQuery,
    inFlightRange,
    setInFlightRange,
    stopRangeLoadMutation,
  ]);

  const handleReset = useCallback(() => {
    if (window.confirm("Clear the draft and the last report?")) reset();
  }, [reset]);

  const report = lastReport?.report ?? null;

  return (
    <div className="obolargus_data_load_page">
      <header className="obolargus_page_header">
        <h1>Data Load</h1>
        <p>
          Load market/reference data on demand from a configured upstream source.
          Every run is recorded in the system of record.
        </p>
      </header>
      <div className="obolargus_read_status_row">
        <LastUpdatedLabel queryKey={queryKeys.dataLoad.domains()} />
        <LastUpdatedLabel queryKey={queryKeys.dataLoad.sources(domain)} />
      </div>
      <div className="obolargus_status_region" aria-live="polite" role="status">
        {running || inFlightRange ? `Running… ${elapsed}s` : null}
        {progress
          ? ` ${progress.status} — ${progress.dates_completed} of ${
              progress.dates_requested ?? "?"
            } date(s) completed.`
          : inFlightRange
            ? " Starting — waiting for the first date."
            : null}
        {progress && !online ? " Last known progress — not live." : null}
        {isBackgroundRefresh ? " Refreshing data…" : null}
        {returnNotice}
        {sourceMessage}
      </div>
      {requestError && (
        <div className="obolargus_alert" role="alert">
          <p>Load failed: {requestError}</p>
          <Button type="button" onClick={submit}>
            Retry
          </Button>
        </div>
      )}

      <div className="obolargus_data_load_grid">
        <LoadPanel
          domains={domains}
          sources={sources}
          errors={validationErrors}
          running={running || Boolean(inFlightRange)}
          catalogError={catalogError}
          domainsLoading={domainsLoading}
          catalogLoading={catalogLoading}
          onSubmit={submit}
        />

        <div className="obolargus_panel obolargus_sources_panel">
          <SourceCatalog
            sources={sources}
            busySourceId={busySourceId}
            loading={catalogLoading}
            refreshing={catalogRefreshing}
            onRefresh={handleSourceRefresh}
            onToggle={onToggle}
          />
        </div>
      </div>

      {inFlightRange ? (
        <div
          className="obolargus_panel obolargus_report_panel obolargus_run_monitor"
          aria-busy="true"
        >
          <h2>Run monitor</h2>
          <dl className="obolargus_report_summary">
            <dt>Group ID</dt>
            <dd>{inFlightRange.groupId}</dd>
            <dt>Range</dt>
            <dd>
              {inFlightRange.from} to {inFlightRange.to}
            </dd>
            <dt>Status</dt>
            <dd>{progress?.status ?? "starting"}</dd>
            <dt>Dates completed</dt>
            <dd>
              {progress?.dates_completed ?? 0} /{" "}
              {progress?.dates_requested ?? "?"}
            </dd>
            <dt>Dates failed</dt>
            <dd>{progress?.dates_failed ?? 0}</dd>
            <dt>Dates with loads</dt>
            <dd>{progress?.dates_with_loads ?? 0}</dd>
            <dt>Started</dt>
            <dd>{inFlightRange.startedAt}</dd>
            <dt>Last update</dt>
            <dd>{progress?.updated_at ?? "waiting for the first date"}</dd>
            <dt>Elapsed</dt>
            <dd>{elapsed}s</dd>
          </dl>
          <p className="obolargus_form_note">
            Polling every 2 seconds. The run continues on the server if you
            leave this page.
          </p>
          <p className="obolargus_form_note">
            If the services were restarted, this run is no longer active. Use
            Stop run to dismiss it.
          </p>
          {progress && !online ? (
            <p className="obolargus_form_note">
              Last known progress — not live.
            </p>
          ) : null}
          <div className="obolargus_form_actions">
            <Button
              type="button"
              variant="danger"
              onClick={handleStopRange}
              disabled={stopping}
            >
              {stopping ? "Stopping…" : "Stop run"}
            </Button>
          </div>
        </div>
      ) : running ? (
        <div
          className="obolargus_panel obolargus_report_panel obolargus_loading_block"
          aria-busy="true"
        >
          <Loading compact label={`Loading report… ${elapsed}s`} />
          <Skeleton width="30%" height="1.5rem" />
          <Skeleton lines={6} height="0.9rem" />
          <Skeleton height="9rem" />
        </div>
      ) : (
        report && (
          <div className="obolargus_panel obolargus_report_panel">
            {isRangeReport(report) ? (
              <RangeReport report={report} />
            ) : (
              <LoadReport report={report} />
            )}
            {lastReport && (
              <p className="obolargus_form_note">
                Report completed at {lastReport.completedAt}.
              </p>
            )}
          </div>
        )
      )}

      <section className="obolargus_panel obolargus_history_panel" aria-label="History area">
        <LastUpdatedLabel queryKey={historyKey} />
        <HistoryPanel
          page={historyPage}
          filters={filters}
          loading={historyLoading}
          refreshing={historyRefreshing}
          error={historyError}
          onSelect={handleSelectHistory}
          onPage={handleHistoryPage}
          onRefresh={handleHistoryRefresh}
        />
        {detailError && <p role="alert">History detail failed: {detailError}</p>}
        {detailLoading && !detail && (
          <div
            className="obolargus_history_detail obolargus_loading_block"
            aria-busy="true"
          >
            <Loading compact label="Loading history detail..." />
            <Skeleton width="35%" height="1.25rem" />
            <Skeleton lines={4} />
          </div>
        )}
        {detail && (
          <div className="obolargus_history_detail">
            <LastUpdatedLabel queryKey={detailKey} />
            <HistoryDetail detail={detail} />
            <div className="obolargus_form_actions">
              <Button type="button" onClick={handleCloseDetail}>
                Close detail
              </Button>
            </div>
          </div>
        )}
      </section>

      <div className="obolargus_page_actions">
        <Button
          type="button"
          variant="danger"
          onClick={handleReset}
        >
          Reset draft and report
        </Button>
      </div>
    </div>
  );
}

export default DataLoadPage;
