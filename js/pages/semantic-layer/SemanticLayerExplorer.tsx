import { useDeferredValue, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "lx_client/js/components/Button";
import { Input } from "lx_client/js/components/Input";
import { LastUpdatedLabel } from "../../offline/LastUpdatedLabel";
import { queryKeys } from "../../query/keys";
import type {
  KindFilter,
  SemanticDictionary,
  SemanticLayerViewState,
} from "../../types/semanticLayer";
import { DefinitionDetail } from "./DefinitionDetail";
import { DocumentActions } from "./DocumentActions";
import { Inventory } from "./Inventory";
import { Overview } from "./Overview";
import { RawPanel } from "./RawPanel";
import { searchDictionary } from "./search";
import { SystemSemantics } from "./SystemSemantics";
import { hrefForViewState } from "./viewState";

function definitionNotFound(viewState: SemanticLayerViewState) {
  return (
    <div className="obolargus_semantic_empty" role="status">
      <h2>Definition not found</h2>
      <p>
        The definition{" "}
        <code>{viewState.definitionKey ?? "unknown"}</code> is not in the
        current dictionary. The dictionary may have changed since this link was
        saved.
      </p>
      <Link to={hrefForViewState({ ...viewState, view: "overview" })}>
        Back to the current overview
      </Link>
    </div>
  );
}

/** Props for the presentational Semantic Layer explorer. */
export interface SemanticLayerExplorerProps {
  dictionary: SemanticDictionary;
  viewState: SemanticLayerViewState;
  refreshing: boolean;
  refreshError: string | null;
  onRefresh: () => void;
  onNavigate: (
    patch: Partial<SemanticLayerViewState>,
    options?: { replace?: boolean },
  ) => void;
}

/**
 * Read-only, URL-driven explorer over the canonical data dictionary.
 */
export function SemanticLayerExplorer({
  dictionary,
  viewState,
  refreshing,
  refreshError,
  onRefresh,
  onNavigate,
}: SemanticLayerExplorerProps) {
  const deferredQuery = useDeferredValue(viewState.query);
  const results = useMemo(
    () => searchDictionary(dictionary, viewState, deferredQuery),
    [dictionary, viewState, deferredQuery],
  );

  const definition = viewState.definitionKey
    ? dictionary.byKey.get(viewState.definitionKey) ?? null
    : null;
  const searchActive = Boolean(
    viewState.query ||
      viewState.kind !== "all" ||
      viewState.subject ||
      viewState.aggregate,
  );
  const clearSearch = () =>
    onNavigate(
      {
        query: "",
        kind: "all",
        subject: null,
        aggregate: null,
      },
      { replace: true },
    );

  return (
    <div className="obolargus_semantic_page">
      <header className="obolargus_semantic_header">
        <div className="obolargus_semantic_header_text">
          <h1>Semantic Layer</h1>
          <p>
            Browse the canonical system data dictionary: entities, fact types,
            value shapes, relationships, invariants, and constraints.
          </p>
          <p className="obolargus_semantic_versions">
            <span className="obolargus_semantic_badge">
              Schema {dictionary.metadata.schemaVersion || "not declared"}
            </span>
            <span className="obolargus_semantic_badge">
              Model {dictionary.metadata.modelVersion || "not declared"}
            </span>
          </p>
        </div>
        <div className="obolargus_semantic_header_actions">
          <LastUpdatedLabel queryKey={queryKeys.semanticLayer.document()} />
          <Button type="button" onClick={onRefresh} disabled={refreshing}>
            Refresh
          </Button>
          <DocumentActions canonicalText={dictionary.canonicalText} />
        </div>
      </header>

      {refreshing ? (
        <p role="status" className="obolargus_semantic_muted">
          Refreshing the dictionary…
        </p>
      ) : null}

      {refreshError ? (
        <div className="obolargus_semantic_alert" role="alert">
          <p>The dictionary could not be refreshed. {refreshError}</p>
          <Button type="button" onClick={onRefresh}>
            Retry
          </Button>
        </div>
      ) : null}

      <div className="obolargus_semantic_body">
        <aside className="obolargus_semantic_sidebar">
          <form
            role="search"
            className="obolargus_semantic_search"
            aria-label="Search the dictionary"
            onSubmit={(event) => event.preventDefault()}
          >
            <Input
              id="semantic-layer-search"
              label="Search the dictionary"
              type="search"
              value={viewState.query}
              placeholder="Definition, field, constraint, or known value"
              onChange={(value) => onNavigate({ query: value }, { replace: true })}
              inputAttrs={{ maxLength: 200 }}
            />
          </form>

          <div className="obolargus_semantic_filters">
            <div className="obolargus_form_field">
              <label htmlFor="semantic-layer-kind">Definition kind</label>
              <select
                id="semantic-layer-kind"
                value={viewState.kind}
                onChange={(event) =>
                  onNavigate(
                    { kind: event.target.value as KindFilter },
                    { replace: true },
                  )
                }
              >
                <option value="all">All definitions</option>
                <option value="entity">Domain entities</option>
                <option value="fact_type">Fact types</option>
                <option value="value_shape">Fact value shapes</option>
                <option value="other">Other definitions</option>
              </select>
            </div>

            {dictionary.facets.subjects.length > 0 ? (
              <div className="obolargus_form_field">
                <label htmlFor="semantic-layer-subject">Subject</label>
                <select
                  id="semantic-layer-subject"
                  value={viewState.subject ?? ""}
                  onChange={(event) =>
                    onNavigate(
                      { subject: event.target.value || null },
                      { replace: true },
                    )
                  }
                >
                  <option value="">All subjects</option>
                  {dictionary.facets.subjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {dictionary.facets.aggregates.length > 0 ? (
              <div className="obolargus_form_field">
                <label htmlFor="semantic-layer-aggregate">Aggregate</label>
                <select
                  id="semantic-layer-aggregate"
                  value={viewState.aggregate ?? ""}
                  onChange={(event) =>
                    onNavigate(
                      { aggregate: event.target.value || null },
                      { replace: true },
                    )
                  }
                >
                  <option value="">All aggregates</option>
                  {dictionary.facets.aggregates.map((aggregate) => (
                    <option key={aggregate} value={aggregate}>
                      {aggregate}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {searchActive ? (
            <div className="obolargus_semantic_clear_search">
              <Button type="button" onClick={clearSearch}>
                Clear search and filters
              </Button>
            </div>
          ) : null}

          <Inventory
            dictionary={dictionary}
            viewState={viewState}
            results={results}
          />
        </aside>

        <section
          className="obolargus_semantic_detail_region"
          aria-label="Dictionary detail"
        >
          {viewState.view === "overview" ? (
            <Overview dictionary={dictionary} viewState={viewState} />
          ) : null}
          {viewState.view === "system" ? (
            <SystemSemantics dictionary={dictionary} viewState={viewState} />
          ) : null}
          {viewState.view === "document" ? (
            <RawPanel
              title="Canonical dictionary"
              text={dictionary.canonicalText}
              copyLabel="Copy document"
            />
          ) : null}
          {viewState.view === "definition" ? (
            definition ? (
              <DefinitionDetail
                dictionary={dictionary}
                definition={definition}
                viewState={viewState}
                onNavigate={onNavigate}
              />
            ) : (
              definitionNotFound(viewState)
            )
          ) : null}
        </section>
      </div>
    </div>
  );
}

export default SemanticLayerExplorer;
