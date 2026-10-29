import React, { memo } from "react";
import type { RangeReport as RangeReportType } from "../../types/dataLoad";
import { LoadReport } from "./LoadReport";

/** Range summary plus one ascending section per date. */
export const RangeReport = memo(function RangeReport({ report }: { report: RangeReportType }) {
  return (
    <section className="obolargus_range_report" aria-label="Range report">
      <h2>Range report</h2>
      <dl>
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
      {report.dates.map((section) => (
        <section key={section.date} aria-label={`Date ${section.date}`}>
          <h3>{section.date}</h3>
          {section.report.loaded === 0 && section.report.no_op === 0 ? (
            <p>
              Nothing stored for this date (
              {section.report.rejected +
                section.report.source_unavailable +
                section.report.rate_limited +
                section.report.storage_failure >
              0
                ? "failed"
                : "no data exists"}
              ).
            </p>
          ) : null}
          <LoadReport report={section.report} />
        </section>
      ))}
    </section>
  );
});

export default RangeReport;
