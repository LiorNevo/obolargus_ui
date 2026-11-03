import React, { memo, useMemo } from "react";
import type { RangeReport as RangeReportType } from "../../types/dataLoad";
import { RunOutcomeTable } from "./RunOutcomeTable";
import { groupRangeReport } from "./runGroups";

/** Range summary plus the shared grouped/filterable results table. */
export const RangeReport = memo(function RangeReport({
  report,
}: {
  report: RangeReportType;
}) {
  const groups = useMemo(() => groupRangeReport(report), [report]);

  return (
    <section className="obolargus_range_report" aria-label="Range report">
      <h2>Range report</h2>
      <dl>
        <dt>Range group ID</dt>
        <dd>{report.range_group_id}</dd>
        <dt>Range</dt>
        <dd>
          {report.from} to {report.to}
        </dd>
        <dt>Window</dt>
        <dd>{report.concurrency}</dd>
        <dt>Status</dt>
        <dd>{report.status}</dd>
        <dt>Dates requested / with loads / nothing stored</dt>
        <dd>
          {report.dates_requested} / {report.dates_with_loads} /{" "}
          {report.dates_with_nothing_stored}
        </dd>
        <dt>Loaded / failed</dt>
        <dd>
          {report.totals.loaded} /{" "}
          {report.totals.rejected +
            report.totals.source_unavailable +
            report.totals.rate_limited +
            report.totals.storage_failure}
        </dd>
      </dl>
      <RunOutcomeTable
        groups={groups}
        tableKey={`data-load-range-report-${report.range_group_id}`}
      />
    </section>
  );
});

export default RangeReport;
