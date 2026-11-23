import type {
  DataDomainId,
  DateLoadSummary,
  HistoryDetail,
  LoadReport,
  RangeReport,
} from "../../types/dataLoad";

function summaryFromReport(date: string, report: LoadReport): DateLoadSummary {
  return {
    date,
    run_id: report.run_id,
    status: report.status,
    identifiers_attempted: report.identifiers_attempted,
    loaded: report.loaded,
    no_op: report.no_op,
    not_resolved: report.not_resolved,
    no_data_for_date: report.no_data_for_date,
    unsupported_scheme: report.unsupported_scheme,
    rejected: report.rejected,
    source_unavailable: report.source_unavailable,
    rate_limited: report.rate_limited,
    storage_failure: report.storage_failure,
    assets_created: report.assets_created,
    assets_adopted: report.assets_adopted,
    per_source_attempted: report.per_source_attempted,
    per_source_failed: report.per_source_failed,
    started_at: report.started_at,
    ended_at: report.ended_at,
    duration_ms: report.duration_ms,
  };
}

/**
 * Reconstructs the live range-report shape from a finished history detail.
 *
 * Used after a fire-and-forget range load settles: the POST no longer carries
 * the report, so the detail read becomes the source of truth. The history
 * detail keeps full per-date reports; the live report keeps bounded
 * summaries.
 */
export function rangeReportFromDetail(
  detail: HistoryDetail,
  groupId: string,
): RangeReport | null {
  if (!detail.range) return null;
  const range = detail.range;
  const dates = range.dates.map((section) =>
    summaryFromReport(section.date, section.report),
  );
  const lastDate = range.dates[range.dates.length - 1];
  return {
    report_version: 1,
    data_domain: (detail.entry.data_domain ?? "market_data") as DataDomainId,
    range_group_id: groupId,
    from: range.from,
    to: range.to,
    concurrency: range.concurrency,
    status: range.status,
    dates_requested: range.dates_requested,
    dates_completed: dates.length,
    dates_failed: dates.filter((date) => date.status === "failed").length,
    dates_with_loads: range.dates_with_loads,
    dates_with_nothing_stored: range.dates_with_nothing_stored,
    totals: range.totals,
    run_ids: dates.map((date) => date.run_id),
    dates,
    started_at: detail.entry.started_at,
    ended_at:
      detail.entry.ended_at ??
      lastDate?.report.ended_at ??
      detail.entry.started_at,
    duration_ms: detail.entry.duration_ms ?? 0,
  };
}
