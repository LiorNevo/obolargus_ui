import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePageTitle } from "lx_client/js/navigation/usePageTitle";
import { Button } from "lx_client/js/components/Button";
import { MultiSelect } from "lx_client/js/components/MultiSelect";
import type { SelectOption } from "lx_client/js/components/MultiSelect/types";
import { Skeleton } from "lx_client/js/components/Skeleton";
import { Table } from "lx_client/js/components/Table";
import type { TableColumnDef } from "lx_client/js/components/Table/types";
import type { RunSummary } from "../../types/automation";
import { useRunsQuery } from "../../query/automationQueries";
import {
  errorMessage,
  formatDuration,
  formatInstant,
  StatusBadge,
} from "./shared";
import "./automation.css";

const PAGE_SIZE = 25;
const TERMINAL = new Set([
  "succeeded",
  "partial",
  "failed",
  "cancelled",
  "interrupted",
]);

const STATUS_OPTIONS: SelectOption[] = [
  { id: 0, label: "All", value: "" },
  ...[...TERMINAL, "queued", "running"].map((value, index) => ({
    id: index + 1,
    label: value,
    value,
  })),
];

/** Run history with flow and status filters. */
export default function RunListPage() {
  usePageTitle("Automation runs");
  const [params, setParams] = useSearchParams();
  const flowId = params.get("flow_id") ?? undefined;
  const status = params.get("status") ?? undefined;
  const page = Math.max(0, Number(params.get("page") ?? "0") || 0);

  const runs = useRunsQuery({
    flow_id: flowId,
    status,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };

  const total = runs.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const runColumns = useMemo<TableColumnDef<RunSummary>[]>(
    () => [
      {
        id: "run",
        header: "Run",
        cell: ({ row }) => (
          <Link to={`/automation/runs/${row.original.id}`}>
            {row.original.id.slice(0, 8)}
          </Link>
        ),
      },
      {
        id: "flow",
        header: "Flow",
        cell: ({ row }) => (
          <>
            <Link to={`/automation/flows/${row.original.flow_id}`}>
              {row.original.flow_name}
            </Link>
            {row.original.flow_version_number ? (
              <span className="obolargus_automation_meta">
                {" "}
                v{row.original.flow_version_number}
              </span>
            ) : null}
          </>
        ),
      },
      {
        id: "trigger",
        header: "Trigger",
        accessorKey: "trigger_kind",
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "started",
        header: "Started",
        cell: ({ row }) =>
          formatInstant(row.original.started_at ?? row.original.queued_at),
      },
      {
        id: "duration",
        header: "Duration",
        cell: ({ row }) => formatDuration(row.original.duration_ms),
      },
      {
        id: "messages",
        header: "Messages",
        accessorKey: "message_count",
      },
    ],
    [],
  );

  return (
    <main className="obolargus_automation_page" aria-labelledby="runs-title">
      <header className="obolargus_automation_header">
        <div>
          <h1 id="runs-title">Automation runs</h1>
          <p>Every manual, scheduled, and API-triggered execution.</p>
        </div>
        <Link to="/automation">Back to automation</Link>
      </header>

      <section className="obolargus_automation_filters" aria-label="Filters">
        <div className="obolargus_automation_field">
          <span className="obolargus_automation_field-label">Status</span>
          <MultiSelect
            options={STATUS_OPTIONS}
            value={STATUS_OPTIONS.filter(
              (option) => option.value === (status ?? ""),
            )}
            mode="single"
            ariaLabel="Status"
            placeholder="All"
            onChange={(next) => setParam("status", next[0]?.value ?? "")}
          />
        </div>
        {flowId ? (
          <Button variant="ghost" onClick={() => setParam("flow_id", "")}>
            Clear flow filter
          </Button>
        ) : null}
      </section>

      {runs.isPending ? <Skeleton /> : null}
      {runs.isError ? (
        <p className="obolargus_automation_error" role="alert">
          {errorMessage(runs.error)}
        </p>
      ) : null}
      {runs.isSuccess && (runs.data.items.length === 0 ? (
        <p>No runs match the filters.</p>
      ) : (
        <Table
          tableKey="automation-runs"
          columns={runColumns}
          data={runs.data.items}
          enableSorting={false}
          enableFiltering={false}
          enablePagination={false}
          enableColumnCustomization={false}
        />
      ))}
      {pages > 1 ? (
        <nav aria-label="Run pages" className="obolargus_automation_pager">
          <Button
            disabled={page === 0}
            onClick={() => setParam("page", String(page - 1))}
          >
            Previous
          </Button>
          <span>
            Page {page + 1} of {pages}
          </span>
          <Button
            disabled={page + 1 >= pages}
            onClick={() => setParam("page", String(page + 1))}
          >
            Next
          </Button>
        </nav>
      ) : null}
    </main>
  );
}
