import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "lx_client/js/components/Button";
import { Input } from "lx_client/js/components/Input";
import type {
  CandidateIdentifier,
  DataLoadDraft,
  IdentifierSearchParams,
  ParsedIdentifier,
  SearchCandidate,
  SourceCatalogEntry,
} from "../../types/dataLoad";
import { DataLoadApiError } from "../../api/dataLoad";
import {
  OfflineUnavailableError,
  normalizeOfflineError,
} from "../../offline/errors";
import { useOfflineStore } from "../../offline/offlineStore";
import { useIdentifierSearchQuery } from "../../query/dataLoadQueries";
import { queryKeys } from "../../query/keys";
import {
  IdentifierSearchResult,
  candidateKey,
} from "./IdentifierSearchResult";
import {
  IdentifierSearchSources,
  failedSourceNames,
} from "./IdentifierSearchSources";

const MIN_QUERY_NON_WHITESPACE = 2;
const MAX_QUERY_LENGTH = 120;
const PAGE_SIZE = 25;

interface SearchFilters {
  source?: string;
  asset_type?: string;
  exchange?: string;
}

interface AddCounts {
  added: number;
  skipped: number;
}

/** Props for the read-only identifier search surface. */
export interface IdentifierSearchProps {
  /** Current draft, used for duplicate detection and creation state. */
  draft: DataLoadDraft;
  /** Configured sources, used for the source filter and eligibility. */
  sources: SourceCatalogEntry[];
  /** Appends identifiers to the draft and reports counts. */
  onAddIdentifiers: (identifiers: ParsedIdentifier[]) => AddCounts;
  /** Toggles the existing create-missing-assets opt-in. */
  onToggleCreateMissing: (checked: boolean) => void;
}

function requestMessage(error: unknown): string {
  const normalized = normalizeOfflineError(error);
  if (normalized instanceof OfflineUnavailableError) return normalized.message;
  if (normalized instanceof DataLoadApiError) return normalized.message;
  if (normalized instanceof Error) return normalized.message;
  return "The search failed.";
}

function identifierToken(identifier: CandidateIdentifier): string {
  return `${identifier.scheme}\u0000${identifier.value}`;
}

function chosenIdentifier(
  candidate: SearchCandidate,
  choices: Record<string, string>,
): CandidateIdentifier | undefined {
  const chosen = choices[candidateKey(candidate)];
  return (
    candidate.identifiers.find(
      (identifier) => identifierToken(identifier) === chosen,
    ) ??
    candidate.identifiers.find((identifier) => identifier.primary) ??
    candidate.identifiers[0]
  );
}

function supportsTickerLookup(source: SourceCatalogEntry): boolean {
  return source.supported_schemes.some(
    (scheme) => scheme === "TICKER" || scheme === "TICKER:*" || scheme === "*",
  );
}

function sameSearch(
  left: IdentifierSearchParams,
  right: IdentifierSearchParams,
): boolean {
  return (
    left.q === right.q &&
    left.domain === right.domain &&
    left.source === right.source &&
    left.asset_type === right.asset_type &&
    left.exchange === right.exchange &&
    left.limit === right.limit &&
    left.offset === right.offset
  );
}

function filterParams(filters: SearchFilters): IdentifierSearchParams {
  return {
    q: "",
    domain: "market_data",
    source: filters.source,
    asset_type: filters.asset_type,
    exchange: filters.exchange,
    limit: PAGE_SIZE,
    offset: 0,
  };
}

