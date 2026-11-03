import React, { memo, useMemo } from "react";
import { Table } from "lx_client/js/components/Table";
import type { TableColumnDef } from "lx_client/js/components/Table";
import type { IdentifierOutcome } from "../../types/dataLoad";
import { FAILURE_OUTCOMES, outcomeLabel, StoredValue } from "./outcomes";
import {
  runFailureCount,
  runStatusLabel,
  type RunGroup,
} from "./runGroups";

interface RunOutcomeRow {
  rowId: string;
  run: string;
  date: string;
  runId: string;
  status: string;
  domain: string;
  source: string;
  identifier: string;
  outcome: string;
  outcomeKey: string;
  attempted: string;
  sources: string;
  answeringSource: string;
  storedText: string;
  assetCreation: string;
  duration: string;
  line: IdentifierOutcome | null;
}

function storedText(line: IdentifierOutcome | null): string {
  if (!line) return "Nothing stored";
  if (line.stored) {
    return `${line.stored.as_of_date} ${line.stored.source_id} ${JSON.stringify(
      line.stored.value,
    )}`;
  }
  if (line.outcome === "no_op") return "Identical fact already stored";
  return outcomeLabel(line.outcome);
}

function sourceList(line: IdentifierOutcome | null): string {
  if (!line || line.per_source.length === 0) return "—";
  return line.per_source
    .map((source) => `${source.source_id}${source.ok ? "" : " (failed)"}`)
    .join(", ");
}

function runRows(group: RunGroup): RunOutcomeRow[] {
  const runLabel = [
    group.title,
    group.runId ?? group.id,
    runStatusLabel(group),
    `${group.counters.loaded} loaded`,
    `${runFailureCount(group.counters)} failed`,
    ...(group.note ? [group.note] : []),
  ].join(" · ");
  const base = {
    date: group.title,
    runId: group.runId ?? group.id,
    status: runStatusLabel(group),
    domain: group.domain ?? "—",
    source: group.source ?? "—",
    duration:
      group.durationMs === null ? "—" : `${group.durationMs} ms`,
  };

  if (group.outcomes.length === 0) {
    return [
      {
        ...base,
        rowId: `${group.id}:empty`,
        run: runLabel,
        identifier: "—",
        outcome: "No identifier results",
        outcomeKey: "no_results",
        attempted: "no",
        sources: "—",
        answeringSource: "—",
        storedText: "Nothing stored",
        assetCreation: "—",
        line: null,
      },
    ];
  }

  return group.outcomes.map((line, index) => ({
    ...base,
    rowId: `${group.id}:${index}`,
    run: runLabel,
    identifier: `${line.identifier.scheme}:${line.identifier.value}`,
    outcome: outcomeLabel(line.outcome),
    outcomeKey: line.outcome,
    attempted: line.attempted ? "yes" : "no",
    sources: sourceList(line),
    answeringSource: line.source_id ?? "—",
    storedText: storedText(line),
    assetCreation: line.asset_creation.status,
    line,
  }));
}

export interface RunOutcomeTableProps {
  groups: RunGroup[];
  tableKey: string;
}

/**
 * Live-report outcome table using the shared lx_client table.
 *
 * Every column exposes a header filter. Column headers can be dragged into the
 * table's row-group drop zone; the default grouping is the run label.
 */
export const RunOutcomeTable = memo(function RunOutcomeTable({
  groups,
  tableKey,
}: RunOutcomeTableProps) {
  const rows = useMemo(
    () => groups.flatMap((group) => runRows(group)),
    [groups],
  );

  const columns = useMemo<TableColumnDef<RunOutcomeRow>[]>(
    () => [
      { id: "run", accessorKey: "run", header: "Run" },
      { id: "date", accessorKey: "date", header: "Date" },
      { id: "runId", accessorKey: "runId", header: "Run ID" },
      { id: "status", accessorKey: "status", header: "Status" },
      { id: "domain", accessorKey: "domain", header: "Domain" },
      { id: "source", accessorKey: "source", header: "Source" },
      {
        id: "identifier",
        accessorKey: "identifier",
        header: "Identifier",
        cell: ({ row }) => <code>{row.original.identifier}</code>,
      },
      {
        id: "outcome",
        accessorKey: "outcome",
        header: "Outcome",
        cell: ({ row }) =>
          FAILURE_OUTCOMES.has(row.original.outcomeKey) ? (
            <strong>{row.original.outcome}</strong>
          ) : (
            row.original.outcome
          ),
      },
      { id: "attempted", accessorKey: "attempted", header: "Attempted" },
      { id: "sources", accessorKey: "sources", header: "Sources" },
      {
        id: "answeringSource",
        accessorKey: "answeringSource",
        header: "Answering source",
      },
      {
        id: "stored",
        accessorKey: "storedText",
        header: "Stored / reason",
        cell: ({ row }) =>
          row.original.line ? (
            <StoredValue line={row.original.line} />
          ) : row.original.storedText === "Nothing stored" ? (
            row.original.outcome === "No identifier results" ? (
              "No identifier results were recorded."
            ) : (
              "Nothing stored"
            )
          ) : (
            row.original.storedText
          ),
      },
      {
        id: "assetCreation",
        accessorKey: "assetCreation",
        header: "Asset creation",
      },
      { id: "duration", accessorKey: "duration", header: "Duration" },
    ],
    [],
  );

  return (
    <Table
      tableKey={tableKey}
      columns={columns}
      data={rows}
      enableSorting={false}
      enableFiltering
      enablePagination={false}
      enableColumnCustomization
      enableGrouping
      defaultGrouping={["run"]}
      defaultExpanded
    />
  );
});

export default RunOutcomeTable;
