import {
  SemanticDictionaryError,
  buildSemanticDictionary,
} from "../semanticDictionary";
import {
  semanticDictionaryCanonicalText,
  semanticDictionaryFixture,
} from "../__fixtures__/semanticDictionary";

function dictionary() {
  return buildSemanticDictionary(
    semanticDictionaryFixture,
    semanticDictionaryCanonicalText,
  );
}

describe("semantic dictionary view model", () => {
  it("builds metadata, groups, and counts", () => {
    const model = dictionary();

    expect(model.metadata.title).toBe("Obolargus System Data Dictionary");
    expect(model.metadata.schemaVersion).toBe("1.0.0");
    expect(model.metadata.modelVersion).toBe("0.1.0");
    expect(model.groups.map((group) => group.id)).toEqual([
      "entities",
      "factTypes",
      "valueShapes",
    ]);
    expect(model.counts.entities).toBe(7);
    expect(model.counts.factTypes).toBe(3);
    expect(model.counts.valueShapes).toBe(8);
    expect(model.counts.relationships).toBe(5);
    expect(model.counts.invariants).toBe(2);
    expect(model.counts.constraints).toBe(2);
  });

  it("keeps required and nullable independent", () => {
    const portfolio = dictionary().byKey.get("Portfolio");
    expect(portfolio).toBeDefined();
    const name = portfolio?.fields.find((field) => field.name === "name");
    const parent = portfolio?.fields.find((field) => field.name === "parent_id");
    expect(name?.required).toBe(true);
    expect(name?.nullable).toBe(false);
    expect(parent?.required).toBe(false);
    expect(parent?.nullable).toBe(true);
    expect(parent?.writable).toBe(true);
  });

  it("extracts observation fact fields and exact metadata", () => {
    const marketPrice = dictionary().byKey.get("FactType.market_price");
    expect(marketPrice?.factType?.subjects).toEqual(["asset"]);
    expect(marketPrice?.factType?.storageKind).toBe("market_observation");
    expect(marketPrice?.valueShapeRef).toBe("FactValue.market_price");
    const open = marketPrice?.fields.find((field) => field.name === "open");
    expect(open).toMatchObject({
      unit: "USD",
      precision: 38,
      scale: 18,
      declaredMinimum: "0",
      aggregates: ["min", "max", "last"],
      required: true,
      synthetic: false,
    });
    expect(open?.pattern).toContain("[1-9]");
  });

  it("creates a synthetic scalar value field for scalar fact types", () => {
    const nav = dictionary().byKey.get("FactType.nav");
    expect(nav?.fields).toHaveLength(1);
    expect(nav?.fields[0]).toMatchObject({
      name: "value",
      required: true,
      nullable: false,
      unit: "USD",
      synthetic: true,
      reference: "FactValue.decimal",
    });
    expect(nav?.fields[0].types).toEqual(["string"]);
  });

  it("resolves value shapes and reverse references", () => {
    const model = dictionary();
    const textShape = model.byKey.get("FactValue.text");
    expect(textShape?.kind).toBe("value_shape");
    expect(model.referencingFactTypesByShape.get("FactValue.text")).toEqual([
      "FactType.name",
    ]);
    expect(model.byKey.get("FactValue.market_price")?.fields).toHaveLength(8);
  });

  it("keeps union variants", () => {
    const union = dictionary().byKey.get("FactValue");
    expect(union?.kind).toBe("union");
    expect(union?.variants.map((variant) => variant.type)).toEqual([
      "text",
      "decimal",
      "integer",
      "boolean",
      "date",
      "timestamp",
      "market_price",
    ]);
  });

  it("maps incoming and outgoing relationships including self references", () => {
    const portfolio = dictionary().byKey.get("Portfolio");
    expect(
      portfolio?.relationships.outgoing.some(
        (relationship) => relationship.label === "composes",
      ),
    ).toBe(true);
    expect(
      portfolio?.relationships.incoming.some(
        (relationship) => relationship.label === "composes",
      ),
    ).toBe(true);
    expect(
      portfolio?.relationships.outgoing.some(
        (relationship) => relationship.label === "holds",
      ),
    ).toBe(true);
  });

  it("maps constraints including composite targets", () => {
    const model = dictionary();
    const event = model.byKey.get("Event");
    expect(event?.constraints.map((constraint) => constraint.name)).toContain(
      "transfer_requires_destination",
    );
    const composite = model.constraints.find(
      (constraint) => constraint.name === "retraction_reason_iff_retracted",
    );
    expect(composite?.appliesTo).toEqual(["TemporalFact", "MarketObservation"]);
    expect(composite?.targets).toEqual(["TemporalFact", "MarketObservation"]);
    expect(
      model.byKey.get("MarketObservation")?.constraints.map(
        (constraint) => constraint.name,
      ),
    ).toContain("retraction_reason_iff_retracted");
  });

  it("distinguishes open and closed vocabularies", () => {
    const model = dictionary();
    const eventType = model.byKey
      .get("Event")
      ?.fields.find((field) => field.name === "event_type");
    expect(eventType?.enumValues).toEqual(["buy", "sell", "transfer"]);
    const factType = model.byKey
      .get("TemporalFact")
      ?.fields.find((field) => field.name === "fact_type");
    expect(factType?.knownValues).toEqual(["market_price", "name", "nav"]);
  });

  it("derives facets and counts without synthetic fields", () => {
    const model = dictionary();
    expect(model.facets.subjects).toEqual(["asset", "issuer", "portfolio"]);
    expect(model.facets.aggregates).toEqual(
      expect.arrayContaining(["none", "sum", "min", "max", "last"]),
    );
    const realFields = model.definitions
      .flatMap((definition) => definition.fields)
      .filter((field) => !field.synthetic);
    expect(model.counts.fields).toBe(realFields.length);
  });

  it("places unknown definitions in the other group", () => {
    const document = {
      ...semanticDictionaryFixture,
      $defs: {
        ...semanticDictionaryFixture.$defs,
        Custom: {
          type: "object",
          description: "A future definition.",
          properties: {},
        },
      },
    };
    const model = buildSemanticDictionary(document, "{}");
    expect(model.byKey.get("Custom")?.kind).toBe("other");
    expect(model.groups.map((group) => group.id)).toContain("other");
  });

  it("leaves an unresolved value shape visible without inventing fields", () => {
    const document = {
      ...semanticDictionaryFixture,
      $defs: {
        ...semanticDictionaryFixture.$defs,
        "FactType.missing": {
          type: "object",
          properties: {
            type: { const: "missing" },
            value: { $ref: "#/$defs/FactValue.missing" },
          },
          required: ["type", "value"],
          "x-obolargus-fact-type": {
            fact_type: "missing",
            display_name: "Missing",
            subjects: ["asset"],
            storage_kind: "text",
            aggregation: "none",
            unit: null,
            observation_kind: null,
            interval_seconds: null,
            schema_version: 1,
          },
        },
      },
    };
    const model = buildSemanticDictionary(document, "{}");
    const missing = model.byKey.get("FactType.missing");
    expect(missing?.valueShapeRef).toBe("FactValue.missing");
    expect(missing?.fields).toEqual([]);
  });

  it("fails closed for invalid, incomplete, and empty documents", () => {
    expect(() => buildSemanticDictionary(null, "")).toThrow(
      SemanticDictionaryError,
    );
    try {
      buildSemanticDictionary({}, "");
    } catch (error) {
      expect(error).toBeInstanceOf(SemanticDictionaryError);
      expect((error as SemanticDictionaryError).kind).toBe("incomplete");
      expect((error as SemanticDictionaryError).missing).toContain("$defs");
    }
    try {
      buildSemanticDictionary(
        { ...semanticDictionaryFixture, $defs: {} },
        "",
      );
    } catch (error) {
      expect((error as SemanticDictionaryError).kind).toBe("empty");
    }
  });
});