/** Read-only external identifier search with explicit submit and paging. */
export function IdentifierSearch({
  draft,
  sources,
  onAddIdentifiers,
  onToggleCreateMissing,
}: IdentifierSearchProps): React.ReactElement {
  const queryClient = useQueryClient();
  const online = useOfflineStore((state) => state.status.state === "online");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({});
  const [submitted, setSubmitted] = useState<IdentifierSearchParams | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const [addNotice, setAddNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [choices, setChoices] = useState<Record<string, string>>({});

  const activeParams = submitted ?? { ...filterParams(filters), q: "" };
  const search = useIdentifierSearchQuery(activeParams, submitted !== null);
  const data = search.data;

  const eligibleSources = useMemo(
    () =>
      sources.filter(
        (source) =>
          source.enabled &&
          source.selectable_for_domain &&
          supportsTickerLookup(source),
      ),
    [sources],
  );
  const noEligibleSource = sources.length > 0 && eligibleSources.length === 0;
  const domainSearchable = draft.domain === "market_data";
  const submitDisabled = !online || !domainSearchable || noEligibleSource;

  const setFilter = useCallback(
    (key: keyof SearchFilters, value: string) => {
      const nextFilters: SearchFilters = { ...filters, [key]: value || undefined };
      setFilters(nextFilters);
      if (!submitted) return;
      void queryClient.cancelQueries({
        queryKey: queryKeys.dataLoad.identifierSearch(submitted),
      });
      setSubmitted({
        ...submitted,
        ...filterParams(nextFilters),
        q: submitted.q,
      });
      setSelected(new Set());
      setExpanded(new Set());
      setChoices({});
      setCancelled(false);
      setLiveMessage("Searching…");
    },
    [filters, queryClient, submitted],
  );

  const submit = useCallback(() => {
    const trimmed = query.trim();
    const nonWhitespace = Array.from(trimmed).filter(
      (character) => !/\s/.test(character),
    ).length;
    if (nonWhitespace < MIN_QUERY_NON_WHITESPACE) {
      setValidationError(
        `Enter at least ${MIN_QUERY_NON_WHITESPACE} characters to search.`,
      );
      setLiveMessage(
        `Enter at least ${MIN_QUERY_NON_WHITESPACE} characters to search.`,
      );
      return;
    }
    if (Array.from(trimmed).length > MAX_QUERY_LENGTH) {
      setValidationError(
        `Enter at most ${MAX_QUERY_LENGTH} characters to search.`,
      );
      setLiveMessage(`Enter at most ${MAX_QUERY_LENGTH} characters to search.`);
      return;
    }
    if (!online) {
      setValidationError(null);
      setLiveMessage(
        "Search is unavailable while offline. Manual identifier entry still works.",
      );
      return;
    }
    if (!domainSearchable) {
      setValidationError(
        "Identifier search is available for market and reference data only.",
      );
      return;
    }
    if (noEligibleSource) {
      setValidationError(
        "No enabled source can search market data. Enable one in the source catalog.",
      );
      return;
    }

    setValidationError(null);
    setAddNotice(null);
    setCancelled(false);
    setSelected(new Set());
    setExpanded(new Set());
    setChoices({});
    const next: IdentifierSearchParams = {
      ...filterParams(filters),
      q: trimmed,
    };
    if (submitted && sameSearch(submitted, next)) {
      setSubmitted(next);
      setLiveMessage("Searching…");
      void search.refetch();
      return;
    }
    if (submitted) {
      void queryClient.cancelQueries({
        queryKey: queryKeys.dataLoad.identifierSearch(submitted),
      });
    }
    setSubmitted(next);
    setLiveMessage("Searching…");
  }, [
    domainSearchable,
    filters,
    noEligibleSource,
    online,
    query,
    queryClient,
    search,
    submitted,
  ]);

  const cancel = useCallback(() => {
    if (submitted) {
      void queryClient.cancelQueries({
        queryKey: queryKeys.dataLoad.identifierSearch(submitted),
      });
    }
    setCancelled(true);
    setLiveMessage("Search stopped.");
  }, [queryClient, submitted]);

  const goToOffset = useCallback(
    (offset: number) => {
      if (!submitted || offset < 0) return;
      setSubmitted({ ...submitted, offset });
      setSelected(new Set());
      setExpanded(new Set());
      setChoices({});
      setCancelled(false);
      setLiveMessage("Searching…");
    },
    [submitted],
  );

  useEffect(() => {
    if (!submitted) return;
    if (cancelled) {
      setLiveMessage("Search stopped.");
      return;
    }
    if (search.isFetching) {
      setLiveMessage("Searching…");
      return;
    }
    if (search.error) {
      setLiveMessage(`Search failed: ${requestMessage(search.error)}`);
      return;
    }
    if (!data) return;
    if (data.outcome === "no_sources") {
      setLiveMessage(
        "No enabled source can search market data. Manual identifier entry still works.",
      );
      return;
    }
    if (data.outcome === "failed") {
      setLiveMessage(
        `Search failed: ${data.message ?? "every consulted source failed."}`,
      );
      return;
    }
    if (data.outcome === "partial") {
      const failed = failedSourceNames(data);
      setLiveMessage(
        `Partial results: ${data.total} result(s). ${
          failed.join(", ") || "Some sources"
        } could not be searched.`,
      );
      return;
    }
    if (data.outcome === "complete") {
      const filtered = Boolean(
        filters.source || filters.asset_type || filters.exchange,
      );
      setLiveMessage(
        data.total === 0
          ? filtered
            ? "No instruments match these filters."
            : "No instruments matched."
          : `${data.total} result(s).`,
      );
      return;
    }
    setLiveMessage(
      "The search returned an unrecognized outcome. Review the source status.",
    );
  }, [
    cancelled,
    data,
    filters.asset_type,
    filters.exchange,
    filters.source,
    search.error,
    search.isFetching,
    submitted,
  ]);

  const addOne = useCallback(
    (identifier: CandidateIdentifier) => {
      const counts = onAddIdentifiers([
        { scheme: identifier.scheme, value: identifier.value },
      ]);
      setAddNotice(
        counts.skipped > 0
          ? `Added ${counts.added}; skipped ${counts.skipped} duplicate(s).`
          : `Added ${counts.added} identifier(s).`,
      );
    },
    [onAddIdentifiers],
  );

  const addSelected = useCallback(() => {
    if (!data) return;
    const additions: ParsedIdentifier[] = [];
    for (const candidate of data.results) {
      if (!selected.has(candidateKey(candidate))) continue;
      const identifier = chosenIdentifier(candidate, choices);
      if (identifier?.addable) {
        additions.push({ scheme: identifier.scheme, value: identifier.value });
      }
    }
    const counts = onAddIdentifiers(additions);
    setSelected(new Set());
    setAddNotice(
      counts.skipped > 0
        ? `Added ${counts.added}; skipped ${counts.skipped} duplicate(s).`
        : `Added ${counts.added} identifier(s).`,
    );
  }, [choices, data, onAddIdentifiers, selected]);

  const draftKeys = useMemo(
    () =>
      new Set(
        draft.identifiers.map(
          (identifier) => `${identifier.scheme}\u0000${identifier.value}`,
        ),
      ),
    [draft.identifiers],
  );

  const assetTypes = useMemo(() => {
    const values = new Set<string>();
    for (const candidate of data?.results ?? []) {
      if (candidate.asset_type) values.add(candidate.asset_type);
    }
    return [...values].sort();
  }, [data?.results]);

  const exchanges = useMemo(() => {
    const values = new Set<string>();
    for (const candidate of data?.results ?? []) {
      const venue = candidate.venue_mic ?? candidate.exchange;
      if (venue) values.add(venue);
    }
    return [...values].sort();
  }, [data?.results]);

  const sourceOptions = data?.sources.length ? data.sources : eligibleSources;
  const offset = data?.offset ?? 0;
  const results = data?.results ?? [];
  const rangeStart = results.length > 0 ? offset + 1 : 0;
  const rangeEnd = offset + results.length;
  const hasPrevious = offset > 0;
  const hasNext = data ? offset + results.length < data.total : false;
  const hasFilters = Boolean(
    filters.source || filters.asset_type || filters.exchange,
  );
  const showNoMatch =
    data?.outcome === "complete" &&
    data.total === 0 &&
    !hasFilters &&
    !cancelled;
  const showFilteredEmpty =
    data?.outcome === "complete" &&
    data.total === 0 &&
    hasFilters &&
    !cancelled;
  const knownOutcome =
    data !== undefined &&
    ["complete", "partial", "failed", "no_sources"].includes(data.outcome);
  const canAddSelected =
    results.some((candidate) => selected.has(candidateKey(candidate))) &&
    !search.isFetching;

  return (
    <section className="obolargus_identifier_search" aria-label="Identifier search">
      <h2>Find an instrument</h2>
      <form
        role="search"
        className="obolargus_identifier_search_form"
        aria-label="External identifier search"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="obolargus_form_field">
          <Input
            id="data-load-identifier-search"
            label="Search external identifiers"
            value={query}
            placeholder="Ticker or company name"
            describedBy="data-load-identifier-search-help"
            errors={validationError ? [validationError] : []}
            onChange={(value) => {
              setQuery(value);
              if (validationError) setValidationError(null);
            }}
          />
          <p id="data-load-identifier-search-help" className="obolargus_form_note">
            Enter at least {MIN_QUERY_NON_WHITESPACE} and at most{" "}
            {MAX_QUERY_LENGTH} characters. Searches market and reference data
            across enabled sources. Search is read-only.
          </p>
          {!online && (
            <p className="obolargus_search_reason" role="note">
              Search is unavailable while offline. Manual identifier entry still
              works.
            </p>
          )}
          {!domainSearchable && (
            <p className="obolargus_search_reason" role="note">
              Identifier search is available for market and reference data only.
            </p>
          )}
          {noEligibleSource && (
            <p className="obolargus_search_reason" role="note">
              No enabled source can search market data. Enable one in the source
              catalog; manual entry still works.
            </p>
          )}
        </div>

        <div className="obolargus_search_filters">
          <div className="obolargus_form_field">
            <label htmlFor="identifier-filter-source">Source</label>
            <select
              id="identifier-filter-source"
              value={filters.source ?? ""}
              onChange={(event) => setFilter("source", event.target.value)}
              disabled={!submitted}
            >
              <option value="">All sources</option>
              {sourceOptions.map((source) => (
                <option key={source.source_id} value={source.source_id}>
                  {source.display_name}
                </option>
              ))}
            </select>
          </div>
          <div className="obolargus_form_field">
            <label htmlFor="identifier-filter-asset-type">Asset type</label>
            <select
              id="identifier-filter-asset-type"
              value={filters.asset_type ?? ""}
              onChange={(event) => setFilter("asset_type", event.target.value)}
              disabled={!submitted || assetTypes.length === 0}
            >
              <option value="">All asset types</option>
              {assetTypes.map((assetType) => (
                <option key={assetType} value={assetType}>
                  {assetType}
                </option>
              ))}
            </select>
          </div>
          <div className="obolargus_form_field">
            <label htmlFor="identifier-filter-exchange">Exchange</label>
            <select
              id="identifier-filter-exchange"
              value={filters.exchange ?? ""}
              onChange={(event) => setFilter("exchange", event.target.value)}
              disabled={!submitted || exchanges.length === 0}
            >
              <option value="">All exchanges</option>
              {exchanges.map((exchange) => (
                <option key={exchange} value={exchange}>
                  {exchange}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="obolargus_form_actions">
          <Button type="submit" variant="primary" disabled={submitDisabled}>
            Search
          </Button>
          {search.isFetching && (
            <Button type="button" onClick={cancel}>
              Cancel
            </Button>
          )}
          {data && data.results.length > 0 && (
            <Button
              type="button"
              onClick={addSelected}
              disabled={!canAddSelected}
            >
              Add selected
            </Button>
          )}
        </div>
      </form>

      <p className="obolargus_search_live" role="status" aria-live="polite">
        {liveMessage}
      </p>
      {addNotice && (
        <p className="obolargus_form_note" role="status">
          {addNotice}
        </p>
      )}

      {search.isFetching && (
        <p className="obolargus_form_note" role="status">
          Searching…
        </p>
      )}

      {cancelled && (
        <p className="obolargus_search_notice" role="status">
          Search stopped.
          {data ? " Showing the last completed results." : ""}
        </p>
      )}

      {search.error && !cancelled && (
        <div className="obolargus_alert" role="alert">
          <p>Search failed: {requestMessage(search.error)}</p>
          <Button type="button" onClick={submit} disabled={submitDisabled}>
            Retry
          </Button>
        </div>
      )}

      {data && (
        <IdentifierSearchSources
          data={data}
          cancelled={cancelled}
          retryDisabled={submitDisabled}
          onRetry={submit}
        />
      )}

      {showNoMatch && data && (
        <p className="obolargus_search_notice" role="status">
          No instruments matched for “{data.query}”.
        </p>
      )}

      {showFilteredEmpty && (
        <p className="obolargus_search_notice" role="status">
          No instruments match these filters.
        </p>
      )}

      {data && !knownOutcome && (
        <p className="obolargus_search_notice" role="status">
          The search returned an unrecognized outcome. Review the source status
          before adding anything.
        </p>
      )}

      {data && results.length > 0 && (
        <div className="obolargus_search_results">
          <p className="obolargus_form_note">
            Showing {rangeStart}–{rangeEnd} of {data.total} result(s).
          </p>
          <div
            className="obolargus_search_result_scroll"
            role="region"
            aria-label="Search results"
            tabIndex={0}
          >
            <ul className="obolargus_search_result_list">
              {results.map((candidate) => {
                const identifier = chosenIdentifier(candidate, choices);
                if (!identifier) return null;
                const key = candidateKey(candidate);
                return (
                  <li key={key}>
                    <IdentifierSearchResult
                      candidate={candidate}
                      selectedIdentifier={identifier}
                      onChooseIdentifier={(chosen) =>
                        setChoices((current) => ({
                          ...current,
                          [key]: identifierToken(chosen),
                        }))
                      }
                      inBatch={draftKeys.has(identifierToken(identifier))}
                      selected={selected.has(key)}
                      onToggleSelected={() =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (next.has(key)) next.delete(key);
                          else next.add(key);
                          return next;
                        })
                      }
                      expanded={expanded.has(key)}
                      onToggleExpanded={() =>
                        setExpanded((current) => {
                          const next = new Set(current);
                          if (next.has(key)) next.delete(key);
                          else next.add(key);
                          return next;
                        })
                      }
                      onAdd={addOne}
                      createMissingAssets={draft.createMissingAssets}
                      onToggleCreateMissing={onToggleCreateMissing}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
          <nav aria-label="Search result pages" className="obolargus_search_paging">
            <Button
              type="button"
              onClick={() => goToOffset(offset - PAGE_SIZE)}
              disabled={!hasPrevious || search.isFetching}
            >
              Previous page
            </Button>
            <span>
              Page {Math.floor(offset / PAGE_SIZE) + 1} of{" "}
              {Math.max(1, Math.ceil(data.total / PAGE_SIZE))}
            </span>
            <Button
              type="button"
              onClick={() => goToOffset(offset + PAGE_SIZE)}
              disabled={!hasNext || search.isFetching}
            >
              Next page
            </Button>
          </nav>
        </div>
      )}

      {data && results.length === 0 && data.outcome === "partial" && (
        <p className="obolargus_form_note">
          No results were returned by the sources that answered, but the search
          was not complete.
        </p>
      )}
    </section>
  );
}

export default IdentifierSearch;
