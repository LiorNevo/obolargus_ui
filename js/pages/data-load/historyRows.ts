import type { HistoryEntry } from "../../types/dataLoad";
import { runStatusLabel } from "./runGroups";

export type HistoryRowKind = "run" | "range" | "source_change";

/** One flat history row for the shared table. */
export interface HistoryRow {
  entryId: string;
  type: string;
  started: string;
  ended: string;
  dateRange: string;
  domain: string;
  source: string;
  status: string;
  requested: number;
  unique: number;
  attempted: number;
  loaded: number;
  failures: number;
  duration: string;
  dates: string;
  actor: string;
  kind: HistoryRowKind;
}

function kindOf(entry: HistoryEntry): HistoryRowKind {
  if (entry.entry_type === "source_change") return "source_change";
  return entry.entry_type === "range_run" ? "range" : "run";
}

function typeLabel(entry: HistoryEntry): string {
  if (entry.entry_type === "source_change") return "Configuration change";
  return entry.entry_type === "range_run" ? "Range run" : "Load run";
}

/** Selected fields used by the shared history table. */
export function historyRows(entries: HistoryEntry[]): HistoryRow[] {
  return entries.map((entry) => {
    const kind = kindOf(entry);
    return {
      entryId: entry.entry_id,
      type: typeLabel(entry),
      started: entry.started_at,
      ended: entry.ended_at ?? "—",
      dateRange:
        entry.date_from || entry.date_to
          ? `${entry.date_from ?? "—"} → ${entry.date_to ?? "—"}`
          : "—",
      domain: entry.data_domain ?? "—",
      source:
        entry.source_id ??
        entry.requested_source ??
        (entry.answering_sources.join(", ") || "Auto"),
      status: runStatusLabel({ kind, status: entry.status, stale: entry.stale }),
      requested: entry.identifiers_requested_raw,
      unique: Math.max(
        0,
        entry.identifiers_requested_raw - entry.identifiers_duplicated,
      ),
      attempted: entry.identifiers_attempted,
      loaded: entry.loaded,
      failures:
        entry.rejected +
        entry.source_unavailable +
        entry.rate_limited +
        entry.storage_failure,
      duration:
        entry.duration_ms === null ? "—" : `${entry.duration_ms} ms`,
      dates: entry.dates_requested
        ? `${entry.dates_completed}/${entry.dates_requested}`
        : "—",
      actor: entry.actor ?? "—",
      kind,
    };
  });
}
