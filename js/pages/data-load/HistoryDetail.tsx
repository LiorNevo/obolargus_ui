import React, { memo, useMemo } from "react";
import type { HistoryDetail as HistoryDetailType } from "../../types/dataLoad";
import { LoadReport } from "./LoadReport";
import { RunOutcomeTable } from "./RunOutcomeTable";
import { groupLoadReport } from "./runGroups";

/** Read-only detail for a run, range, or configuration change. */
export const HistoryDetail = memo(function HistoryDetail({
  detail,
}: {
  detail: HistoryDetailType;
}) {
  const { entry } = detail;
  const rangeGroups = useMemo(
    () =>
      detail.range
        ? detail.range.dates.map((section) =>
            groupLoadReport(section.report, {
              id:
                section.report.run_id ??
                `${entry.entry_id}:${section.date}`,
              title: section.date,
            }),
          )
        : [],
    [detail.range, entry.entry_id],
  );

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
        <div className="obolargus_history_range_detail">
          <dl className="obolargus_report_summary">
            <dt>Range</dt>
            <dd>
              {detail.range.from} to {detail.range.to}
            </dd>
            <dt>Status</dt>
            <dd>{detail.range.status}</dd>
            <dt>Dates completed</dt>
            <dd>
              {detail.range.dates_completed} of {detail.range.dates_requested}
            </dd>
            <dt>Dates with loads / nothing stored</dt>
            <dd>
              {detail.range.dates_with_loads} /{" "}
              {detail.range.dates_with_nothing_stored}
            </dd>
            <dt>Loaded / attempted</dt>
            <dd>
              {detail.range.totals.loaded} /{" "}
              {detail.range.totals.identifiers_attempted}
            </dd>
          </dl>
          <RunOutcomeTable
            groups={rangeGroups}
            tableKey={`history-range-${entry.entry_id}`}
          />
        </div>
      )}
    </section>
  );
});

export default HistoryDetail;
