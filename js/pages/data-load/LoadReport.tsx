import React, { memo, useMemo } from "react";
import type { LoadReport as LoadReportData } from "../../types/dataLoad";
import { outcomeLabel } from "./outcomes";
import { RunOutcomeTable } from "./RunOutcomeTable";
import { groupLoadReport } from "./runGroups";

export { outcomeLabel } from "./outcomes";

function countByFailure(report: LoadReportData): Array<[string, number]> {
  const entries: Array<[string, number]> = [
    ["rejected", report.rejected],
    ["source_unavailable", report.source_unavailable],
    ["rate_limited", report.rate_limited],
    ["storage_failure", report.storage_failure],
  ];
  return entries.filter(([, count]) => count > 0);
}

/** Full execution report with summary, failure banner, and grouped lines. */
export const LoadReport = memo(function LoadReport({
  report,
}: {
  report: LoadReportData;
}) {
  const failures = countByFailure(report);
  const groups = useMemo(
    () => [
      groupLoadReport(report, {
        title: report.as_of_date ?? "Single load",
        defaultExpanded: true,
      }),
    ],
    [report],
  );

  return (
    <section className="obolargus_load_report" aria-label="Load report">
      <h2>Report</h2>
      <dl className="obolargus_report_summary">
        <dt>Run ID</dt>
        <dd>{report.run_id ?? "not recorded"}</dd>
        <dt>Domain</dt>
        <dd>{report.data_domain}</dd>
        <dt>Status</dt>
        <dd>{report.status}</dd>
        <dt>Requested / unique / attempted</dt>
        <dd>
          {report.identifiers_requested_raw} /{" "}
          {report.identifiers_requested_raw - report.identifiers_duplicated} /{" "}
          {report.identifiers_attempted}
        </dd>
        <dt>Loaded / no-op / not resolved</dt>
        <dd>
          {report.loaded} / {report.no_op} / {report.not_resolved}
        </dd>
        <dt>No data / unsupported</dt>
        <dd>
          {report.no_data_for_date} / {report.unsupported_scheme}
        </dd>
        <dt>Assets created / adopted</dt>
        <dd>
          {report.assets_created} / {report.assets_adopted}
        </dd>
        <dt>Duration</dt>
        <dd>{report.duration_ms} ms</dd>
        <dt>Requested source</dt>
        <dd>{report.requested_source ?? "Auto"}</dd>
      </dl>

      {failures.length > 0 && (
        <div role="alert" className="obolargus_failure_banner">
          <strong>
            {report.status === "failed" ? "Failed" : "Partial"} — failures
            occurred.
          </strong>
          <ul>
            {failures.map(([name, count]) => (
              <li key={name}>
                {outcomeLabel(name)}: {count}
              </li>
            ))}
          </ul>
        </div>
      )}

      <RunOutcomeTable
        groups={groups}
        tableKey={`data-load-run-report-${report.run_id ?? "unknown"}`}
      />
    </section>
  );
});

export default LoadReport;
