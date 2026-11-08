import {
  hrefForDefinition,
  hrefForDocument,
  hrefForSystem,
  hrefForViewState,
  parseViewState,
  toSearchParams,
} from "../viewState";
import type { SemanticLayerViewState } from "../../../types/semanticLayer";

const OVERVIEW: SemanticLayerViewState = {
  view: "overview",
  definitionKey: null,
  tab: "details",
  query: "",
  kind: "all",
  subject: null,
  aggregate: null,
};

function parse(search: string) {
  return parseViewState(new URLSearchParams(search));
}

describe("semantic layer view state", () => {
  it("defaults to the overview", () => {
    expect(parse("")).toEqual(OVERVIEW);
  });

  it("treats a definition without an explicit view as definition view", () => {
    expect(parse("def=Portfolio")).toEqual({
      ...OVERVIEW,
      view: "definition",
      definitionKey: "Portfolio",
    });
  });

  it("normalizes a definition view without a definition to overview", () => {
    expect(parse("view=definition")).toEqual(OVERVIEW);
  });

  it("normalizes unknown views, tabs, kinds, subjects, and aggregates", () => {
    expect(
      parse("view=unknown&tab=sideways&kind=weird&subject=moon&aggregate=mode"),
    ).toEqual(OVERVIEW);
    expect(parse("view=unknown&def=Portfolio")).toEqual(OVERVIEW);
  });

  it("normalizes the query", () => {
    expect(parse("q=++portfolio++holds++")).toEqual({
      ...OVERVIEW,
      query: "portfolio holds",
    });
  });

  it("truncates a query to 200 characters", () => {
    const query = "a".repeat(250);
    expect(parse(`q=${query}`).query).toHaveLength(200);
  });

  it("keeps all supported values", () => {
    expect(
      parse(
        "view=definition&def=FactType.market_price&tab=raw&q=close&kind=fact_type&subject=asset&aggregate=last",
      ),
    ).toEqual({
      view: "definition",
      definitionKey: "FactType.market_price",
      tab: "raw",
      query: "close",
      kind: "fact_type",
      subject: "asset",
      aggregate: "last",
    });
  });

  it("ignores definition and tab for non-definition views", () => {
    expect(parse("view=document&def=Portfolio&tab=raw")).toEqual({
      ...OVERVIEW,
      view: "document",
    });
    expect(parse("view=system&def=Portfolio&tab=raw")).toEqual({
      ...OVERVIEW,
      view: "system",
    });
  });

  it("serializes only non-default parameters", () => {
    expect(toSearchParams(OVERVIEW).toString()).toBe("");
    expect(
      toSearchParams({
        view: "definition",
        definitionKey: "Portfolio",
        tab: "raw",
        query: "q",
        kind: "entity",
        subject: "asset",
        aggregate: "sum",
      }).toString(),
    ).toBe(
      "view=definition&def=Portfolio&tab=raw&q=q&kind=entity&subject=asset&aggregate=sum",
    );
  });

  it("does not write a raw tab for non-definition views", () => {
    expect(
      toSearchParams({
        ...OVERVIEW,
        view: "document",
        tab: "raw",
      }).toString(),
    ).toBe("view=document");
  });

  it("builds hrefs for definitions, system, and document views", () => {
    expect(hrefForViewState(OVERVIEW)).toBe("/semantic-layer");
    expect(hrefForDefinition(OVERVIEW, "Portfolio")).toBe(
      "/semantic-layer?view=definition&def=Portfolio",
    );
    expect(hrefForDefinition({ ...OVERVIEW, tab: "raw" }, "Portfolio", "raw")).toBe(
      "/semantic-layer?view=definition&def=Portfolio&tab=raw",
    );
    expect(hrefForSystem(OVERVIEW)).toBe("/semantic-layer?view=system");
    expect(hrefForDocument(OVERVIEW)).toBe("/semantic-layer?view=document");
  });
});
