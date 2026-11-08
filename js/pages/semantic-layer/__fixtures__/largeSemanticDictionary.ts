import { semanticDictionaryFixture } from "./semanticDictionary";

interface MutableDictionaryDocument {
  $defs: Record<string, unknown>;
  "x-obolargus-relationships": Array<Record<string, string>>;
}

/**
 * Builds a dictionary an order of magnitude larger than the fixture by adding
 * simple entities and relationships.
 */
export function makeLargeSemanticDictionary(extra: number = 320) {
  const document = JSON.parse(
    JSON.stringify(semanticDictionaryFixture),
  ) as MutableDictionaryDocument;

  for (let index = 0; index < extra; index += 1) {
    const key = `ExtraEntity${index}`;
    document.$defs[key] = {
      type: "object",
      description: `Synthetic entity ${index} for scale validation.`,
      properties: {
        id: {
          type: "string",
          format: "uuid",
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": false,
        },
        label: {
          type: "string",
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": true,
        },
        amount: {
          type: "string",
          pattern: "^-?(?:0|[1-9][0-9]{0,19})(?:\\.[0-9]{1,18})?$",
          "x-obolargus-aggregates": ["sum", "min", "max"],
          "x-obolargus-precision": 38,
          "x-obolargus-scale": 18,
        },
      },
      required: ["id", "label"],
      additionalProperties: false,
      "x-obolargus-entity": key,
      "x-obolargus-table": `extra_entities_${index}`,
    };
    document["x-obolargus-relationships"].push({
      from: key,
      to: "Portfolio",
      label: "belongs_to",
      cardinality_from: "0..*",
      cardinality_to: "1",
    });
  }

  return document;
}
