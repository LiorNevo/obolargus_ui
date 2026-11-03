import React, { memo, useMemo } from "react";
import Loading from "lx_client/js/components/Loading";
import { Button } from "lx_client/js/components/Button";
import { Table } from "lx_client/js/components/Table";
import type { TableColumnDef } from "lx_client/js/components/Table";
import type { HistoryFiltersValue, HistoryPage } from "../../types/dataLoad";
import { historyRows, type HistoryRow } from "./historyRows";

/** Props for the history table. */
export interface HistoryPanelProps {
  page: HistoryPage | null;
  filters: HistoryFiltersValue;
  loading: boolean;
  refreshing?: boolean;
  error: string | null;
  onSelect: (entryId: string) => void;
  onPage: (page: number) => void;
  onRefresh: () => void;
}

/** Newest-first history table with header filters and row grouping. */
export const HistoryPanel = memo(function HistoryPanel({
  page,
  filters,
  loading,
  refreshing = false,
  error,
  onSelect,
  onPage,
  onRefresh,
}: HistoryPanelProps) {
  const pageNumber = filters.page ?? 1;
  const limit = page?.limit ?? 50;
  const total = page?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / limit));
  const tableKey = `data-load-history-page-${pageNumber}`;
  const rows = useMemo(
    () => historyRows(page?.entries ?? []),
    [page?.entries],
  );

  const columns = useMemo<TableColumnDef<HistoryRow>[]>(
    () => [
      {
        id: "entryId",
        accessorKey: "entryId",
        header: "Run / change ID",
      },
      { id: "type", accessorKey: "type", header: "Type" },
      { id: "started", accessorKey: "started", header: "Started" },
      { id: "dateRange", accessorKey: "dateRange", header: "Date range" },
      { id: "domain", accessorKey: "domain", header: "Domain" },
      { id: "source", accessorKey: "source", header: "Source" },
      { id: "status", accessorKey: "status", header: "Status" },
      { id: "requested", accessorKey: "requested", header: "Requested" },
      { id: "unique", accessorKey: "unique", header: "Unique" },
      { id: "attempted", accessorKey: "attempted", header: "Attempted" },
      { id: "loaded", accessorKey: "loaded", header: "Loaded" },
      { id: "failures", accessorKey: "failures", header: "Failures" },
      { id: "duration", accessorKey: "duration", header: "Duration" },
      { id: "dates", accessorKey: "dates", header: "Dates" },
      { id: "actor", accessorKey: "actor", header: "Actor" },
      {
        id: "open",
        header: "Detail",
        enableGrouping: false,
        cell: ({ row }) => (
          <Button
            type="button"
            onClick={() => onSelect(row.original.entryId)}
          >
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
      ) : null}
      {refreshing ? (
        <p role="status">Refreshing history…</p>
      ) : null}
      {loading && !page ? (
        <div className="obolargus_loading_block" aria-busy="true">
          <Loading compact label="Loading history..." />
          <Table
            tableKey={tableKey}
            columns={columns}
            data={[]}
            loading
            skeletonRows={6}
            enableFiltering
            enableGrouping
            enablePagination={false}
          />
        </div>
      ) : page && page.entries.length === 0 ? (
        <p>No entries match this page.</p>
      ) : page ? (
        <>
          <p>{total} entries</p>
          <Table
            tableKey={tableKey}
            columns={columns}
            data={rows}
            enableFiltering
            enableGrouping
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
});

export default HistoryPanel;
