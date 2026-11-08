import { Link } from "react-router-dom";
import type {
  DictionaryDefinition,
  RelationshipDescriptor,
  SemanticDictionary,
  SemanticLayerViewState,
} from "../../types/semanticLayer";
import { hrefForDefinition } from "./viewState";

function Endpoint({
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

function RelationshipRow({
  relationship,
  direction,
  dictionary,
  viewState,
}: {
  relationship: RelationshipDescriptor;
  direction: "incoming" | "outgoing";
  dictionary: SemanticDictionary;
  viewState: SemanticLayerViewState;
}) {
  const self = relationship.from === relationship.to;
  return (
    <li>
      <span className="obolargus_semantic_relationship_label">
        {relationship.label}
      </span>{" "}
      {direction === "outgoing" ? (
        <>
          <Endpoint
            keyName={relationship.to}
            dictionary={dictionary}
            viewState={viewState}
          />
          <span className="obolargus_semantic_muted">
            {" "}
            ({relationship.cardinalityFrom} → {relationship.cardinalityTo})
          </span>
        </>
      ) : (
        <>
          <Endpoint
            keyName={relationship.from}
            dictionary={dictionary}
            viewState={viewState}
          />
          <span className="obolargus_semantic_muted">
            {" "}
            ({relationship.cardinalityFrom} → {relationship.cardinalityTo})
          </span>
        </>
      )}
      {self ? <span className="obolargus_semantic_badge">self</span> : null}
    </li>
  );
}

/** Props for the relationship section of a definition. */
export interface RelationshipsSectionProps {
  definition: DictionaryDefinition;
  dictionary: SemanticDictionary;
  viewState: SemanticLayerViewState;
}

/**
 * Renders incoming and outgoing relationships for one definition.
 */
export function RelationshipsSection({
  definition,
  dictionary,
  viewState,
}: RelationshipsSectionProps) {
  const { incoming, outgoing } = definition.relationships;
  return (
    <section
      className="obolargus_semantic_section"
      aria-labelledby={`relationships-${definition.key}`}
    >
      <h3 id={`relationships-${definition.key}`}>Relationships</h3>
      {incoming.length === 0 && outgoing.length === 0 ? (
        <p className="obolargus_semantic_muted">
          No relationships declared.
        </p>
      ) : (
        <div className="obolargus_semantic_relationship_columns">
          <div>
            <h4>Outgoing</h4>
            {outgoing.length > 0 ? (
              <ul>
                {outgoing.map((relationship, index) => (
                  <RelationshipRow
                    key={`${relationship.from}-${relationship.to}-${relationship.label}-${index}`}
                    relationship={relationship}
                    direction="outgoing"
                    dictionary={dictionary}
                    viewState={viewState}
                  />
                ))}
              </ul>
            ) : (
              <p className="obolargus_semantic_muted">None.</p>
            )}
          </div>
          <div>
            <h4>Incoming</h4>
            {incoming.length > 0 ? (
              <ul>
                {incoming.map((relationship, index) => (
                  <RelationshipRow
                    key={`${relationship.from}-${relationship.to}-${relationship.label}-${index}`}
                    relationship={relationship}
                    direction="incoming"
                    dictionary={dictionary}
                    viewState={viewState}
                  />
                ))}
              </ul>
            ) : (
              <p className="obolargus_semantic_muted">None.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default RelationshipsSection;
