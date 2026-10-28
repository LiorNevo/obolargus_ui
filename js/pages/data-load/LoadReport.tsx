import React, { useEffect, useMemo, useState } from "react";
import { Table } from "lx_client/js/components/Table";
import { Button } from "lx_client/js/components/Button";
import type { TableColumnDef } from "lx_client/js/components/Table";
import type { IdentifierOutcome, LoadReport as LoadReportData } from "../../types/dataLoad";

const OUTCOME_LABELS: Record<string, string> = {
  loaded: "Loaded",
  no_op: "No-op — identical fact already stored",
  not_resolved: "Not resolved — no asset claims this identifier",
  no_data_for_date: "No data exists for this date",
  unsupported_scheme: "No enabled source supports this identifier type",
  rejected: "Rejected by the source",
  source_unavailable: "Source unavailable",
  rate_limited: "Rate limited",
  storage_failure: "Storage failure",
};

const FAILURE_OUTCOMES = new Set([
  "rejected",
  "source_unavailable",
  "rate_limited",
  "storage_failure",
]);

/** Plain-language label for an outcome, preserving unknown raw codes. */
export function outcomeLabel(outcome: string): string {
  return OUTCOME_LABELS[outcome] ?? `Unknown outcome (${outcome})`;
}

function countByFailure(report: LoadReportData): Array<[string, number]> {
  const entries: Array<[string, number]> = [
    ["rejected", report.rejected],
    ["source_unavailable", report.source_unavailable],
    ["rate_limited", report.rate_limited],
    ["storage_failure", report.storage_failure],
  ];
  return entries.filter(([, count]) => count > 0);
}

function StoredValue({ line }: { line: IdentifierOutcome }) {
  if (!line.stored) return <span>Nothing stored</span>;
  return (
    <div>
      <pre>{JSON.stringify(line.stored.value, null, 2)}</pre>
      <p>
        As of {line.stored.as_of_date}; recorded {line.stored.known_at}; source{" "}
        {line.stored.source_id}
      </p>
    </div>
  );
}

/** Full execution report with summary, failure banner, and lines. */
export function LoadReport({ report }: { report: LoadReportData }) {
  const [visible, setVisible] = useState(50);
  useEffect(() => setVisible(50), [report]);
  const chunk = useMemo(
    () => report.identifiers.slice(0, visible),
    [report, visible],
  );
  const failures = countByFailure(report);

  const columns = useMemo<TableColumnDef<IdentifierOutcome>[]>(
    () => [
      {
        id: "identifier",
        header: "Identifier",
        cell: ({ row }) => (
          <code>
            {row.original.identifier.scheme}:{row.original.identifier.value}
          </code>
        ),
      },
      {
        id: "outcome",
        accessorKey: "outcome",
        header: "Outcome",
        cell: ({ row }) =>
          FAILURE_OUTCOMES.has(row.original.outcome) ? (
            <strong>{outcomeLabel(row.original.outcome)}</strong>
          ) : (
            outcomeLabel(row.original.outcome)
          ),
      },
      {
        id: "attempted",
        header: "Attempted",
        cell: ({ row }) => (row.original.attempted ? "yes" : "no"),
      },
      {
        id: "sources",
        header: "Sources",
        cell: ({ row }) =>
          row.original.per_source.length === 0
            ? "none"
            : row.original.per_source
                .map(
                  (source) =>
                    `${source.source_id}${source.ok ? "" : " (failed)"}`,
                )
                .join(", "),
      },
      {
        id: "answering",
        accessorKey: "source_id",
        header: "Answering source",
        cell: ({ row }) => row.original.source_id ?? "—",
      },
      {
        id: "stored",
        header: "Stored / reason",
        cell: ({ row }) =>
          row.original.stored ? (
            <StoredValue line={row.original} />
          ) : row.original.outcome === "no_op" ? (
            "Identical fact already stored"
          ) : (
            outcomeLabel(row.original.outcome)
          ),
      },
      {
        id: "creation",
        header: "Asset creation",
        cell: ({ row }) => row.original.asset_creation.status,
      },
    ],
    [],
  );

  return (
    <section className="obolargus_load_report" aria-label="Load report">
      <h2>Report</h2>
      <dl className="obolargus_report_summary">
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

      <Table
        tableKey={`data-load-report-${report.run_id ?? "dry-run"}`}
        columns={columns}
        data={chunk}
        enableSorting={false}
        enableFiltering={false}
        enablePagination={false}
      />
      {visible < report.identifiers.length && (
        <Button type="button" onClick={() => setVisible((value) => value + 50)}>
          Show more
        </Button>
      )}
    </section>
  );
}

export default LoadReport;
