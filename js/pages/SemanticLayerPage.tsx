import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "lx_client/js/components/Button";
import Loading from "lx_client/js/components/Loading";
import { usePageTitle } from "lx_client/js/navigation/usePageTitle";
import { SemanticLayerApiError } from "../api/semanticLayer";
import {
  isOfflineUnavailableError,
  normalizeOfflineError,
} from "../offline/errors";
import { useSemanticLayerQuery } from "../query/semanticLayerQueries";
import type { SemanticLayerViewState } from "../types/semanticLayer";
import { SemanticLayerExplorer } from "./semantic-layer/SemanticLayerExplorer";
import {
  SemanticDictionaryError,
  buildSemanticDictionary,
} from "./semantic-layer/semanticDictionary";
import { parseViewState, toSearchParams } from "./semantic-layer/viewState";
import "./semantic-layer/semantic-layer.css";

function messageFor(error: unknown): string {
  const normalized = normalizeOfflineError(error);
  if (isOfflineUnavailableError(normalized)) return normalized.message;
  if (normalized instanceof SemanticLayerApiError) return normalized.message;
  if (normalized instanceof Error) return normalized.message;
  return "The data dictionary could not be loaded.";
}

interface StatusPageProps {
  heading: string;
  message: string;
  onRetry?: () => void;
  tone?: "status" | "alert";
}

function StatusPage({ heading, message, onRetry, tone = "status" }: StatusPageProps) {
  return (
    <div className="obolargus_semantic_page">
      <header className="obolargus_semantic_header">
        <div className="obolargus_semantic_header_text">
          <h1>Semantic Layer</h1>
          <p>
            Browse the canonical system data dictionary: entities, fact types,
            value shapes, relationships, invariants, and constraints.
          </p>
        </div>
      </header>
      <div
        className="obolargus_semantic_empty"
        role={tone === "alert" ? "alert" : "status"}
      >
        <h2>{heading}</h2>
        <p>{message}</p>
        {onRetry ? (
          <Button type="button" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Semantic Layer page: query, URL-state, and state wiring around the
 * presentational explorer.
 */
export function SemanticLayerPage() {
  usePageTitle("Semantic Layer");
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useSemanticLayerQuery();
  const viewState = useMemo(
    () => parseViewState(searchParams),
    [searchParams],
  );

  const parsed = useMemo(() => {
    if (!query.data) return { dictionary: null, error: null };
    try {
      return {
        dictionary: buildSemanticDictionary(
          query.data.document,
          query.data.canonicalText,
        ),
        error: null,
      };
    } catch (error) {
      if (error instanceof SemanticDictionaryError) {
        return { dictionary: null, error };
      }
      return {
        dictionary: null,
        error: new SemanticDictionaryError(
          "invalid",
          "The dictionary response could not be interpreted.",
        ),
      };
    }
  }, [query.data]);

  const navigate = useCallback(
    (
      patch: Partial<SemanticLayerViewState>,
      options?: { replace?: boolean },
    ) => {
      setSearchParams(
        (current) => {
          const next = { ...parseViewState(current), ...patch };
          if (patch.definitionKey !== undefined && patch.view === undefined) {
            next.view = patch.definitionKey ? "definition" : "overview";
          }
          if (next.view === "definition" && !next.definitionKey) {
            next.view = "overview";
          }
          if (next.view !== "definition") {
            next.definitionKey = null;
            next.tab = "details";
          }
          if (next.view === "document") {
            next.definitionKey = null;
            next.tab = "details";
          }
          return toSearchParams(next);
        },
        { replace: options?.replace ?? false },
      );
    },
    [setSearchParams],
  );

  const refresh = useCallback(() => {
    void query.refetch();
  }, [query]);

  if (query.isPending && !query.data) {
    return (
      <div className="obolargus_semantic_page" aria-busy="true">
        <header className="obolargus_semantic_header">
          <div className="obolargus_semantic_header_text">
            <h1>Semantic Layer</h1>
            <p>
              Browse the canonical system data dictionary: entities, fact types,
              value shapes, relationships, invariants, and constraints.
            </p>
          </div>
        </header>
        <Loading label="Loading the data dictionary..." />
      </div>
    );
  }

  if (query.isError && !query.data) {
    return (
      <StatusPage
        heading="The data dictionary could not be loaded"
        message={messageFor(query.error)}
        onRetry={refresh}
        tone="alert"
      />
    );
  }

  if (parsed.error) {
    const heading =
      parsed.error.kind === "empty"
        ? "The data dictionary is empty"
        : parsed.error.kind === "incomplete"
          ? "The data dictionary is incomplete"
          : "The data dictionary could not be interpreted";
    return (
      <StatusPage
        heading={heading}
        message={parsed.error.message}
        onRetry={refresh}
        tone="alert"
      />
    );
  }

  if (!parsed.dictionary) {
    return (
      <StatusPage
        heading="The data dictionary could not be loaded"
        message="No dictionary content was available."
        onRetry={refresh}
        tone="alert"
      />
    );
  }

  const refreshError =
    query.isError && query.data ? messageFor(query.error) : null;

  return (
    <SemanticLayerExplorer
      dictionary={parsed.dictionary}
      viewState={viewState}
      refreshing={query.isFetching}
      refreshError={refreshError}
      onRefresh={refresh}
      onNavigate={navigate}
    />
  );
}

export default SemanticLayerPage;
