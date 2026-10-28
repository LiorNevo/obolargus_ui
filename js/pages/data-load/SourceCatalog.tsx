import React, { useMemo } from "react";
import { Table } from "lx_client/js/components/Table";
import { Button } from "lx_client/js/components/Button";
import type { TableColumnDef } from "lx_client/js/components/Table";
import type { SourceCatalogEntry } from "../../types/dataLoad";
import { SourceToggle } from "./SourceToggle";

/** Props for the source catalog. */
export interface SourceCatalogProps {
  sources: SourceCatalogEntry[];
  busySourceId: string | null;
  onRefresh: () => void;
  onToggle: (source: SourceCatalogEntry, enabled: boolean) => void;
}

/** Table of configured sources, including disabled ones. */
export function SourceCatalog({
  sources,
  busySourceId,
  onRefresh,
  onToggle,
}: SourceCatalogProps) {
  const enabledCount = sources.filter((source) => source.enabled).length;
  const columns = useMemo<TableColumnDef<SourceCatalogEntry>[]>(
    () => [
      { id: "name", accessorKey: "display_name", header: "Name" },
      { id: "id", accessorKey: "source_id", header: "Id" },
      { id: "priority", accessorKey: "priority", header: "Priority" },
      {
        id: "enabled",
        accessorKey: "enabled",
        header: "Enabled",
        cell: ({ row }) => (row.original.enabled ? "enabled" : "disabled"),
      },
      {
        id: "domains",
        accessorKey: "supported_data_domains",
        header: "Domains",
        cell: ({ row }) => row.original.supported_data_domains.join(", "),
      },
      {
        id: "schemes",
        accessorKey: "supported_schemes",
        header: "Schemes",
        cell: ({ row }) => row.original.supported_schemes.join(", "),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div>
            <SourceToggle
              source={row.original}
              enabledCount={enabledCount}
              busy={busySourceId === row.original.source_id}
              onToggle={onToggle}
            />
            {row.original.unavailable_reason && (
              <p className="obolargus_source_reason">
                {row.original.unavailable_reason}
              </p>
            )}
          </div>
        ),
      },
    ],
    [busySourceId, enabledCount, onToggle],
  );

  return (
    <section aria-label="Sources">
      <h2>Sources</h2>
      <Button type="button" onClick={onRefresh}>
        Refresh
      </Button>
      {sources.length === 0 ? (
        <p>No upstream sources are configured.</p>
      ) : (
        <Table
          tableKey="data-load-sources"
          columns={columns}
          data={sources}
          enableSorting={false}
          enableFiltering={false}
          enablePagination={false}
        />
      )}
    </section>
  );
}

export default SourceCatalog;
