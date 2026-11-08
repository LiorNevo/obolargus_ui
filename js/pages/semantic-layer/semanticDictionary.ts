import type {
  ConstraintDescriptor,
  DefinitionGroup,
  DefinitionKind,
  DefinitionVariant,
  DictionaryCounts,
  DictionaryDefinition,
  DictionaryFacets,
  FactTypeMetadata,
  FieldModel,
  RelationshipDescriptor,
  SemanticDictionary,
} from "../../types/semanticLayer";
import { buildSearchIndex } from "./search";

type JsonObject = Record<string, unknown>;

/** The reason the canonical dictionary could not be turned into a view model. */
export type SemanticDictionaryErrorKind = "incomplete" | "empty" | "invalid";

/** A typed failure while constructing the explorer view model. */
export class SemanticDictionaryError extends Error {
  readonly kind: SemanticDictionaryErrorKind;
  readonly missing: string[];

  constructor(
    kind: SemanticDictionaryErrorKind,
    message: string,
    missing: string[] = [],
  ) {
    super(message);
    this.name = "SemanticDictionaryError";
    this.kind = kind;
    this.missing = missing;
  }
}

const REQUIRED_MEMBERS = [
  "$schema",
  "$id",
  "title",
  "description",
  "x-obolargus-schema-version",
  "x-obolargus-model-version",
  "x-obolargus-relationships",
  "x-obolargus-invariants",
  "x-obolargus-cross-field-constraints",
  "$defs",
] as const;

const SUBJECT_ORDER = ["asset", "issuer", "portfolio"] as const;
const AGGREGATE_ORDER = [
  "none",
  "sum",
  "avg",
  "min",
  "max",
  "last",
  "count",
] as const;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function asDeclaredString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function refName(value: unknown): string | null {
  const reference = asString(value);
  if (!reference) return null;
  const prefix = "#/$defs/";
  return reference.startsWith(prefix) ? reference.slice(prefix.length) : reference;
}

function readTypeList(value: unknown): string[] {
  if (typeof value === "string") return [value];
  return asStringList(value);
}

function buildField(
  name: string,
  raw: unknown,
  requiredNames: readonly string[],
): FieldModel {
  const field = isObject(raw) ? raw : {};
  const rawTypes = readTypeList(field.type);
  const nullable = rawTypes.includes("null") || asBoolean(field.nullable) === true;
  const items = isObject(field.items) ? field.items : null;
  return {
    name,
    description: asString(field.description),
    types: rawTypes.filter((type) => type !== "null"),
    nullable,
    required: requiredNames.includes(name),
    writable: asBoolean(field["x-obolargus-writable"]),
    format: asString(field.format),
    pattern: asString(field.pattern),
    minLength: asNumber(field.minLength),
    maxLength: asNumber(field.maxLength),
    minimum: asNumber(field.minimum),
    maximum: asNumber(field.maximum),
    itemType: items ? readTypeList(items.type)[0] ?? null : null,
    enumValues: asStringList(field.enum),
    knownValues: asStringList(field["x-obolargus-known-values"]),
    unit: asString(field["x-obolargus-unit"]),
    precision: asNumber(field["x-obolargus-precision"]),
    scale: asNumber(field["x-obolargus-scale"]),
    declaredMinimum: asDeclaredString(field["x-obolargus-minimum"]),
    declaredMaximum: asDeclaredString(field["x-obolargus-maximum"]),
    aggregates: asStringList(field["x-obolargus-aggregates"]),
    reference: refName(field.$ref),
    synthetic: false,
    raw,
  };
}

function buildFields(properties: unknown, required: readonly string[]): FieldModel[] {
  if (!isObject(properties)) return [];
  return Object.entries(properties).map(([name, raw]) =>
    buildField(name, raw, required),
  );
}

