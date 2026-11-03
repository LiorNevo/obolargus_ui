import type {
  DataDomainId,
  HistoryDetail,
  RangeReport,
} from "../../types/dataLoad";

/**
 * Reconstructs the live range-report shape from a finished history detail.
 *
 * Used after a fire-and-forget range load settles: the POST no longer carries
 * the report, so the detail read becomes the source of truth.
 */
export function rangeReportFromDetail(
  detail: HistoryDetail,
  groupId: string,
): RangeReport | null {
  if (!detail.range) return null;
  const range = detail.range;
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
    dates_with_loads: range.dates_with_loads,
    dates_with_nothing_stored: range.dates_with_nothing_stored,
    totals: range.totals,
    run_ids: range.dates.map((section) => section.report.run_id),
    dates: range.dates,
    started_at: detail.entry.started_at,
    ended_at:
      detail.entry.ended_at ??
      lastDate?.report.ended_at ??
      detail.entry.started_at,
    duration_ms: detail.entry.duration_ms ?? 0,
  };
}
