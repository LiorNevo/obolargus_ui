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

/** One resolved fact point. */
export interface FactPointWire {
  subject: string;
  subject_id: string;
  id: string;
  fact_type: string;
  valid_at: string;
  known_at: string;
  value: string;
  source: string;
  retracted: boolean;
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
