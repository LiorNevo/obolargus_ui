import React, { memo } from "react";
import type { HistoryDetail as HistoryDetailType } from "../../types/dataLoad";
import { LoadReport } from "./LoadReport";

/** Read-only detail for a run, range, or configuration change. */
export const HistoryDetail = memo(function HistoryDetail({ detail }: { detail: HistoryDetailType }) {
  const { entry } = detail;
  return (
    <section aria-label="History detail">
      <h2>History detail</h2>
      <p>
        {entry.entry_type === "source_change"
          ? "Configuration change"
          : entry.entry_type}{" "}
        · {entry.started_at}
      </p>
      {entry.status === "running" && (
        <p role="status">
          {entry.stale ? "Incomplete / interrupted" : "Running"} — this entry
          does not have a completion time.
        </p>
      )}
      {detail.source_change && (
        <dl>
          <dt>Source</dt>
          <dd>{detail.source_change.source_id}</dd>
          <dt>Before</dt>
          <dd>{detail.source_change.before_enabled ? "enabled" : "disabled"}</dd>
          <dt>After</dt>
          <dd>{detail.source_change.after_enabled ? "enabled" : "disabled"}</dd>
          <dt>Changed at</dt>
          <dd>{detail.source_change.changed_at}</dd>
          <dt>Actor</dt>
          <dd>{detail.source_change.actor ?? "not recorded"}</dd>
          <dt>Reason</dt>
          <dd>{detail.source_change.reason ?? "—"}</dd>
        </dl>
      )}
      {detail.load && <LoadReport report={detail.load.report} />}
      {detail.range && (
        <div>
          <h3>
            Range {detail.range.from} to {detail.range.to} ({detail.range.status})
          </h3>
          <p>
            {detail.range.dates_completed} of {detail.range.dates_requested}{" "}
            dates completed; {detail.range.dates_with_loads} with loads;{" "}
            {detail.range.dates_with_nothing_stored} with nothing stored.
          </p>
          {detail.range.dates.map((section) => (
            <section key={section.date} aria-label={`Date ${section.date}`}>
              <h4>{section.date}</h4>
              <LoadReport report={section.report} />
            </section>
          ))}
        </div>
      )}
    </section>
  );
});

export default HistoryDetail;
