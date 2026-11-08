import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import type {
  DefinitionKind,
  DictionaryDefinition,
  KindFilter,
  SemanticDictionary,
  SemanticLayerViewState,
} from "../../types/semanticLayer";
import { FieldTable } from "./FieldTable";
import { RawPanel } from "./RawPanel";
import { RelationshipsSection } from "./RelationshipsSection";
import {
  hrefForDefinition,
  hrefForViewState,
} from "./viewState";

function groupKind(kind: DefinitionKind): KindFilter {
  switch (kind) {
    case "entity":
      return "entity";
    case "fact_type":
      return "fact_type";
    case "value_shape":
    case "union":
      return "value_shape";
    case "other":
      return "other";
  }
}

function groupLabel(kind: DefinitionKind): string {
  switch (kind) {
    case "entity":
      return "Domain entities";
    case "fact_type":
      return "Fact types";
    case "value_shape":
    case "union":
      return "Fact value shapes";
    case "other":
      return "Other definitions";
  }
}

function groupHref(
  state: SemanticLayerViewState,
  kind: DefinitionKind,
): string {
  return hrefForViewState({
    ...state,
    view: "overview",
    definitionKey: null,
    tab: "details",
    query: "",
    kind: groupKind(kind),
    subject: null,
    aggregate: null,
  });
}

function DefinitionLink({
  dictionary,
  viewState,
  definitionKey,
}: {
  dictionary: SemanticDictionary;
  viewState: SemanticLayerViewState;
  definitionKey: string;
}) {
  const definition = dictionary.byKey.get(definitionKey);
  if (!definition) return <span>{definitionKey} (unresolved)</span>;
  return (
    <Link to={hrefForDefinition(viewState, definitionKey)}>
      {definition.name}
    </Link>
  );
}