function readFactTypeMetadata(raw: unknown): FactTypeMetadata | null {
  if (!isObject(raw)) return null;
  return {
    factType: asString(raw.fact_type) ?? "",
    displayName: asString(raw.display_name) ?? "",
    subjects: asStringList(raw.subjects),
    storageKind: asString(raw.storage_kind) ?? "",
    aggregation: asString(raw.aggregation) ?? "none",
    unit: asString(raw.unit),
    observationKind: asString(raw.observation_kind),
    intervalSeconds: asNumber(raw.interval_seconds),
    schemaVersion: asNumber(raw.schema_version),
  };
}

function buildVariants(raw: JsonObject): DefinitionVariant[] {
  if (!Array.isArray(raw.oneOf)) return [];
  return raw.oneOf.flatMap((variant) => {
    if (!isObject(variant)) return [];
    const properties = isObject(variant.properties) ? variant.properties : {};
    const typeProperty = isObject(properties.type) ? properties.type : {};
    const valueProperty = isObject(properties.value) ? properties.value : {};
    const type = asString(typeProperty.const);
    if (!type) return [];
    return [{ type, shapeRef: refName(valueProperty.$ref) }];
  });
}

function buildDefinition(key: string, raw: unknown): DictionaryDefinition {
  const definition = isObject(raw) ? raw : {};
  const factType = readFactTypeMetadata(definition["x-obolargus-fact-type"]);
  const entityName = asString(definition["x-obolargus-entity"]);
  const isFactType = factType !== null;
  const isValueShape = key.startsWith("FactValue.");
  const isUnion = key === "FactValue";
  const kind: DefinitionKind = entityName
    ? "entity"
    : isFactType
      ? "fact_type"
      : isUnion
        ? "union"
        : isValueShape
          ? "value_shape"
          : "other";
  const required = asStringList(definition.required);
  const properties = isObject(definition.properties) ? definition.properties : {};
  const valueProperty = isObject(properties.value) ? properties.value : {};

  return {
    key,
    name: entityName ?? factType?.displayName ?? key,
    kind,
    description: asString(definition.description),
    fields:
      kind === "union"
        ? []
        : isFactType
          ? []
          : buildFields(properties, required),
    required,
    table: asString(definition["x-obolargus-table"]),
    factType,
    valueShapeRef: isFactType ? refName(valueProperty.$ref) : null,
    variants: isUnion ? buildVariants(definition) : [],
    relationships: { outgoing: [], incoming: [] },
    constraints: [],
    raw,
  };
}

function syntheticScalarField(
  shape: DictionaryDefinition,
  factType: FactTypeMetadata,
): FieldModel {
  const raw = isObject(shape.raw) ? shape.raw : {};
  return {
    name: "value",
    description: asString(raw.description),
    types: readTypeList(raw.type).filter((type) => type !== "null"),
    nullable: readTypeList(raw.type).includes("null"),
    required: true,
    writable: null,
    format: asString(raw.format),
    pattern: asString(raw.pattern),
    minLength: asNumber(raw.minLength),
    maxLength: asNumber(raw.maxLength),
    minimum: asNumber(raw.minimum),
    maximum: asNumber(raw.maximum),
    itemType: null,
    enumValues: asStringList(raw.enum),
    knownValues: asStringList(raw["x-obolargus-known-values"]),
    unit: factType.unit,
    precision: asNumber(raw["x-obolargus-precision"]),
    scale: asNumber(raw["x-obolargus-scale"]),
    declaredMinimum: asDeclaredString(raw["x-obolargus-minimum"]),
    declaredMaximum: asDeclaredString(raw["x-obolargus-maximum"]),
    aggregates:
      factType.aggregation && factType.aggregation !== "none"
        ? [factType.aggregation]
        : [],
    reference: shape.key,
    synthetic: true,
    raw,
  };
}

function resolveFactTypeFields(
  definition: DictionaryDefinition,
  byKey: Map<string, DictionaryDefinition>,
): void {
  const shapeKey = definition.valueShapeRef;
  if (!shapeKey) return;
  const shape = byKey.get(shapeKey);
  if (!shape) return;
  if (shape.kind === "value_shape" && shape.fields.length > 0) {
    definition.fields = shape.fields;
    return;
  }
  if (shape.kind === "value_shape" && definition.factType) {
    definition.fields = [syntheticScalarField(shape, definition.factType)];
  }
}

