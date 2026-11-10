import { useMemo, useState } from "react";
import { Button } from "lx_client/js/components/Button";
import { Table } from "lx_client/js/components/Table";
import type { TableColumnDef } from "lx_client/js/components/Table/types";
import { useContextQuery } from "../../query/automationQueries";
import { useDeleteContextMutation } from "../../query/mutations";
import { errorMessage } from "./shared";

function renderValue(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

type ContextEntry = { key: string; value: string };

function ContextTable({
  scope,
  entries,
}: {
  scope: string;
  entries: ContextEntry[];
}) {
  const columns = useMemo<TableColumnDef<ContextEntry>[]>(
    () => [
      {
        id: "key",
        header: "Key",
        accessorKey: "key",
        cell: ({ row }) => <code>{row.original.key}</code>,
      },
      {
        id: "value",
        header: "Value",
        accessorKey: "value",
        cell: ({ row }) => <code>{row.original.value}</code>,
      },
    ],
    [],
  );
  return (
    <Table
      tableKey={`automation-context-${scope}`}
      columns={columns}
      data={entries}
      enableSorting={false}
      enableFiltering={false}
      enablePagination={false}
      enableColumnCustomization={false}
    />
  );
}

/** Flow- and global-scope durable context for one flow. */
export function ContextPanel({ flowId }: { flowId: string }) {
  const context = useContextQuery(flowId);
  const clear = useDeleteContextMutation(flowId);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="obolargus_automation_panel" aria-label="Context">
      <header className="obolargus_automation_panel__header">
        <h2>Context</h2>
        <Button
          variant="danger"
          onClick={() =>
            clear.mutate(undefined, {
              onError: (mutationError) =>
                setError(errorMessage(mutationError)),
            })
          }
          disabled={clear.isPending}
        >
          Clear flow context
        </Button>
      </header>
      {error ? (
        <p className="obolargus_automation_error" role="alert">
          {error}
        </p>
      ) : null}
      {context.isPending ? <p>Loading context…</p> : null}
      {context.isError ? (
        <p className="obolargus_automation_error" role="alert">
          {errorMessage(context.error)}
        </p>
      ) : null}
      {(["flow", "global"] as const).map((scope) => {
        const entries: ContextEntry[] = Object.entries(
          context.data?.[scope] ?? {},
        ).map(([key, value]) => ({ key, value: renderValue(value) }));
        return (
          <section key={scope} aria-label={`${scope} context`}>
            <h3>{scope === "flow" ? "Flow" : "Global"} scope</h3>
            {entries.length === 0 ? (
              <p>No keys in this scope.</p>
            ) : (
              <ContextTable scope={scope} entries={entries} />
            )}
          </section>
        );
      })}
    </section>
  );
}
