import type {
  DefinitionSearchEntry,
  SearchEntry,
  SearchResult,
  SemanticDictionary,
  SemanticLayerViewState,
  SystemSearchEntry,
} from "../../types/semanticLayer";

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function matchesText(
  value: string,
  query: string,
): "exact" | "prefix" | "substring" | null {
  if (!query) return null;
  if (value === query) return "exact";
  if (value.startsWith(query)) return "prefix";
  return value.includes(query) ? "substring" : null;
}

function pushMatch(
  contexts: string[],
  score: { value: number },
  label: string,
  value: string,
  query: string,
  weights: readonly [number, number, number],
): void {
  const match = matchesText(normalize(value), query);
  if (!match) return;
  const index = match === "exact" ? 0 : match === "prefix" ? 1 : 2;
  score.value = Math.max(score.value, weights[index]);
  contexts.push(label);
}

/**
 * Builds the searchable index for one dictionary.
 *
 * Document-level invariants and relationships are indexed on the single system
 * entry, not copied into every definition.
 */
export function buildSearchIndex(
  dictionary: SemanticDictionary,
): SearchEntry[] {
  const definitions: DefinitionSearchEntry[] = dictionary.definitions.map(
    (definition) => ({
      kind: "definition",
      definitionKey: definition.key,
      definitionKind: definition.kind,
      name: definition.name,
      normalizedName: normalize(definition.name),
      fieldNames: definition.fields.map((field) => field.name),
      fieldDescriptions: definition.fields
        .map((field) => field.description ?? "")
        .filter(Boolean),
      knownValues: unique(
        definition.fields.flatMap((field) => [
          ...field.knownValues,
          ...field.enumValues,
        ]),
      ),
      relationshipLabels: unique([
        ...definition.relationships.outgoing.map(
          (relationship) => relationship.label,
        ),
        ...definition.relationships.incoming.map(
          (relationship) => relationship.label,
        ),
      ]),
      constraintText: unique(
        definition.constraints.flatMap((constraint) => [
          constraint.name,
          constraint.description,
        ]),
      ),
      description: definition.description ?? "",
    }),
  );

  const system: SystemSearchEntry = {
    kind: "system",
    name: "System semantics",
    normalizedName: "system semantics",
    relationshipLabels: unique(
      dictionary.relationships.map((relationship) => relationship.label),
    ),
    invariantText: dictionary.invariants,
    constraintText: unique(
      dictionary.constraints.flatMap((constraint) => [
        constraint.name,
        constraint.description,
      ]),
    ),
    description:
      "Document-level relationships, invariants, and cross-field constraints.",
  };

  return [...definitions, system];
}

function matchesKind(
  entry: DefinitionSearchEntry,
  kind: SemanticLayerViewState["kind"],
): boolean {
  if (kind === "all") return true;
  if (kind === "value_shape") {
    return entry.definitionKind === "value_shape" || entry.definitionKind === "union";
  }
  return entry.definitionKind === kind;
}

function matchesFilters(
  entry: SearchEntry,
  dictionary: SemanticDictionary,
  state: SemanticLayerViewState,
): boolean {
  if (entry.kind === "system") {
    return state.kind === "all" && !state.subject && !state.aggregate;
  }
  if (!matchesKind(entry, state.kind)) return false;

  const definition = dictionary.byKey.get(entry.definitionKey);
  if (state.subject) {
    if (!definition?.factType?.subjects.includes(state.subject)) return false;
  }
  if (state.aggregate) {
    const factAggregate = definition?.factType?.aggregation;
    const fieldAggregate = definition?.fields.some((field) =>
      field.aggregates.includes(state.aggregate as string),
    );
    if (factAggregate !== state.aggregate && !fieldAggregate) return false;
  }
  return true;
}

function scoreEntry(entry: SearchEntry, query: string): SearchResult | null {
  if (!query) return { entry, score: 0, contexts: [] };
  const contexts: string[] = [];
  const score = { value: 0 };

  pushMatch(contexts, score, "name", entry.name, query, [1000, 800, 600]);
  pushMatch(
    contexts,
    score,
    "description",
    entry.description,
    query,
    [90, 80, 70],
  );

  if (entry.kind === "definition") {
    for (const fieldName of entry.fieldNames) {
      pushMatch(
        contexts,
        score,
        `field: ${fieldName}`,
        fieldName,
        query,
        [500, 400, 300],
      );
    }
    for (const fieldDescription of entry.fieldDescriptions) {
      pushMatch(
        contexts,
        score,
        "field description",
        fieldDescription,
        query,
        [120, 110, 100],
      );
    }
    for (const knownValue of entry.knownValues) {
      pushMatch(
        contexts,
        score,
        `known value: ${knownValue}`,
        knownValue,
        query,
        [260, 220, 180],
      );
    }
    for (const label of entry.relationshipLabels) {
      pushMatch(
        contexts,
        score,
        `relationship: ${label}`,
        label,
        query,
        [170, 160, 150],
      );
    }
    for (const constraint of entry.constraintText) {
      pushMatch(
        contexts,
        score,
        "constraint",
        constraint,
        query,
        [140, 130, 120],
      );
    }
  } else {
    for (const label of entry.relationshipLabels) {
      pushMatch(
        contexts,
        score,
        `relationship: ${label}`,
        label,
        query,
        [170, 160, 150],
      );
    }
    for (const invariant of entry.invariantText) {
      pushMatch(
        contexts,
        score,
        "invariant",
        invariant,
        query,
        [140, 130, 120],
      );
    }
    for (const constraint of entry.constraintText) {
      pushMatch(
        contexts,
        score,
        "constraint",
        constraint,
        query,
        [140, 130, 120],
      );
    }
  }

  if (score.value === 0) return null;
  return { entry, score: score.value, contexts: unique(contexts) };
}

/**
 * Searches and filters the dictionary, returning every match without silent
 * truncation. An empty query matches every definition but does not surface the
 * system entry.
 */
export function searchDictionary(
  dictionary: SemanticDictionary,
  state: SemanticLayerViewState,
  query: string = state.query,
): SearchResult[] {
  const normalizedQuery = normalize(query);
  const results: SearchResult[] = [];
  for (const entry of dictionary.searchIndex) {
    if (!matchesFilters(entry, dictionary, state)) continue;
    if (entry.kind === "system" && !normalizedQuery) continue;
    const result = scoreEntry(entry, normalizedQuery);
    if (result) results.push(result);
  }
  return results.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.entry.name.localeCompare(right.entry.name);
  });
}