function buildRelationships(
  value: unknown,
  byKey: Map<string, DictionaryDefinition>,
): RelationshipDescriptor[] {
  if (!Array.isArray(value)) return [];
  const relationships: RelationshipDescriptor[] = [];
  for (const item of value) {
    if (!isObject(item)) continue;
    const from = asString(item.from);
    const to = asString(item.to);
    const label = asString(item.label);
    if (!from || !to || !label) continue;
    const relationship: RelationshipDescriptor = {
      from,
      to,
      label,
      cardinalityFrom: asString(item.cardinality_from) ?? "",
      cardinalityTo: asString(item.cardinality_to) ?? "",
    };
    relationships.push(relationship);
    byKey.get(from)?.relationships.outgoing.push(relationship);
    byKey.get(to)?.relationships.incoming.push(relationship);
  }
  return relationships;
}

function buildConstraints(
  value: unknown,
  byKey: Map<string, DictionaryDefinition>,
): ConstraintDescriptor[] {
  if (!Array.isArray(value)) return [];
  const constraints: ConstraintDescriptor[] = [];
  for (const item of value) {
    if (!isObject(item)) continue;
    const name = asString(item.name);
    const description = asString(item.description);
    if (!name || !description) continue;
    const appliesTo = (asString(item.applies_to) ?? "")
      .split("/")
      .map((entry) => entry.trim())
      .filter(Boolean);
    const constraint: ConstraintDescriptor = {
      name,
      description,
      appliesTo,
      targets: appliesTo.filter((target) => byKey.has(target)),
    };
    constraints.push(constraint);
    for (const target of constraint.targets) {
      byKey.get(target)?.constraints.push(constraint);
    }
  }
  return constraints;
}

function buildFacets(
  definitions: readonly DictionaryDefinition[],
): DictionaryFacets {
  const subjects = new Set<string>();
  const aggregates = new Set<string>();
  for (const definition of definitions) {
    if (definition.factType) {
      definition.factType.subjects.forEach((subject) => subjects.add(subject));
      aggregates.add(definition.factType.aggregation);
    }
    definition.fields.forEach((field) =>
      field.aggregates.forEach((aggregate) => aggregates.add(aggregate)),
    );
  }
  return {
    subjects: SUBJECT_ORDER.filter((subject) => subjects.has(subject)),
    aggregates: AGGREGATE_ORDER.filter((aggregate) => aggregates.has(aggregate)),
  };
}

function buildCounts(
  definitions: readonly DictionaryDefinition[],
  relationships: readonly RelationshipDescriptor[],
  invariants: readonly string[],
  constraints: readonly ConstraintDescriptor[],
): DictionaryCounts {
  const valueShapes = definitions.filter(
    (definition) =>
      definition.kind === "value_shape" || definition.kind === "union",
  );
  return {
    entities: definitions.filter((definition) => definition.kind === "entity")
      .length,
    factTypes: definitions.filter(
      (definition) => definition.kind === "fact_type",
    ).length,
    valueShapes: valueShapes.length,
    fields: definitions
      .flatMap((definition) => definition.fields)
      .filter((field) => !field.synthetic).length,
    relationships: relationships.length,
    invariants: invariants.length,
    constraints: constraints.length,
  };
}

function buildGroups(
  definitions: readonly DictionaryDefinition[],
): DefinitionGroup[] {
  const entities = definitions.filter(
    (definition) => definition.kind === "entity",
  );
  const factTypes = definitions.filter(
    (definition) => definition.kind === "fact_type",
  );
  const valueShapes = definitions.filter(
    (definition) =>
      definition.kind === "value_shape" || definition.kind === "union",
  );
  const other = definitions.filter((definition) => definition.kind === "other");
  const groups: DefinitionGroup[] = [
    {
      id: "entities",
      label: "Domain entities",
      description: "Persisted domain entities in the canonical dictionary.",
      definitions: entities,
      count: entities.length,
    },
    {
      id: "factTypes",
      label: "Fact types",
      description: "Catalog fact types and their subject applicability.",
      definitions: factTypes,
      count: factTypes.length,
    },
    {
      id: "valueShapes",
      label: "Fact value shapes",
      description: "Reusable typed shapes used by fact type values.",
      definitions: valueShapes,
      count: valueShapes.length,
    },
  ];
  if (other.length > 0) {
    groups.push({
      id: "other",
      label: "Other definitions",
      description: "Definitions that do not declare a recognized dictionary kind.",
      definitions: other,
      count: other.length,
    });
  }
  return groups;
}

