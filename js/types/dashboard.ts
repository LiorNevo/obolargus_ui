/** Wire types for the additive dashboard reads. */

/** One asset-search item. */
export interface AssetSearchItem {
  id: string;
  display_name: string;
  asset_type: string;
  currency: string;
  primary_identifier: string | null;
}

/** Asset-search envelope. */
export interface AssetSearchResponse {
  items: AssetSearchItem[];
}

/** A typed market-price value. */
export interface MarketPriceValueWire {
  type: "market_price";
  open: string;
  high: string;
  low: string;
  close: string;
  adjclose?: string | null;
  volume?: string | null;
  currency: string;
  adjustment: string;
}

/** The typed value union returned by the fact API. */
export type FactValueWire =
  | { type: "text"; value: string }
  | { type: "decimal"; value: string }
  | { type: "integer"; value: string }
  | { type: "boolean"; value: boolean }
  | { type: "date"; value: string }
  | { type: "timestamp"; value: string }
  | MarketPriceValueWire;

/** One resolved fact point. */
export interface FactPointWire {
  subject: string;
  subject_id: string;
  id: string;
  fact_type: string;
  schema_version: number;
  valid_at: string;
  known_at: string;
  value: FactValueWire | null;
  source: string;
  retracted: boolean;
  retraction_reason: string | null;
}

/** Series page coverage. */
export interface SeriesCoverageWire {
  points: number;
  first: string | null;
  last: string | null;
}

/** Resolved-series envelope. */
export interface SeriesResponseWire {
  subject: string;
  subject_id: string;
  fact_type: string;
  known_at: string | null;
  points: FactPointWire[];
  coverage: SeriesCoverageWire;
  next_cursor: string | null;
}

/** Error envelope shared with the server. */
export interface ApiErrorEnvelope {
  error?: { code?: string; message?: string };
}
