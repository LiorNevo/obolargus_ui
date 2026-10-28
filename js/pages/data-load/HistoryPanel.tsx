import React, { useMemo } from "react";
import { Table } from "lx_client/js/components/Table";
import Loading from "lx_client/js/components/Loading";
import { Button } from "lx_client/js/components/Button";
import type { TableColumnDef } from "lx_client/js/components/Table";
import type { HistoryEntry, HistoryFiltersValue, HistoryPage } from "../../types/dataLoad";

/** Props for the history list. */
export interface HistoryPanelProps {
  page: HistoryPage | null;
  filters: HistoryFiltersValue;
  loading: boolean;
  error: string | null;
  onSelect: (entryId: string) => void;
  onPage: (page: number) => void;
  onRefresh: () => void;
  onClearFilters: () => void;
}

function statusLabel(entry: HistoryEntry): string {
  if (entry.status === "running") {
    return entry.stale ? "Incomplete / interrupted" : "Running";
  }
  if (entry.status === "source_enabled") return "Source enabled";
  if (entry.status === "source_disabled") return "Source disabled";
  return entry.status;
}

function failureCount(entry: HistoryEntry): number {
  return (
    entry.rejected +
    entry.source_unavailable +
    entry.rate_limited +
    entry.storage_failure
  );
}

/** Newest-first history table with total, paging, and honest states. */
export function HistoryPanel({
  page,
  filters,
  loading,
  error,
  onSelect,
  onPage,
  onRefresh,
  onClearFilters,
}: HistoryPanelProps) {
  const pageNumber = filters.page ?? 1;
  const limit = page?.limit ?? 50;
  const total = page?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / limit));

  const columns = useMemo<TableColumnDef<HistoryEntry>[]>(
    () => [
      { id: "started", accessorKey: "started_at", header: "Started" },
      {
        id: "type",
        accessorKey: "entry_type",
        header: "Type",
        cell: ({ row }) =>
          row.original.entry_type === "source_change"
            ? "Configuration change"
            : row.original.entry_type,
      },
      {
        id: "domain",
        accessorKey: "data_domain",
        header: "Domain",
        cell: ({ row }) => row.original.data_domain ?? "—",
      },
      {
        id: "source",
        header: "Source",
        cell: ({ row }) => {
          const entry = row.original;
          if (entry.entry_type === "source_change") {
            return `${entry.source_id}: ${entry.before_enabled ? "enabled" : "disabled"} → ${entry.after_enabled ? "enabled" : "disabled"}`;
          }
          return (
            entry.requested_source ??
            (entry.answering_sources.join(", ") || "Auto")
          );
        },
      },
      {
        id: "requested",
        header: "Requested / unique",
        cell: ({ row }) =>
          row.original.entry_type === "source_change"
            ? "—"
            : `${row.original.identifiers_requested_raw} / ${row.original.identifiers_requested_raw - row.original.identifiers_duplicated}`,
      },
      {
        id: "loaded",
        accessorKey: "loaded",
        header: "Loaded",
        cell: ({ row }) =>
          row.original.entry_type === "source_change" ? "—" : row.original.loaded,
      },
      {
        id: "failures",
        header: "Failures",
        cell: ({ row }) =>
          row.original.entry_type === "source_change"
            ? "—"
            : failureCount(row.original),
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => statusLabel(row.original),
      },
      {
        id: "duration",
        accessorKey: "duration_ms",
        header: "Duration",
        cell: ({ row }) =>
          row.original.duration_ms === null
            ? "—"
            : `${row.original.duration_ms} ms`,
      },
      {
        id: "open",
        header: "Open",
        cell: ({ row }) => (
          <Button type="button" onClick={() => onSelect(row.original.entry_id)}>
            Open
          </Button>
        ),
      },
    ],
    [onSelect],
  );

  return (
    <section aria-label="History">
      <h2>History</h2>
      <Button type="button" onClick={onRefresh} disabled={loading}>
        Refresh
      </Button>
      {error ? (
        <div role="alert">
          <p>History could not be fetched. {error}</p>
          <Button type="button" onClick={onRefresh}>
            Retry
          </Button>
        </div>
      ) : loading && !page ? (
        <Loading />
      ) : page && page.entries.length === 0 ? (
        <div>
          <p>No entries match these filters.</p>
          <Button type="button" onClick={onClearFilters}>
            Clear filters
          </Button>
        </div>
      ) : page ? (
        <>
          <p>{total} entries</p>
          <Table
            tableKey="data-load-history"
            columns={columns}
            data={page.entries}
            enableSorting={false}
            enableFiltering={false}
            enablePagination={false}
          />
          <nav aria-label="History pages">
            <Button
              type="button"
              disabled={pageNumber <= 1}
              onClick={() => onPage(pageNumber - 1)}
            >
              Previous
            </Button>
            <span>
              Page {pageNumber} of {pages}
            </span>
            <Button
              type="button"
              disabled={pageNumber >= pages}
              onClick={() => onPage(pageNumber + 1)}
            >
              Next
            </Button>
          </nav>
        </>
      ) : null}
    </section>
  );
}

export default HistoryPanel;