function DefinitionFacts({
  definition,
  dictionary,
  viewState,
}: {
  definition: DictionaryDefinition;
  dictionary: SemanticDictionary;
  viewState: SemanticLayerViewState;
}) {
  if (definition.factType) {
    const meta = definition.factType;
    return (
      <section
        className="obolargus_semantic_section"
        aria-labelledby={`fact-type-${definition.key}`}
      >
        <h3 id={`fact-type-${definition.key}`}>Fact type metadata</h3>
        <dl className="obolargus_semantic_metadata">
          <div>
            <dt>Fact type</dt>
            <dd>
              <code>{meta.factType}</code>
            </dd>
          </div>
          <div>
            <dt>Subjects</dt>
            <dd>{meta.subjects.join(", ") || "not declared"}</dd>
          </div>
          <div>
            <dt>Storage kind</dt>
            <dd>{meta.storageKind || "not declared"}</dd>
          </div>
          <div>
            <dt>Aggregation</dt>
            <dd>{meta.aggregation || "not declared"}</dd>
          </div>
          <div>
            <dt>Unit</dt>
            <dd>{meta.unit ?? "not declared"}</dd>
          </div>
          <div>
            <dt>Observation kind</dt>
            <dd>{meta.observationKind ?? "not declared"}</dd>
          </div>
          <div>
            <dt>Interval</dt>
            <dd>
              {meta.intervalSeconds === null
                ? "not declared"
                : `${meta.intervalSeconds} seconds`}
            </dd>
          </div>
          <div>
            <dt>Schema version</dt>
            <dd>{meta.schemaVersion ?? "not declared"}</dd>
          </div>
        </dl>
        <p>
          Value shape:{" "}
          {definition.valueShapeRef ? (
            <DefinitionLink
              dictionary={dictionary}
              viewState={viewState}
              definitionKey={definition.valueShapeRef}
            />
          ) : (
            "not declared"
          )}
        </p>
      </section>
    );
  }

  if (definition.kind === "union") {
    return (
      <section
        className="obolargus_semantic_section"
        aria-labelledby={`variants-${definition.key}`}
      >
        <h3 id={`variants-${definition.key}`}>Union variants</h3>
        {definition.variants.length === 0 ? (
          <p className="obolargus_semantic_muted">No variants declared.</p>
        ) : (
          <ol>
            {definition.variants.map((variant) => (
              <li key={variant.type}>
                <code>{variant.type}</code>
                {" → "}
                {variant.shapeRef ? (
                  <DefinitionLink
                    dictionary={dictionary}
                    viewState={viewState}
                    definitionKey={variant.shapeRef}
                  />
                ) : (
                  "not declared"
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    );
  }

  return null;
}

function ValueShapeReferences({
  definition,
  dictionary,
  viewState,
}: {
  definition: DictionaryDefinition;
  dictionary: SemanticDictionary;
  viewState: SemanticLayerViewState;
}) {
  if (definition.kind !== "value_shape" && definition.kind !== "union") {
    return null;
  }
  const references =
    dictionary.referencingFactTypesByShape.get(definition.key) ?? [];
  return (
    <section
      className="obolargus_semantic_section"
      aria-labelledby={`referencing-${definition.key}`}
    >
      <h3 id={`referencing-${definition.key}`}>Referenced by fact types</h3>
      {references.length === 0 ? (
        <p className="obolargus_semantic_muted">
          No fact types reference this shape.
        </p>
      ) : (
        <ul>
          {references.map((definitionKey) => (
            <li key={definitionKey}>
              <DefinitionLink
                dictionary={dictionary}
                viewState={viewState}
                definitionKey={definitionKey}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ConstraintSection({
  definition,
  dictionary,
  viewState,
}: {
  definition: DictionaryDefinition;
  dictionary: SemanticDictionary;
  viewState: SemanticLayerViewState;
}) {
  return (
    <section
      className="obolargus_semantic_section"
      aria-labelledby={`constraints-${definition.key}`}
    >
      <h3 id={`constraints-${definition.key}`}>Cross-field constraints</h3>
      {definition.constraints.length === 0 ? (
        <p className="obolargus_semantic_muted">
          No cross-field constraints apply to this definition.
        </p>
      ) : (
        <ul className="obolargus_semantic_constraint_list">
          {definition.constraints.map((constraint) => (
            <li key={constraint.name}>
              <strong>{constraint.name}</strong>
              <p>{constraint.description}</p>
              <p className="obolargus_semantic_muted">
                Applies to:{" "}
                {constraint.appliesTo.map((target, index) => (
                  <span key={target}>
                    {index > 0 ? " / " : null}
                    <DefinitionLink
                      dictionary={dictionary}
                      viewState={viewState}
                      definitionKey={target}
                    />
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Props for one definition detail view. */
export interface DefinitionDetailProps {
  dictionary: SemanticDictionary;
  definition: DictionaryDefinition;
  viewState: SemanticLayerViewState;
  onNavigate: (
    patch: Partial<SemanticLayerViewState>,
    options?: { replace?: boolean },
  ) => void;
}

/**
 * Renders one definition with its fields, semantics, relationships, and raw
 * representation.
 */
export function DefinitionDetail({
  dictionary,
  definition,
  viewState,
  onNavigate,
}: DefinitionDetailProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [definition.key]);

  const detailsTabId = `definition-details-tab-${definition.key}`;
  const rawTabId = `definition-raw-tab-${definition.key}`;
  const detailsPanelId = `definition-details-panel-${definition.key}`;
  const rawPanelId = `definition-raw-panel-${definition.key}`;

  const selectTab = (tab: "details" | "raw") => onNavigate({ tab });

  return (
    <article className="obolargus_semantic_detail">
      <nav aria-label="Breadcrumb" className="obolargus_semantic_breadcrumbs">
        <Link to={hrefForViewState({ ...viewState, view: "overview" })}>
          Semantic Layer
        </Link>
        <span aria-hidden="true"> / </span>
        <Link to={groupHref(viewState, definition.kind)}>
          {groupLabel(definition.kind)}
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{definition.name}</span>
      </nav>

      <div className="obolargus_semantic_section_header">
        <h2 ref={headingRef} tabIndex={-1}>
          {definition.name}
        </h2>
        <p>
          <span className="obolargus_semantic_badge">
            {definition.kind.replace("_", " ")}
          </span>{" "}
          <code>{definition.key}</code>
        </p>
        <p>{definition.description ?? "No description declared."}</p>
        {definition.table ? (
          <p className="obolargus_semantic_muted">
            Table: <code>{definition.table}</code>
          </p>
        ) : null}
      </div>

      <div
        className="obolargus_semantic_tabs"
        role="tablist"
        aria-label={`${definition.name} view`}
      >
        <button
          type="button"
          role="tab"
          id={detailsTabId}
          aria-selected={viewState.tab === "details"}
          aria-controls={detailsPanelId}
          tabIndex={viewState.tab === "details" ? 0 : -1}
          onClick={() => selectTab("details")}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") {
              event.preventDefault();
              selectTab("raw");
            }
          }}
        >
          Details
        </button>
        <button
          type="button"
          role="tab"
          id={rawTabId}
          aria-selected={viewState.tab === "raw"}
          aria-controls={rawPanelId}
          tabIndex={viewState.tab === "raw" ? 0 : -1}
          onClick={() => selectTab("raw")}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              selectTab("details");
            }
          }}
        >
          Raw
        </button>
      </div>

      <div
        role="tabpanel"
        id={detailsPanelId}
        aria-labelledby={detailsTabId}
        hidden={viewState.tab !== "details"}
      >
        <DefinitionFacts
          definition={definition}
          dictionary={dictionary}
          viewState={viewState}
        />

        <FieldTable
          fields={definition.fields}
          caption={`Fields of ${definition.name}`}
        />

        <ValueShapeReferences
          definition={definition}
          dictionary={dictionary}
          viewState={viewState}
        />

        <RelationshipsSection
          definition={definition}
          dictionary={dictionary}
          viewState={viewState}
        />

        <ConstraintSection
          definition={definition}
          dictionary={dictionary}
          viewState={viewState}
        />
      </div>

      <div
        role="tabpanel"
        id={rawPanelId}
        aria-labelledby={rawTabId}
        hidden={viewState.tab !== "raw"}
      >
        <RawPanel
          title={`${definition.name} raw definition`}
          text={`${JSON.stringify(definition.raw, null, 2)}\n`}
          copyLabel="Copy definition"
        />
      </div>
    </article>
  );
}

export default DefinitionDetail;
