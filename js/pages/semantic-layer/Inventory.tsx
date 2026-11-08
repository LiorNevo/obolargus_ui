import { Link } from "react-router-dom";
import type {
  SearchResult,
  SemanticDictionary,
  SemanticLayerViewState,
} from "../../types/semanticLayer";
import {
  hrefForDefinition,
  hrefForSystem,
  hrefForViewState,
} from "./viewState";

function searchActive(state: SemanticLayerViewState): boolean {
  return Boolean(
    state.query ||
      state.kind !== "all" ||
      state.subject ||
      state.aggregate,
  );
}

function kindLabel(kind: SearchResult["entry"]["kind"]): string {
  if (kind === "system") return "System semantics";
  return kind.replace("_", " ");
}

function resultHref(
  state: SemanticLayerViewState,
  result: SearchResult,
): string {
  if (result.entry.kind === "system") return hrefForSystem(state);
  return hrefForDefinition(state, result.entry.definitionKey);
}

/** Props for the sidebar inventory and search-result list. */
export interface InventoryProps {
  dictionary: SemanticDictionary;
  viewState: SemanticLayerViewState;
  results: SearchResult[];
}

/**
 * Renders either the grouped inventory or the active search results.
 */
export function Inventory({
  dictionary,
  viewState,
  results,
}: InventoryProps) {
  if (searchActive(viewState)) {
    return (
      <section
        className="obolargus_semantic_inventory"
        aria-label="Search results"
      >
        <div className="obolargus_semantic_section_header">
          <h2>Search results</h2>
          <p role="status" aria-live="polite">
            {results.length} {results.length === 1 ? "match" : "matches"}
          </p>
        </div>
        {results.length === 0 ? (
          <div className="obolargus_semantic_empty" role="status">
            <p>No dictionary item matched the current search and filters.</p>
            <p className="obolargus_semantic_muted">
              Use Clear search and filters above to restore the inventory.
            </p>
          </div>
        ) : (
          <ul className="obolargus_semantic_result_list">
            {results.map((result) => {
              const id =
                result.entry.kind === "system"
                  ? "system"
                  : result.entry.definitionKey;
              return (
                <li key={id}>
                  <Link to={resultHref(viewState, result)}>
                    <span className="obolargus_semantic_result_name">
                      {result.entry.name}
                    </span>
                    <span className="obolargus_semantic_badge">
                      {kindLabel(result.entry.kind)}
                    </span>
                  </Link>
                  {result.contexts.length > 0 ? (
                    <span className="obolargus_semantic_result_context">
                      Matched: {result.contexts.join(", ")}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  }

  return (
    <nav
      className="obolargus_semantic_inventory"
      aria-label="Dictionary inventory"
    >
      {dictionary.groups.map((group) => (
        <div key={group.id}>
          <h2 id={`inventory-${group.id}`}>
            {group.label}{" "}
            <span className="obolargus_semantic_count">{group.count}</span>
          </h2>
          <ul>
            {group.definitions.map((definition) => {
              const selected =
                viewState.view === "definition" &&
                viewState.definitionKey === definition.key;
              return (
                <li key={definition.key}>
                  <Link
                    to={hrefForDefinition(viewState, definition.key)}
                    aria-current={selected ? "true" : undefined}
                  >
                    {definition.name}
                  </Link>
                  {definition.description ? (
                    <span className="obolargus_semantic_muted">
                      {" "}
                      — {definition.description}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div>
        <h2 id="inventory-system">System semantics</h2>
        <ul>
          <li>
            <Link to={hrefForSystem(viewState)}>
              Relationships ({dictionary.counts.relationships})
            </Link>
          </li>
          <li>
            <Link to={hrefForSystem(viewState)}>
              Invariants ({dictionary.counts.invariants})
            </Link>
          </li>
          <li>
            <Link to={hrefForSystem(viewState)}>
              Cross-field constraints ({dictionary.counts.constraints})
            </Link>
          </li>
        </ul>
      </div>

      <div>
        <h2 id="inventory-document">Canonical document</h2>
        <ul>
          <li>
            <Link
              to={hrefForViewState({ ...viewState, view: "document" })}
            >
              Whole dictionary
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}

export default Inventory;
