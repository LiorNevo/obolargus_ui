import { Link } from "react-router-dom";
import type {
  DefinitionGroup,
  KindFilter,
  SemanticDictionary,
  SemanticLayerViewState,
} from "../../types/semanticLayer";
import {
  hrefForDefinition,
  hrefForSystem,
  hrefForViewState,
} from "./viewState";

function groupKind(group: DefinitionGroup): KindFilter {
  switch (group.id) {
    case "entities":
      return "entity";
    case "factTypes":
      return "fact_type";
    case "valueShapes":
      return "value_shape";
    case "other":
      return "other";
  }
}

function groupHref(
  state: SemanticLayerViewState,
  group: DefinitionGroup,
): string {
  return hrefForViewState({
    ...state,
    view: "overview",
    definitionKey: null,
    tab: "details",
    query: "",
    kind: groupKind(group),
    subject: null,
    aggregate: null,
  });
}

/** Props for the dictionary overview. */
export interface OverviewProps {
  dictionary: SemanticDictionary;
  viewState: SemanticLayerViewState;
}

/**
 * Shows the dictionary metadata, counts, and grouped entry points.
 */
export function Overview({ dictionary, viewState }: OverviewProps) {
  const { metadata, counts } = dictionary;

  return (
    <div className="obolargus_semantic_overview">
      <div className="obolargus_semantic_section_header">
        <h2>{metadata.title}</h2>
        <p>{metadata.description}</p>
        <p className="obolargus_semantic_muted">
          This is a read-only view of the canonical system data dictionary. The
          page does not edit the domain model or fact catalog.
        </p>
      </div>

      <dl className="obolargus_semantic_metadata">
        <div>
          <dt>Schema version</dt>
          <dd>{metadata.schemaVersion || "not declared"}</dd>
        </div>
        <div>
          <dt>Model version</dt>
          <dd>{metadata.modelVersion || "not declared"}</dd>
        </div>
        <div>
          <dt>Identifier</dt>
          <dd>
            <code>{metadata.id || "not declared"}</code>
          </dd>
        </div>
        <div>
          <dt>Dialect</dt>
          <dd>
            <code>{metadata.schemaDialect || "not declared"}</code>
          </dd>
        </div>
      </dl>

      <section
        className="obolargus_semantic_section"
        aria-labelledby="overview-counts"
      >
        <h3 id="overview-counts">Dictionary contents</h3>
        <dl className="obolargus_semantic_counts">
          <div>
            <dt>Domain entities</dt>
            <dd>{counts.entities}</dd>
          </div>
          <div>
            <dt>Fact types</dt>
            <dd>{counts.factTypes}</dd>
          </div>
          <div>
            <dt>Fact value shapes</dt>
            <dd>{counts.valueShapes}</dd>
          </div>
          <div>
            <dt>Fields</dt>
            <dd>{counts.fields}</dd>
          </div>
          <div>
            <dt>Relationships</dt>
            <dd>{counts.relationships}</dd>
          </div>
          <div>
            <dt>Invariants</dt>
            <dd>{counts.invariants}</dd>
          </div>
          <div>
            <dt>Cross-field constraints</dt>
            <dd>{counts.constraints}</dd>
          </div>
        </dl>
      </section>

      <div className="obolargus_semantic_group_grid">
        {dictionary.groups.map((group) => (
          <div key={group.id} className="obolargus_semantic_group_card">
            <h3 id={`overview-group-${group.id}`}>
              <Link to={groupHref(viewState, group)}>
                {group.label} ({group.count})
              </Link>
            </h3>
            <p className="obolargus_semantic_muted">{group.description}</p>
            <ul>
              {group.definitions.slice(0, 6).map((definition) => (
                <li key={definition.key}>
                  <Link to={hrefForDefinition(viewState, definition.key)}>
                    {definition.name}
                  </Link>
                  {definition.description ? (
                    <span className="obolargus_semantic_muted">
                      {" "}
                      — {definition.description}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            {group.count > 6 ? (
              <Link to={groupHref(viewState, group)}>
                Browse all {group.count}
              </Link>
            ) : null}
          </div>
        ))}

        <div className="obolargus_semantic_group_card">
          <h3 id="overview-system-semantics">
            <Link to={hrefForSystem(viewState)}>System semantics</Link>
          </h3>
          <p className="obolargus_semantic_muted">
            Relationships, invariants, and cross-field constraints declared by
            the canonical dictionary.
          </p>
          <ul>
            <li>
              <Link to={hrefForSystem(viewState)}>
                Relationships ({counts.relationships})
              </Link>
            </li>
            <li>
              <Link to={hrefForSystem(viewState)}>
                Invariants ({counts.invariants})
              </Link>
            </li>
            <li>
              <Link to={hrefForSystem(viewState)}>
                Cross-field constraints ({counts.constraints})
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Overview;
