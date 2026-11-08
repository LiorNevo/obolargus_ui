import { buildSemanticDictionary } from "../semanticDictionary";
import { buildSearchIndex, searchDictionary } from "../search";
import {
  semanticDictionaryCanonicalText,
  semanticDictionaryFixture,
} from "../__fixtures__/semanticDictionary";
import type { SemanticLayerViewState } from "../../../types/semanticLayer";

const BASE: SemanticLayerViewState = {
  view: "overview",
  definitionKey: null,
  tab: "details",
  query: "",
  kind: "all",
  subject: null,
  aggregate: null,
};

function dictionary() {
  return buildSemanticDictionary(
    semanticDictionaryFixture,
    semanticDictionaryCanonicalText,
  );
}

function search(
  query: string,
  patch: Partial<SemanticLayerViewState> = {},
) {
  const model = dictionary();
  return searchDictionary(model, { ...BASE, query, ...patch }, query);
}

describe("semantic layer search", () => {
  it("indexes definitions and one system entry", () => {
    const model = dictionary();
    const entries = buildSearchIndex(model);
    expect(entries.filter((entry) => entry.kind === "definition")).toHaveLength(
      model.definitions.length,
    );
    expect(entries.filter((entry) => entry.kind === "system")).toHaveLength(1);
  });

  it("finds a definition name and reports the match context", () => {
    const results = search("Portfolio");
    const portfolio = results.find(
      (result) =>
        result.entry.kind === "definition" &&
        result.entry.definitionKey === "Portfolio",
    );
    expect(portfolio).toBeDefined();
    expect(portfolio?.contexts).toContain("name");
  });

  it("finds a field name", () => {
    const results = search("quantity");
    expect(
      results.some(
        (result) =>
          result.entry.kind === "definition" &&
          result.entry.definitionKey === "Position",
      ),
    ).toBe(true);
    expect(
      results.flatMap((result) => result.contexts),
    ).toContain("field: quantity");
  });

  it("finds definition descriptions", () => {
    const results = search("DAG");
    expect(
      results.some(
        (result) =>
          result.entry.kind === "definition" &&
          result.entry.definitionKey === "Portfolio",
      ),
    ).toBe(true);
  });

  it("finds known vocabulary values", () => {
    const results = search("market_price");
    expect(
      results.some(
        (result) =>
          result.entry.kind === "definition" &&
          result.entry.definitionKey === "TemporalFact",
      ),
    ).toBe(true);
    expect(
      results.flatMap((result) => result.contexts),
    ).toContain("known value: market_price");
  });

  it("finds relationship labels", () => {
    const results = search("composes");
    expect(
      results.some(
        (result) =>
          result.entry.kind === "definition" &&
          result.entry.definitionKey === "Portfolio",
      ),
    ).toBe(true);
  });

  it("finds invariants and constraints through the system entry", () => {
    const invariantResults = search("DAG");
    expect(
      invariantResults.some((result) => result.entry.kind === "system"),
    ).toBe(true);
    const constraintResults = search("transfer");
    expect(
      constraintResults.some((result) => result.entry.kind === "system"),
    ).toBe(true);
    expect(
      constraintResults.some(
        (result) =>
          result.entry.kind === "definition" &&
          result.entry.definitionKey === "Event",
      ),
    ).toBe(true);
  });

  it("filters by definition kind", () => {
    const results = search("", { kind: "fact_type" });
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every(
        (result) =>
          result.entry.kind === "definition" &&
          result.entry.definitionKind === "fact_type",
      ),
    ).toBe(true);
    expect(results.some((result) => result.entry.kind === "system")).toBe(false);
  });

  it("filters by subject applicability", () => {
    const results = search("", { subject: "asset" });
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every(
        (result) =>
          result.entry.kind === "definition" &&
          dictionary().byKey
            .get(result.entry.definitionKey)
            ?.factType?.subjects.includes("asset"),
      ),
    ).toBe(true);
  });

  it("filters by aggregate", () => {
    const results = search("", { aggregate: "sum" });
    expect(
      results.some(
        (result) =>
          result.entry.kind === "definition" &&
          result.entry.definitionKey === "Position",
      ),
    ).toBe(true);
  });

  it("combines a query and a filter", () => {
    const results = search("open", { kind: "fact_type" });
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.some(
        (result) =>
          result.entry.kind === "definition" &&
          result.entry.definitionKey === "FactType.market_price",
      ),
    ).toBe(true);
  });

  it("returns no results for an unmatched query", () => {
    expect(search("zzzz-not-in-the-dictionary")).toEqual([]);
  });

  it("returns every definition for an empty query without the system entry", () => {
    const model = dictionary();
    const results = search("", {});
    expect(results).toHaveLength(model.definitions.length);
    expect(results.some((result) => result.entry.kind === "system")).toBe(false);
  });

  it("does not silently truncate results", () => {
    const model = dictionary();
    const results = search("", {});
    expect(results).toHaveLength(model.definitions.length);
  });
});
