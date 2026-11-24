/** Wire types for the additive chart history endpoint. */
export interface HistoryLoadWire {
  report_version: number;
  run_id: string | null;
  asset_id: string;
  from: string;
  to: string;
  status: "complete" | "partial" | "failed";
  source_id: string | null;
  loaded: number;
  no_op: number;
  expected_sessions?: number;
  closed_sessions?: number;
  unexpected_sessions?: number;
  calendar_mic?: string | null;
  no_data: boolean;
  source_unavailable: number;
  rate_limited: number;
  rejected: number;
  storage_failure: number;
  duration_ms: number;
  message: string | null;
}

/** Wire type for the existing single-asset refresh endpoint. */
export interface RefreshWire {
  run_id: string;
  assets_attempted: number;
  assets_refreshed: number;
  assets_no_op: number;
  assets_missing_identifier: number;
  assets_source_unavailable: number;
  latest_completed_session?: string | null;
}

/** One resolved calendar segment from the coverage read. */
export interface CoverageSegmentWire {
  mic: string | null;
  name: string | null;
  from: string;
  to: string;
  exact: boolean;
  reason: string | null;
}

/** Calendar-aware coverage wire response. */
export interface CoverageWire {
  asset_id: string;
  from: string;
  to: string;
  as_of: string;
  segments: CoverageSegmentWire[];
  expected_session_count: number;
  missing_sessions: string[];
  latest_completed_session: string | null;
}