/**
 * Builds the explorer view model from the canonical dictionary document.
 *
 * @throws {SemanticDictionaryError} When the envelope is incomplete, empty, or
 * not an object.
 */
export function buildSemanticDictionary(
  document: unknown,
  canonicalText: string,
): SemanticDictionary {
  if (!isObject(document)) {
    throw new SemanticDictionaryError(
      "invalid",
      "The dictionary response was not a JSON object.",
    );
  }

  const missing = REQUIRED_MEMBERS.filter((member) => !(member in document));
  if (missing.length > 0) {
    throw new SemanticDictionaryError(
      "incomplete",
      `The dictionary is missing required members: ${missing.join(", ")}.`,
      missing,
    );
  }

  const definitionsRaw = document.$defs;
  if (!isObject(definitionsRaw)) {
    throw new SemanticDictionaryError(
      "incomplete",
      "The dictionary $defs member must be an object.",
      ["$defs"],
    );
  }
  const entries = Object.entries(definitionsRaw);
  if (entries.length === 0) {
    throw new SemanticDictionaryError(
      "empty",
      "The canonical dictionary contains no definitions.",
    );
  }

  const arrayMembers = [
    "x-obolargus-relationships",
    "x-obolargus-invariants",
    "x-obolargus-cross-field-constraints",
  ];
  const invalidArray = arrayMembers.find(
    (member) => !Array.isArray(document[member]),
  );
  if (invalidArray) {
    throw new SemanticDictionaryError(
      "incomplete",
      `The dictionary ${invalidArray} member must be an array.`,
      [invalidArray],
    );
  }

  const definitions = entries.map(([key, raw]) => buildDefinition(key, raw));
  const byKey = new Map(definitions.map((definition) => [definition.key, definition]));

  for (const definition of definitions) {
    if (definition.kind === "fact_type") {
      resolveFactTypeFields(definition, byKey);
    }
  }

  const relationships = buildRelationships(
    document["x-obolargus-relationships"],
    byKey,
  );
  const invariants = asStringList(document["x-obolargus-invariants"]);
  const constraints = buildConstraints(
    document["x-obolargus-cross-field-constraints"],
    byKey,
  );

  const referencingFactTypesByShape = new Map<string, string[]>();
  for (const definition of definitions) {
    if (definition.kind !== "fact_type" || !definition.valueShapeRef) continue;
    const existing =
      referencingFactTypesByShape.get(definition.valueShapeRef) ?? [];
    existing.push(definition.key);
    referencingFactTypesByShape.set(definition.valueShapeRef, existing);
  }

  const dictionary: SemanticDictionary = {
    canonicalText,
    metadata: {
      schemaDialect: asString(document.$schema) ?? "",
      id: asString(document.$id) ?? "",
      title: asString(document.title) ?? "",
      description: asString(document.description) ?? "",
      schemaVersion: asString(document["x-obolargus-schema-version"]) ?? "",
      modelVersion: asString(document["x-obolargus-model-version"]) ?? "",
    },
    definitions,
    byKey,
    groups: buildGroups(definitions),
    relationships,
    invariants,
    constraints,
    referencingFactTypesByShape,
    facets: buildFacets(definitions),
    counts: buildCounts(definitions, relationships, invariants, constraints),
    searchIndex: [],
  };
  dictionary.searchIndex = buildSearchIndex(dictionary);
  return dictionary;
}
