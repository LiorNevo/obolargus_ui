/** Exchange-calendar wire types shared by the Calendars page. */

export interface CalendarWeekday {
  iso_weekday: number;
  open: string;
  close: string;
}

export interface CalendarException {
  date: string;
  kind: "closure" | "session" | "early_close";
  open: string | null;
  close: string | null;
  reason: string | null;
  source?: string;
}

/** Importable/exportable calendar document. */
export interface CalendarDocument {
  mic: string;
  name: string;
  time_zone: string;
  coverage_from: string;
  coverage_to: string;
  weekdays: CalendarWeekday[];
  exceptions: CalendarException[];
  source: string;
  provenance: string;
  version?: number | null;
  active?: boolean;
}

export interface CalendarSummary {
  mic: string;
  name: string;
  time_zone: string;
  coverage_from: string;
  coverage_to: string;
  source: string;
  provenance: string;
  version: number;
  active: boolean;
  updated_by: string;
  updated_at: string;
  assigned_asset_count: number;
  resolved_asset_count: number;
  exception_count: number;
}

export interface CalendarAuditEntry {
  id: string;
  action: string;
  actor_id: string;
  summary: string;
  created_at: string;
}

export interface CalendarDetail {
  calendar: CalendarDocument & { weekdays: CalendarWeekday[]; exceptions: CalendarException[] };
  assigned_asset_count: number;
  resolved_asset_count: number;
  audit: CalendarAuditEntry[];
}

export interface CalendarListResponse {
  calendars: CalendarSummary[];
}

export interface CalendarImportResponse {
  calendar: CalendarDocument;
  changed: boolean;
  summary: string;
}

export interface CalendarAssignment {
  id: string;
  asset_id: string;
  asset_display_name: string;
  asset_identifier: string | null;
  mic: string;
  valid_from: string;
  valid_to: string | null;
  source: string;
  created_by: string;
  created_at: string;
}

export interface CalendarAssignmentPage {
  assignments: CalendarAssignment[];
  total: number;
  limit: number;
  offset: number;
}

export interface CalendarInUse {
  affected_count: number;
  affected_assets: Array<{
    asset_id: string;
    display_name: string;
    identifier: string | null;
  }>;
}
