/** The JSON value type used for raw dictionary fragments. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/** The canonical dictionary response and the exact text that produced it. */
export interface SemanticLayerDocument {
  /** The parsed JSON document. */
  document: unknown;
  /** The exact response text, retained for raw view and download. */
  canonicalText: string;
}

/** The kind of a definition in the canonical dictionary. */
export type DefinitionKind =
  | "entity"
  | "fact_type"
  | "value_shape"
  | "union"
  | "other";

/** A declared document metadata block. */
export interface DocumentMetadata {
  schemaDialect: string;
  id: string;
  title: string;
  description: string;
  schemaVersion: string;
  modelVersion: string;
}

/** One declared field of a definition. */
export interface FieldModel {
  name: string;
  description: string | null;
  types: string[];
  nullable: boolean;
  required: boolean;
  writable: boolean | null;
  format: string | null;
  pattern: string | null;
  minLength: number | null;
  maxLength: number | null;
  minimum: number | null;
  maximum: number | null;
  itemType: string | null;
  enumValues: string[];
  knownValues: string[];
  unit: string | null;
  precision: number | null;
  scale: number | null;
  declaredMinimum: string | null;
  declaredMaximum: string | null;
  aggregates: string[];
  reference: string | null;
  synthetic: boolean;
  raw: unknown;
}

/** Fact-type metadata declared by `x-obolargus-fact-type`. */
export interface FactTypeMetadata {
  factType: string;
  displayName: string;
  subjects: string[];
  storageKind: string;
  aggregation: string;
  unit: string | null;
  observationKind: string | null;
  intervalSeconds: number | null;
  schemaVersion: number | null;
}

/** One union variant, for the `FactValue` definition. */
export interface DefinitionVariant {
  type: string;
  shapeRef: string | null;
}

/** A declared relationship between two definitions. */
export interface RelationshipDescriptor {
  from: string;
  to: string;
  label: string;
  cardinalityFrom: string;
  cardinalityTo: string;
}

/** A declared cross-field constraint. */
export interface ConstraintDescriptor {
  name: string;
  description: string;
  appliesTo: string[];
  targets: string[];
}

/** Incoming and outgoing relationships for one definition. */
export interface DefinitionRelationships {
  outgoing: RelationshipDescriptor[];
  incoming: RelationshipDescriptor[];
}

/** One named definition in the dictionary. */
export interface DictionaryDefinition {
  key: string;
  name: string;
  kind: DefinitionKind;
  description: string | null;
  fields: FieldModel[];
  required: string[];
  table: string | null;
  factType: FactTypeMetadata | null;
  valueShapeRef: string | null;
  variants: DefinitionVariant[];
  relationships: DefinitionRelationships;
  constraints: ConstraintDescriptor[];
  raw: unknown;
}

/** One inventory group of definitions. */
export interface DefinitionGroup {
  id: "entities" | "factTypes" | "valueShapes" | "other";
  label: string;
  description: string;
  definitions: DictionaryDefinition[];
  count: number;
}

/** Facet values available for filtering. */
export interface DictionaryFacets {
  subjects: string[];
  aggregates: string[];
}

/** Counts displayed by the overview. */
export interface DictionaryCounts {
  entities: number;
  factTypes: number;
  valueShapes: number;
  fields: number;
  relationships: number;
  invariants: number;
  constraints: number;
}

/** The searchable context of a definition. */
export interface DefinitionSearchEntry {
  kind: "definition";
  definitionKey: string;
  definitionKind: DefinitionKind;
  name: string;
  normalizedName: string;
  fieldNames: string[];
  fieldDescriptions: string[];
  knownValues: string[];
  relationshipLabels: string[];
  constraintText: string[];
  description: string;
}

/** The searchable context of document-level semantics. */
export interface SystemSearchEntry {
  kind: "system";
  name: string;
  normalizedName: string;
  relationshipLabels: string[];
  invariantText: string[];
  constraintText: string[];
  description: string;
}

/** Any search index entry. */
export type SearchEntry = DefinitionSearchEntry | SystemSearchEntry;

/** One ranked search result. */
export interface SearchResult {
  entry: SearchEntry;
  score: number;
  contexts: string[];
}

/** The complete UI view model of the canonical dictionary. */
export interface SemanticDictionary {
  canonicalText: string;
  metadata: DocumentMetadata;
  definitions: DictionaryDefinition[];
  byKey: Map<string, DictionaryDefinition>;
  groups: DefinitionGroup[];
  relationships: RelationshipDescriptor[];
  invariants: string[];
  constraints: ConstraintDescriptor[];
  referencingFactTypesByShape: Map<string, string[]>;
  facets: DictionaryFacets;
  counts: DictionaryCounts;
  searchIndex: SearchEntry[];
}

/** Top-level views available on the page. */
export type SemanticView = "overview" | "definition" | "system" | "document";

/** Detail tabs available on a definition view. */
export type SemanticTab = "details" | "raw";

/** Definition-kind filter values. */
export type KindFilter =
  | "all"
  | "entity"
  | "fact_type"
  | "value_shape"
  | "other";

/** The complete URL-driven view state. */
export interface SemanticLayerViewState {
  view: SemanticView;
  definitionKey: string | null;
  tab: SemanticTab;
  query: string;
  kind: KindFilter;
  subject: string | null;
  aggregate: string | null;
}
