import type {
  IdentifierOutcome,
  LoadReport,
  RangeReport,
} from "../../types/dataLoad";

/** Rolled-up counters shown on a run group header. */
export interface RunCounters {
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
}

export type RunGroupKind = "run" | "range" | "source_change";

/**
 * One expandable table group.
 *
 * Live reports provide their identifier outcomes immediately. History entries
 * start with no outcomes and gain child groups/outcomes when their detail has
 * been fetched.
 */
export interface RunGroup {
  /** Stable expansion identity; the history entry id or the load run id. */
  id: string;
  kind: RunGroupKind;
  /** Short human label: a date, a date span, or "Configuration change". */
  title: string;
  runId: string | null;
  status: string;
  stale: boolean;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  domain: string | null;
  source: string | null;
  counters: RunCounters;
  outcomes: IdentifierOutcome[];
  note: string | null;
  defaultExpanded: boolean;
}

export interface LoadReportGroupOptions {
  id?: string;
  title?: string;
  defaultExpanded?: boolean;
}

export interface RangeReportGroupOptions {
  /** When true, every date run starts expanded. Defaults to false. */
  defaultExpanded?: boolean;
}

export interface GroupCountersInput {
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
}

function countersFrom(input: GroupCountersInput): RunCounters {
  return {
    identifiers_requested_raw: input.identifiers_requested_raw,
    identifiers_duplicated: input.identifiers_duplicated,
    identifiers_attempted: input.identifiers_attempted,
    loaded: input.loaded,
    no_op: input.no_op,
    not_resolved: input.not_resolved,
    no_data_for_date: input.no_data_for_date,
    unsupported_scheme: input.unsupported_scheme,
    rejected: input.rejected,
    source_unavailable: input.source_unavailable,
    rate_limited: input.rate_limited,
    storage_failure: input.storage_failure,
    assets_created: input.assets_created,
    assets_adopted: input.assets_adopted,
  };
}

/** Number of failed identifier lines for a group's counters. */
export function runFailureCount(counters: RunCounters): number {
  return (
    counters.rejected +
    counters.source_unavailable +
    counters.rate_limited +
    counters.storage_failure
  );
}

/** Number of distinct identifiers requested after duplicate removal. */
export function uniqueRequested(counters: RunCounters): number {
  return Math.max(
    0,
    counters.identifiers_requested_raw - counters.identifiers_duplicated,
  );
}

function answeringSources(outcomes: IdentifierOutcome[]): string[] {
  return [
    ...new Set(
      outcomes
        .map((outcome) => outcome.source_id)
        .filter((source): source is string => Boolean(source)),
    ),
  ].sort();
}

function reportSource(report: LoadReport): string | null {
  if (report.requested_source) return report.requested_source;
  const answering = answeringSources(report.identifiers);
  return answering.length > 0 ? answering.join(", ") : null;
}

function reportNote(report: LoadReport): string | null {
  if (report.loaded > 0 || report.no_op > 0) return null;
  const failed =
    report.rejected +
    report.source_unavailable +
    report.rate_limited +
    report.storage_failure;
  return failed > 0
    ? "Nothing stored for this date (failed)."
    : "Nothing stored for this date (no data exists).";
}

function groupIdForReport(report: LoadReport): string {
  return (
    report.run_id ??
    `run:${report.as_of_date ?? report.started_at}`
  );
}

/** Builds one run group from a single-date report. */
export function groupLoadReport(
  report: LoadReport,
  options: LoadReportGroupOptions = {},
): RunGroup {
  return {
    id: options.id ?? groupIdForReport(report),
    kind: "run",
    title: options.title ?? report.as_of_date ?? "Single load",
    runId: report.run_id,
    status: report.status,
    stale: false,
    startedAt: report.started_at,
    endedAt: report.ended_at,
    durationMs: report.duration_ms,
    domain: report.data_domain,
    source: reportSource(report),
    counters: countersFrom(report),
    outcomes: report.identifiers,
    note: reportNote(report),
    defaultExpanded: options.defaultExpanded ?? false,
  };
}

/** Builds one run group per date run in a range report. */
export function groupRangeReport(
  report: RangeReport,
  options: RangeReportGroupOptions = {},
): RunGroup[] {
  return report.dates.map((section) =>
    groupLoadReport(section.report, {
      id:
        section.report.run_id ??
        `${report.range_group_id}:${section.date}`,
      title: section.date,
      defaultExpanded: options.defaultExpanded ?? false,
    }),
  );
}


/** Display label for a run, range, or source-change status. */
export function runStatusLabel(group: Pick<RunGroup, "kind" | "status" | "stale">): string {
  if (group.status === "running") {
    return group.stale ? "Incomplete / interrupted" : "Running";
  }
  if (group.status === "source_enabled") return "Source enabled";
  if (group.status === "source_disabled") return "Source disabled";
  return group.status;
}
