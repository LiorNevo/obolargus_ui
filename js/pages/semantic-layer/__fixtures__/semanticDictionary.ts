/**
 * Representative canonical dictionary fixture for the Semantic Layer explorer.
 *
 * It intentionally contains an entity, an observation fact type, a scalar fact
 * type, scalar value shapes, the value union, a self-referential relationship,
 * invariants, and a composite constraint target.
 */
export const semanticDictionaryFixture = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:obolargus:schema:system:1.0.0",
  title: "Obolargus System Data Dictionary",
  description:
    "The complete Obolargus data dictionary: persisted domain entities, the normalized fact catalog, and typed fact values.",
  "x-obolargus-schema-version": "1.0.0",
  "x-obolargus-model-version": "0.1.0",
  "x-obolargus-relationships": [
    {
      from: "Portfolio",
      to: "Portfolio",
      label: "composes",
      cardinality_from: "1",
      cardinality_to: "0..*",
    },
    {
      from: "Portfolio",
      to: "Position",
      label: "holds",
      cardinality_from: "1",
      cardinality_to: "0..*",
    },
    {
      from: "Position",
      to: "Asset",
      label: "is_quantity_of",
      cardinality_from: "0..*",
      cardinality_to: "1",
    },
    {
      from: "Asset",
      to: "MarketObservation",
      label: "observed_by",
      cardinality_from: "1",
      cardinality_to: "0..*",
    },
    {
      from: "TemporalFact",
      to: "FactType",
      label: "typed_by",
      cardinality_from: "0..*",
      cardinality_to: "1",
    },
  ],
  "x-obolargus-invariants": [
    "Portfolio graph is a DAG.",
    "Every fact value is typed by the catalog.",
  ],
  "x-obolargus-cross-field-constraints": [
    {
      name: "transfer_requires_destination",
      applies_to: "Event",
      description: "A transfer event requires to_portfolio_id.",
    },
    {
      name: "retraction_reason_iff_retracted",
      applies_to: "TemporalFact/MarketObservation",
      description:
        "A retraction reason is present exactly when retracted is true.",
    },
  ],
  $defs: {
    Portfolio: {
      type: "object",
      description: "A node in the portfolio DAG that groups positions and rules.",
      properties: {
        id: {
          type: "string",
          format: "uuid",
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": false,
        },
        name: {
          type: "string",
          minLength: 1,
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": true,
        },
        purpose: {
          type: "string",
          minLength: 1,
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": true,
        },
        created_at: {
          type: "string",
          format: "date-time",
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": false,
        },
        parent_id: {
          type: ["string", "null"],
          format: "uuid",
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": true,
        },
      },
      required: ["created_at", "id", "name", "purpose"],
      additionalProperties: false,
      "x-obolargus-entity": "Portfolio",
      "x-obolargus-table": "portfolios",
    },
    Asset: {
      type: "object",
      description: "A unit of legal property that can be held in a portfolio.",
      properties: {
        id: {
          type: "string",
          format: "uuid",
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": false,
        },
        display_name: {
          type: "string",
          minLength: 1,
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": true,
        },
        currency: {
          type: "string",
          pattern: "^[A-Z]{3}$",
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": true,
        },
      },
      required: ["currency", "display_name", "id"],
      additionalProperties: false,
      "x-obolargus-entity": "Asset",
      "x-obolargus-table": "assets",
    },
    Position: {
      type: "object",
      description: "A derived holding of an asset in a portfolio.",
      properties: {
        portfolio_id: {
          type: "string",
          format: "uuid",
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": false,
        },
        asset_id: {
          type: "string",
          format: "uuid",
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": false,
        },
        quantity: {
          type: "string",
          pattern: "^-?(?:0|[1-9][0-9]{0,19})(?:\\.[0-9]{1,18})?$",
          "x-obolargus-aggregates": ["sum", "min", "max"],
          "x-obolargus-precision": 38,
          "x-obolargus-scale": 18,
          "x-obolargus-writable": false,
        },
        as_of: {
          type: "string",
          format: "date-time",
          "x-obolargus-aggregates": ["max"],
          "x-obolargus-writable": false,
        },
      },
      required: ["as_of", "asset_id", "portfolio_id", "quantity"],
      additionalProperties: false,
      "x-obolargus-entity": "Position",
      "x-obolargus-table": "positions",
    },
    Event: {
      type: "object",
      description: "An immutable portfolio event.",
      properties: {
        id: {
          type: "string",
          format: "uuid",
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": false,
        },
        event_type: {
          type: "string",
          enum: ["buy", "sell", "transfer"],
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": true,
        },
        quantity_delta: {
          type: "string",
          pattern: "^-?(?:0|[1-9][0-9]{0,19})(?:\\.[0-9]{1,18})?$",
          "x-obolargus-aggregates": ["sum"],
          "x-obolargus-writable": true,
        },
        to_portfolio_id: {
          type: ["string", "null"],
          format: "uuid",
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": true,
        },
      },
      required: ["event_type", "id", "quantity_delta"],
      additionalProperties: false,
      "x-obolargus-entity": "Event",
      "x-obolargus-table": "events",
    },
    TemporalFact: {
      type: "object",
      description: "An append-only reference-fact envelope.",
      properties: {
        id: {
          type: "string",
          format: "uuid",
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": false,
        },
        fact_type: {
          type: "string",
          "x-obolargus-known-values": ["market_price", "name", "nav"],
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": false,
        },
        retracted: {
          type: "boolean",
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": true,
        },
        retraction_reason: {
          type: ["string", "null"],
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": true,
        },
      },
      required: ["fact_type", "id", "retracted"],
      additionalProperties: false,
      "x-obolargus-entity": "TemporalFact",
      "x-obolargus-table": "temporal_facts",
    },
    MarketObservation: {
      type: "object",
      description: "A typed market price, bar, or quote observation.",
      properties: {
        id: {
          type: "string",
          format: "uuid",
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": false,
        },
        asset_id: {
          type: "string",
          format: "uuid",
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": true,
        },
        kind: {
          type: "string",
          enum: ["eod", "bar", "quote"],
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": true,
        },
        adjustment: {
          type: "string",
          enum: ["adjusted", "unadjusted", "none"],
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": true,
        },
        retracted: {
          type: "boolean",
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": true,
        },
        retraction_reason: {
          type: ["string", "null"],
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": true,
        },
      },
      required: ["adjustment", "asset_id", "id", "kind", "retracted"],
      additionalProperties: false,
      "x-obolargus-entity": "MarketObservation",
      "x-obolargus-table": "market_observations",
    },
    FactType: {
      type: "object",
      description: "One fact type in the machine-readable catalog.",
      properties: {
        fact_type: {
          type: "string",
          "x-obolargus-known-values": ["market_price", "name", "nav"],
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": false,
        },
        display_name: {
          type: "string",
          "x-obolargus-aggregates": ["none"],
          "x-obolargus-writable": false,
        },
      },
      required: ["display_name", "fact_type"],
      additionalProperties: false,
      "x-obolargus-entity": "FactType",
      "x-obolargus-table": "fact_types",
    },
    "FactValue.text": { type: "string" },
    "FactValue.decimal": {
      type: "string",
      pattern: "^-?(?:0|[1-9][0-9]{0,19})(?:\\.[0-9]{1,18})?$",
    },
    "FactValue.integer": {
      type: "string",
      format: "int64",
      pattern: "^-?(?:0|[1-9][0-9]{0,18})$",
    },
    "FactValue.boolean": { type: "boolean" },
    "FactValue.date": { type: "string", format: "date" },
    "FactValue.timestamp": { type: "string", format: "date-time" },
    "FactValue.market_price": {
      type: "object",
      description: "Typed market-price observation payload.",
      properties: {
        open: {
          type: "string",
          description: "Opening price for the observation window.",
          pattern: "^-?(?:0|[1-9][0-9]{0,19})(?:\\.[0-9]{1,18})?$",
          "x-obolargus-aggregates": ["min", "max", "last"],
          "x-obolargus-minimum": "0",
          "x-obolargus-precision": 38,
          "x-obolargus-scale": 18,
          "x-obolargus-unit": "USD",
        },
        high: {
          type: "string",
          description: "Highest traded price for the observation window.",
          pattern: "^-?(?:0|[1-9][0-9]{0,19})(?:\\.[0-9]{1,18})?$",
          "x-obolargus-aggregates": ["min", "max", "last"],
          "x-obolargus-minimum": "0",
          "x-obolargus-precision": 38,
          "x-obolargus-scale": 18,
          "x-obolargus-unit": "USD",
        },
        low: {
          type: "string",
          description: "Lowest traded price for the observation window.",
          pattern: "^-?(?:0|[1-9][0-9]{0,19})(?:\\.[0-9]{1,18})?$",
          "x-obolargus-aggregates": ["min", "max", "last"],
          "x-obolargus-minimum": "0",
          "x-obolargus-precision": 38,
          "x-obolargus-scale": 18,
          "x-obolargus-unit": "USD",
        },
        close: {
          type: "string",
          description: "Unadjusted closing price for the observation window.",
          pattern: "^-?(?:0|[1-9][0-9]{0,19})(?:\\.[0-9]{1,18})?$",
          "x-obolargus-aggregates": ["min", "max", "last"],
          "x-obolargus-minimum": "0",
          "x-obolargus-precision": 38,
          "x-obolargus-scale": 18,
          "x-obolargus-unit": "USD",
        },
        adjclose: {
          type: ["string", "null"],
          description: "Split/dividend-adjusted closing price, when supplied.",
          pattern: "^-?(?:0|[1-9][0-9]{0,19})(?:\\.[0-9]{1,18})?$",
          "x-obolargus-aggregates": ["min", "max", "last"],
          "x-obolargus-minimum": "0",
          "x-obolargus-precision": 38,
          "x-obolargus-scale": 18,
          "x-obolargus-unit": "USD",
        },
        volume: {
          type: ["string", "null"],
          description: "Traded volume in shares or contracts.",
          pattern: "^-?(?:0|[1-9][0-9]{0,37})$",
          "x-obolargus-aggregates": ["sum", "min", "max", "last"],
          "x-obolargus-minimum": "0",
          "x-obolargus-precision": 38,
          "x-obolargus-scale": 0,
          "x-obolargus-unit": "shares",
        },
        currency: {
          type: "string",
          description: "ISO 4217 quote currency.",
          pattern: "^[A-Z]{3}$",
          "x-obolargus-aggregates": ["none"],
        },
        adjustment: {
          type: "string",
          description: "Basis of the close/adjclose pair.",
          enum: ["adjusted", "unadjusted"],
          "x-obolargus-aggregates": ["none"],
        },
      },
      required: ["adjustment", "close", "currency", "high", "low", "open"],
      additionalProperties: false,
    },
    FactValue: {
      oneOf: [
        {
          type: "object",
          properties: {
            type: { const: "text" },
            value: { $ref: "#/$defs/FactValue.text" },
          },
          required: ["type", "value"],
          additionalProperties: false,
        },
        {
          type: "object",
          properties: {
            type: { const: "decimal" },
            value: { $ref: "#/$defs/FactValue.decimal" },
          },
          required: ["type", "value"],
          additionalProperties: false,
        },
        {
          type: "object",
          properties: {
            type: { const: "integer" },
            value: { $ref: "#/$defs/FactValue.integer" },
          },
          required: ["type", "value"],
          additionalProperties: false,
        },
        {
          type: "object",
          properties: {
            type: { const: "boolean" },
            value: { $ref: "#/$defs/FactValue.boolean" },
          },
          required: ["type", "value"],
          additionalProperties: false,
        },
        {
          type: "object",
          properties: {
            type: { const: "date" },
            value: { $ref: "#/$defs/FactValue.date" },
          },
          required: ["type", "value"],
          additionalProperties: false,
        },
        {
          type: "object",
          properties: {
            type: { const: "timestamp" },
            value: { $ref: "#/$defs/FactValue.timestamp" },
          },
          required: ["type", "value"],
          additionalProperties: false,
        },
        {
          type: "object",
          properties: {
            type: { const: "market_price" },
            value: { $ref: "#/$defs/FactValue.market_price" },
          },
          required: ["type", "value"],
          additionalProperties: false,
        },
      ],
    },
    "FactType.market_price": {
      type: "object",
      description: "End-of-day OHLCV bar for an asset.",
      properties: {
        type: { const: "market_price" },
        value: { $ref: "#/$defs/FactValue.market_price" },
      },
      required: ["type", "value"],
      additionalProperties: false,
      "x-obolargus-fact-type": {
        fact_type: "market_price",
        display_name: "Market price",
        subjects: ["asset"],
        storage_kind: "market_observation",
        aggregation: "last",
        unit: "USD",
        observation_kind: "eod",
        interval_seconds: 0,
        schema_version: 1,
      },
    },
    "FactType.name": {
      type: "object",
      description: "A source-reported name for an asset, issuer, or portfolio.",
      properties: {
        type: { const: "name" },
        value: { $ref: "#/$defs/FactValue.text" },
      },
      required: ["type", "value"],
      additionalProperties: false,
      "x-obolargus-fact-type": {
        fact_type: "name",
        display_name: "Name",
        subjects: ["asset", "issuer", "portfolio"],
        storage_kind: "text",
        aggregation: "none",
        unit: null,
        observation_kind: null,
        interval_seconds: null,
        schema_version: 1,
      },
    },
    "FactType.nav": {
      type: "object",
      description: "Net asset value for an asset.",
      properties: {
        type: { const: "nav" },
        value: { $ref: "#/$defs/FactValue.decimal" },
      },
      required: ["type", "value"],
      additionalProperties: false,
      "x-obolargus-fact-type": {
        fact_type: "nav",
        display_name: "Net asset value",
        subjects: ["asset"],
        storage_kind: "decimal",
        aggregation: "last",
        unit: "USD",
        observation_kind: null,
        interval_seconds: null,
        schema_version: 1,
      },
    },
  },
} as const;

/** The exact canonical text used by tests and the fixture story. */
export const semanticDictionaryCanonicalText = `${JSON.stringify(
  semanticDictionaryFixture,
  null,
  2,
)}\n`;

/** Builds a fetch response carrying the fixture document. */
export function semanticDictionaryResponse(): Response {
  return new Response(semanticDictionaryCanonicalText, {
    status: 200,
    headers: { "content-type": "application/schema+json; charset=utf-8" },
  });
}
