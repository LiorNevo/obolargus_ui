import React, { memo, useMemo } from "react";
import { Table } from "lx_client/js/components/Table";
import { Button } from "lx_client/js/components/Button";
import type { TableColumnDef } from "lx_client/js/components/Table";
import type { SourceCatalogEntry } from "../../types/dataLoad";
import { SourceToggle } from "./SourceToggle";

/** Props for the source catalog. */
export interface SourceCatalogProps {
  sources: SourceCatalogEntry[];
  busySourceId: string | null;
  loading?: boolean;
  onRefresh: () => void;
  onToggle: (source: SourceCatalogEntry, enabled: boolean) => void;
}

/** Table of configured sources, including disabled ones. */
export const SourceCatalog = memo(function SourceCatalog({
  sources,
  busySourceId,
  loading = false,
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
      <Button type="button" onClick={onRefresh} disabled={loading}>
        Refresh
      </Button>
      {loading || sources.length > 0 ? (
        <Table
          tableKey="data-load-sources"
          columns={columns}
          data={sources}
          loading={loading}
          skeletonRows={5}
          enableSorting={false}
          enableFiltering={false}
          enablePagination={false}
        />
      ) : (
        <p>No upstream sources are configured.</p>
      )}
    </section>
  );
});

export default SourceCatalog;
