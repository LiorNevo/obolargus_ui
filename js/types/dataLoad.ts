/**
 * Wire and UI types for the Data Load page.
 *
 * Mirrors the Rust report/history shapes from feature 022.
 */

export type DataDomainId = "market_data" | "holdings";
export type LoadMode = "single" | "range";

export interface DomainEntry {
  id: DataDomainId;
  label: string;
  loadable: boolean;
  unavailable_reason: string | null;
}

export interface DomainCatalog {
  domains: DomainEntry[];
}

export interface SourceCatalogEntry {
  source_id: string;
  display_name: string;
  enabled: boolean;
  priority: number;
  supported_schemes: string[];
  supported_data_domains: string[];
  selectable_for_domain: boolean;
  unavailable_reason: string | null;
}

export interface SourceCatalogResponse {
  domain: DataDomainId | null;
  sources: SourceCatalogEntry[];
}

export interface ParsedIdentifier {
  scheme: string;
  value: string;
}

export interface SourceAttempt {
  source_id: string;
  ok: boolean;
  error: string | null;
}

export interface StoredFactDetail {
  value: unknown;
  as_of_date: string;
  known_at: string;
  source_id: string;
}

export interface AssetCreation {
  status: string;
  [key: string]: unknown;
}

export interface IdentifierOutcome {
  identifier: ParsedIdentifier;
  asset_id: string | null;
  asset_creation: AssetCreation;
  attempted: boolean;
  outcome: string;
  source_id: string | null;
  per_source: SourceAttempt[];
  stored?: StoredFactDetail | null;
}

export interface LoadReport {
  report_version: number;
  run_id: string | null;
  data_domain: DataDomainId;
  as_of_date: string | null;
  requested_source: string | null;
  status: "complete" | "partial" | "failed";
  identifiers_requested_raw: number;
  identifiers_duplicated: number;
  identifiers_attempted: number;
  loaded: number;
  no_op: number;
  not_resolved: number;
  no_data_for_date: number;
  unsupported_scheme: number;
  rejected: number;
  source_unavailable: number;
  rate_limited: number;
  storage_failure: number;
  assets_created: number;
  assets_adopted: number;
  per_source_attempted: Record<string, number>;
  per_source_failed: Record<string, number>;
  identifiers: IdentifierOutcome[];
  started_at: string;
  ended_at: string;
  duration_ms: number;
}

export interface RangeTotals {
  identifiers_attempted: number;
  loaded: number;
  no_op: number;
  not_resolved: number;
  no_data_for_date: number;
  unsupported_scheme: number;
  rejected: number;
  source_unavailable: number;
  rate_limited: number;
  storage_failure: number;
  assets_created: number;
  assets_adopted: number;
}

export interface DateLoadSection {
  date: string;
  report: LoadReport;
}

export interface RangeReport {
  report_version: number;
  data_domain: DataDomainId;
  range_group_id: string;
  from: string;
  to: string;
  concurrency: number;
  status: "complete" | "partial" | "failed";
  dates_requested: number;
  dates_with_loads: number;
  dates_with_nothing_stored: number;
  totals: RangeTotals;
  run_ids: Array<string | null>;
  dates: DateLoadSection[];
  started_at: string;
  ended_at: string;
  duration_ms: number;
}

export interface HistoryEntry {
  entry_id: string;
  entry_type: "load_run" | "range_run" | "source_change";
  started_at: string;
  ended_at: string | null;
  data_domain: string | null;
  requested_source: string | null;
  answering_sources: string[];
  identifiers_requested_raw: number;
  identifiers_duplicated: number;
  identifiers_attempted: number;
  loaded: number;
  no_op: number;
  not_resolved: number;
  no_data_for_date: number;
  unsupported_scheme: number;
  rejected: number;
  source_unavailable: number;
  rate_limited: number;
  storage_failure: number;
  assets_created: number;
  assets_adopted: number;
  status: string;
  stale: boolean;
  duration_ms: number | null;
  date_from: string | null;
  date_to: string | null;
  dates_requested: number;
  dates_completed: number;
  dates_with_loads: number;
  range_concurrency: number | null;
  source_id: string | null;
  before_enabled: boolean | null;
  after_enabled: boolean | null;
  actor: string | null;
}

export interface HistoryPage {
  entries: HistoryEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface HistoryDetail {
  entry: HistoryEntry;
  load: { report: LoadReport } | null;
  range: {
    from: string;
    to: string;
    concurrency: number;
    status: "complete" | "partial" | "failed";
    dates_requested: number;
    dates_completed: number;
    dates_with_loads: number;
    dates_with_nothing_stored: number;
    totals: RangeTotals;
    dates: DateLoadSection[];
  } | null;
  source_change: {
    source_id: string;
    before_enabled: boolean;
    after_enabled: boolean;
    changed_at: string;
    actor: string | null;
    reason: string | null;
  } | null;
}

export interface RangeProgress {
  group_id: string;
  status: "starting" | "running" | "complete" | "partial" | "failed";
  dates_requested: number | null;
  dates_completed: number;
  dates_failed: number;
  dates_with_loads: number;
  started_at: string | null;
  updated_at: string;
}

export interface HistoryFiltersValue {
  from?: string;
  to?: string;
  domain?: string;
  source?: string;
  status?: string;
  entry_type?: string;
  page?: number;
  selected?: string;
}

export interface DataLoadDraft {
  domain: DataDomainId;
  mode: LoadMode;
  identifierText: string;
  identifiers: ParsedIdentifier[];
  date: string;
  from: string;
  to: string;
  concurrency: number;
  sourceId: string | null;
  createMissingAssets: boolean;
}

export interface PersistedReport {
  domain: DataDomainId;
  mode: LoadMode;
  completedAt: string;
  groupId: string | null;
  report: LoadReport | RangeReport;
}

export interface InFlightRange {
  groupId: string;
  startedAt: string;
  from: string;
  to: string;
}

 export const DATA_DOMAIN_LABELS: Record<DataDomainId, string> = {
  market_data: "Market & reference data",
  holdings: "Holdings",
};
