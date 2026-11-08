import { Link } from "react-router-dom";
import type {
  RelationshipDescriptor,
  SemanticDictionary,
  SemanticLayerViewState,
} from "../../types/semanticLayer";
import { hrefForDefinition } from "./viewState";

function EndpointLink({
  keyName,
  dictionary,
  viewState,
}: {
  keyName: string;
  dictionary: SemanticDictionary;
  viewState: SemanticLayerViewState;
}) {
  if (!dictionary.byKey.has(keyName)) {
    return <span>{keyName} (unresolved)</span>;
  }
  return <Link to={hrefForDefinition(viewState, keyName)}>{keyName}</Link>;
}

/** Props for the document-level semantics view. */
export interface SystemSemanticsProps {
  dictionary: SemanticDictionary;
  viewState: SemanticLayerViewState;
}

/**
 * Shows every relationship, invariant, and cross-field constraint declared by
 * the canonical dictionary.
 */
export function SystemSemantics({
  dictionary,
  viewState,
}: SystemSemanticsProps) {
  const grouped = new Map<string, RelationshipDescriptor[]>();
  for (const relationship of dictionary.relationships) {
    const existing = grouped.get(relationship.from) ?? [];
    existing.push(relationship);
    grouped.set(relationship.from, existing);
  }

  return (
    <div className="obolargus_semantic_system">
      <div className="obolargus_semantic_section_header">
        <h2>System semantics</h2>
        <p>
          Document-level relationships, invariants, and constraints from the
          canonical dictionary.
        </p>
      </div>

      <section
        className="obolargus_semantic_section"
        aria-labelledby="system-relationships"
      >
        <h3 id="system-relationships">Relationships</h3>
        {dictionary.relationships.length === 0 ? (
          <p className="obolargus_semantic_muted">
            No relationships declared.
          </p>
        ) : (
          <div className="obolargus_semantic_relationship_groups">
            {[...grouped.entries()].map(([from, relationships]) => (
              <section key={from} aria-label={`Relationships from ${from}`}>
                <h4>{from}</h4>
                <ul>
                  {relationships.map((relationship, index) => (
                    <li key={`${relationship.to}-${relationship.label}-${index}`}>
                      <span className="obolargus_semantic_relationship_label">
                        {relationship.label}
                      </span>{" "}
                      <EndpointLink
                        keyName={relationship.to}
                        dictionary={dictionary}
                        viewState={viewState}
                      />
                      <span className="obolargus_semantic_muted">
                        {" "}
                        ({relationship.cardinalityFrom} →{" "}
                        {relationship.cardinalityTo})
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>

      <section
        className="obolargus_semantic_section"
        aria-labelledby="system-invariants"
      >
        <h3 id="system-invariants">Invariants</h3>
        {dictionary.invariants.length === 0 ? (
          <p className="obolargus_semantic_muted">No invariants declared.</p>
        ) : (
          <ol>
            {dictionary.invariants.map((invariant) => (
              <li key={invariant}>{invariant}</li>
            ))}
          </ol>
        )}
      </section>

      <section
        className="obolargus_semantic_section"
        aria-labelledby="system-constraints"
      >
        <h3 id="system-constraints">Cross-field constraints</h3>
        {dictionary.constraints.length === 0 ? (
          <p className="obolargus_semantic_muted">
            No cross-field constraints declared.
          </p>
        ) : (
          <ul className="obolargus_semantic_constraint_list">
            {dictionary.constraints.map((constraint) => (
              <li key={constraint.name}>
                <strong>{constraint.name}</strong>
                <p>{constraint.description}</p>
                <p className="obolargus_semantic_muted">
                  Applies to:{" "}
                  {constraint.appliesTo.map((target, index) => (
                    <span key={target}>
                      {index > 0 ? " / " : null}
                      <EndpointLink
                        keyName={target}
                        dictionary={dictionary}
                        viewState={viewState}
                      />
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default SystemSemantics;
