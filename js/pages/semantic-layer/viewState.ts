import type {
  KindFilter,
  SemanticLayerViewState,
  SemanticTab,
  SemanticView,
} from "../../types/semanticLayer";

/** The registered page path. */
export const SEMANTIC_LAYER_PATH = "/semantic-layer";

const VIEWS: readonly SemanticView[] = [
  "overview",
  "definition",
  "system",
  "document",
];
const TABS: readonly SemanticTab[] = ["details", "raw"];
const KINDS: readonly KindFilter[] = [
  "all",
  "entity",
  "fact_type",
  "value_shape",
  "other",
];
const SUBJECTS = ["asset", "issuer", "portfolio"] as const;
const AGGREGATES = ["none", "sum", "avg", "min", "max", "last", "count"] as const;
const MAX_QUERY_LENGTH = 200;

function isOneOf<T extends string>(
  value: string | null,
  allowed: readonly T[],
): value is T {
  return value !== null && allowed.includes(value as T);
}

function normalizeQuery(value: string | null): string {
  if (!value) return "";
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
}

/**
 * Parses the URL query parameters into the explorer's canonical view state.
 *
 * Unknown values are normalized rather than rejected so a stale or malformed
 * bookmark always resolves to a defined view.
 */
export function parseViewState(
  params: URLSearchParams,
): SemanticLayerViewState {
  const rawView = params.get("view");
  const rawDefinition = params.get("def")?.trim() || null;
  const hasDefinition = rawDefinition !== null;

  let view: SemanticView;
  if (rawView === null) {
    view = hasDefinition ? "definition" : "overview";
  } else if (isOneOf(rawView, VIEWS)) {
    view = rawView;
  } else {
    view = "overview";
  }

  if (view === "definition" && !hasDefinition) view = "overview";

  const rawTab = params.get("tab");
  let tab: SemanticTab = isOneOf(rawTab, TABS) ? rawTab : "details";
  if (view !== "definition") tab = "details";

  const rawKind = params.get("kind");
  const kind: KindFilter = isOneOf(rawKind, KINDS) ? rawKind : "all";

  const rawSubject = params.get("subject");
  const subject = isOneOf(rawSubject, SUBJECTS) ? rawSubject : null;

  const rawAggregate = params.get("aggregate");
  const aggregate = isOneOf(rawAggregate, AGGREGATES)
    ? rawAggregate
    : null;

  return {
    view,
    definitionKey: view === "definition" ? rawDefinition : null,
    tab,
    query: normalizeQuery(params.get("q")),
    kind,
    subject,
    aggregate,
  };
}

/**
 * Serializes the view state, omitting defaults and empty values.
 */
export function toSearchParams(state: SemanticLayerViewState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.view !== "overview") params.set("view", state.view);
  if (state.view === "definition" && state.definitionKey) {
    params.set("def", state.definitionKey);
    if (state.tab === "raw") params.set("tab", "raw");
  }
  if (state.query) params.set("q", state.query);
  if (state.kind !== "all") params.set("kind", state.kind);
  if (state.subject) params.set("subject", state.subject);
  if (state.aggregate) params.set("aggregate", state.aggregate);
  return params;
}

/** Returns a router-ready href for the given view state. */
export function hrefForViewState(state: SemanticLayerViewState): string {
  const search = toSearchParams(state).toString();
  return search ? `${SEMANTIC_LAYER_PATH}?${search}` : SEMANTIC_LAYER_PATH;
}

/** Builds the href for a definition while preserving the current search. */
export function hrefForDefinition(
  state: SemanticLayerViewState,
  definitionKey: string,
  tab: SemanticTab = "details",
): string {
  return hrefForViewState({
    ...state,
    view: "definition",
    definitionKey,
    tab,
  });
}

/** Builds the href for the system-semantics view. */
export function hrefForSystem(state: SemanticLayerViewState): string {
  return hrefForViewState({ ...state, view: "system", definitionKey: null });
}

/** Builds the href for the whole-document raw view. */
export function hrefForDocument(state: SemanticLayerViewState): string {
  return hrefForViewState({
    ...state,
    view: "document",
    definitionKey: null,
    tab: "details",
  });
}
