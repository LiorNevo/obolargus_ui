import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePageTitle } from "lx_client/js/navigation/usePageTitle";
import Loading from "lx_client/js/components/Loading";
import { Button } from "lx_client/js/components/Button";
import { Skeleton } from "lx_client/js/components/Skeleton";
import type {
  DataDomainId,
  DomainEntry,
  HistoryDetail as HistoryDetailType,
  HistoryFiltersValue,
  HistoryPage,
  LoadReport as LoadReportType,
  ParsedIdentifier,
  PersistedReport,
  RangeProgress,
  RangeReport as RangeReportType,
  SourceCatalogEntry,
} from "../types/dataLoad";
import {
  DataLoadApiError,
  fetchDomains,
  fetchHistory,
  fetchHistoryDetail,
  fetchProgress,
  fetchSources,
  loadOnce,
  loadRange,
  toggleSource,
} from "../api/dataLoad";
import { useDataLoadStore } from "../store/dataLoadStore";
import { IdentifierBatchInput } from "./data-load/IdentifierBatchInput";
import { LoadForm, validateDraft } from "./data-load/LoadForm";
import { LoadReport } from "./data-load/LoadReport";
import { RangeReport } from "./data-load/RangeReport";
import { SourceCatalog } from "./data-load/SourceCatalog";
import { HistoryFilters } from "./data-load/HistoryFilters";
import { HistoryPanel } from "./data-load/HistoryPanel";
import { HistoryDetail } from "./data-load/HistoryDetail";
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
  if (error instanceof DataLoadApiError) return error.message;
  if (error instanceof Error) return error.message;
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

  return (
    <div className="obolargus_panel obolargus_load_panel">
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

  const [domains, setDomains] = useState<DomainEntry[]>(FALLBACK_DOMAINS);
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [sources, setSources] = useState<SourceCatalogEntry[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState<RangeProgress | null>(null);
  const [busySourceId, setBusySourceId] = useState<string | null>(null);
  const [sourceMessage, setSourceMessage] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState<HistoryPage | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [detail, setDetail] = useState<HistoryDetailType | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [returnNotice, setReturnNotice] = useState<string | null>(null);
  const restoredRef = useRef(false);
  const pollRef = useRef<number | null>(null);

  const loadCatalog = useCallback(
    (domain: DataDomainId) => {
      const controller = new AbortController();
      setCatalogLoading(true);
      setCatalogError(null);
      fetchSources(domain, controller.signal)
        .then((response) => setSources(response.sources))
        .catch((error) => {
          if (!controller.signal.aborted) setCatalogError(requestMessage(error));
        })
        .finally(() => {
          if (!controller.signal.aborted) setCatalogLoading(false);
        });
      return () => controller.abort();
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchDomains(controller.signal)
      .then((catalog) => setDomains(catalog.domains))
      .catch(() => {
        // The fallback catalog keeps the form usable with an honest reason.
      })
      .finally(() => {
        if (!controller.signal.aborted) setDomainsLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    return loadCatalog(domain);
  }, [domain, loadCatalog]);

  useEffect(() => {
    if (!running) return undefined;
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    const controller = new AbortController();
    setHistoryLoading(true);
    setHistoryError(null);
    const page = filters.page ?? 1;
    fetchHistory(filters, 50, (page - 1) * 50, controller.signal)
      .then(setHistoryPage)
      .catch((error) => {
        if (!controller.signal.aborted) setHistoryError(requestMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });
    return () => controller.abort();
  }, [filters]);

  useEffect(() => {
    if (!filters.selected) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setDetailError(null);
    setDetailLoading(true);
    fetchHistoryDetail(filters.selected, controller.signal)
      .then(setDetail)
      .catch((error) => {
        if (!controller.signal.aborted) setDetailError(requestMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [filters.selected]);

  useEffect(() => {
    if (restoredRef.current || running) return;
    restoredRef.current = true;
    if (!inFlightRange) return;
    fetchProgress(inFlightRange.groupId)
      .then(async (snapshot) => {
        setProgress(snapshot);
        if (["complete", "partial", "failed"].includes(snapshot.status)) {
          const entry = await fetchHistoryDetail(inFlightRange.groupId);
          setDetail(entry);
          setReturnNotice("The range run completed on the server.");
        } else {
          setReturnNotice(
            `This run may still be running on the server (${snapshot.dates_completed} date(s) completed). Re-running is safe.`,
          );
        }
      })
      .catch(() => {
        setReturnNotice(
          "This run may still be running on the server. Re-running is safe.",
        );
      });
  }, [inFlightRange, running]);

  useEffect(() => {
    return () => {
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
    };
  }, []);

  const updateFilters = useCallback(
    (patch: Partial<HistoryFiltersValue>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === null || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      if (!("page" in patch) && !("selected" in patch)) next.set("page", "1");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const submit = useCallback(async () => {
    const draft = useDataLoadStore.getState().draft;
    const errors = validateDraft(draft, domains, sources);
    setValidationErrors(errors);
    setRequestError(null);
    if (Object.keys(errors).length > 0) return;
    setRunning(true);
    setElapsed(0);
    setReturnNotice(null);
    const identifiers = draft.identifiers.map((identifier) => ({
      type: identifier.scheme,
      value: identifier.value,
    }));

    try {
      if (draft.mode === "single") {
        const report = await loadOnce({
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
        pollRef.current = window.setInterval(() => {
          fetchProgress(groupId).then(setProgress).catch(() => undefined);
        }, 2000);
        const report = await loadRange({
          identifiers,
          from: draft.from,
          to: draft.to,
          concurrency: draft.concurrency,
          source: draft.sourceId,
          create_missing_assets: draft.createMissingAssets,
          data_domain: draft.domain,
          client_group_id: groupId,
        });
        setLastReport({
          domain: draft.domain,
          mode: "range",
          completedAt: new Date().toISOString(),
          groupId,
          report,
        });
        setInFlightRange(null);
      }
    } catch (error) {
      setRequestError(requestMessage(error));
      setInFlightRange(null);
    } finally {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      setRunning(false);
      setProgress(null);
    }
  }, [domains, sources, setInFlightRange, setLastReport]);

  const onToggle = useCallback(
    async (source: SourceCatalogEntry, enabled: boolean) => {
      setBusySourceId(source.source_id);
      setSourceMessage(null);
      try {
        const response = (await toggleSource(source.source_id, enabled)) as {
          changed?: boolean;
          source?: SourceCatalogEntry;
          error?: { message?: string };
        };
        await loadCatalog(domain);
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
    [domain, loadCatalog],
  );

  const handleSourceRefresh = useCallback(() => {
    void loadCatalog(domain);
  }, [domain, loadCatalog]);

  const handleSelectHistory = useCallback(
    (entryId: string) => updateFilters({ selected: entryId }),
    [updateFilters],
  );

  const handleHistoryPage = useCallback(
    (page: number) => updateFilters({ page }),
    [updateFilters],
  );

  const handleClearFilters = useCallback(
    () => setSearchParams({}, { replace: true }),
    [setSearchParams],
  );

  const handleHistoryRefresh = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    setSearchParams(next, { replace: true });
    setHistoryLoading(true);
    fetchHistory(filters, 50, ((filters.page ?? 1) - 1) * 50)
      .then(setHistoryPage)
      .catch((error) => setHistoryError(requestMessage(error)))
      .finally(() => setHistoryLoading(false));
  }, [filters, searchParams, setSearchParams]);

  const handleCloseDetail = useCallback(
    () => updateFilters({ selected: undefined }),
    [updateFilters],
  );

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
      <div className="obolargus_status_region" aria-live="polite" role="status">
        {running ? `Loading… ${elapsed}s` : null}
        {progress
          ? ` Date ${progress.dates_completed} of ${progress.dates_requested ?? "?"}.`
          : null}
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
          running={running}
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
            onRefresh={handleSourceRefresh}
            onToggle={onToggle}
          />
        </div>
      </div>

      {running ? (
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
        <HistoryFilters
          filters={filters}
          onChange={updateFilters}
          onClear={handleClearFilters}
        />
        <HistoryPanel
          page={historyPage}
          filters={filters}
          loading={historyLoading}
          error={historyError}
          onSelect={handleSelectHistory}
          onPage={handleHistoryPage}
          onRefresh={handleHistoryRefresh}
          onClearFilters={handleClearFilters}
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
            <HistoryDetail detail={detail} />
            <div className="obolargus_form_actions">
              <Button
                type="button"
                onClick={handleCloseDetail}
              >
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
