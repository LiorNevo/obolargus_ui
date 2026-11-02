import { useMemo } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useOfflineStore } from "./offlineStore";
import {
  hashQueryKey,
  isProvenanceExpired,
} from "./responseProvenance";

/** Returns the provenance record for one query key, if any. */
export function useReadProvenance(queryKey: QueryKey) {
  const hash = useMemo(() => hashQueryKey(queryKey), [queryKey]);
  return useOfflineStore((state) => state.provenance[hash]);
}

function formatTime(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return new Date(timestamp).toISOString();
  }
}

/**
 * Honest cached/network and last-updated label for one read.
 *
 * While offline, a record older than the retention window is reported as
 * unavailable instead of being presented as the best available answer.
 */
export function LastUpdatedLabel({ queryKey }: { queryKey: QueryKey }) {
  const record = useReadProvenance(queryKey);
  const status = useOfflineStore((state) => state.status.state);
  const queryClient = useQueryClient();

  if (!record) return null;

  const expired =
    status !== "online" && isProvenanceExpired(record, Date.now());

  if (expired) {
    return (
      <div
        className="obolargus_read_status obolargus_read_status_unavailable"
        role="status"
      >
        <span>This data is no longer available offline.</span>
        <button
          type="button"
          onClick={() => {
            void queryClient.invalidateQueries({ queryKey });
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const confirmedAt = record.cachedAt ?? record.fetchedAt;
  return (
    <div className="obolargus_read_status" data-source={record.source}>
      {record.source === "cache"
        ? `Cached · last updated ${formatTime(confirmedAt)}`
        : `Live · ${formatTime(confirmedAt)}`}
    </div>
  );
}

/**
 * Most recent provenance across every read.
 *
 * Pages that do not own a single query key use this to surface that the visible
 * data is cached and when it was last confirmed.
 */
export function OfflineReadSummary() {
  const latest = useOfflineStore((state) => {
    const records = Object.values(state.provenance);
    if (records.length === 0) return null;
    return records.reduce((best, record) =>
      record.fetchedAt > best.fetchedAt ? record : best,
    );
  });
  const status = useOfflineStore((state) => state.status.state);

  if (!latest) return null;
  if (status !== "online" && isProvenanceExpired(latest)) {
    return (
      <div className="obolargus_read_status obolargus_read_status_unavailable">
        Cached data has expired. Reconnect to refresh.
      </div>
    );
  }
  const confirmedAt = latest.cachedAt ?? latest.fetchedAt;
  return (
    <div className="obolargus_read_status" data-source={latest.source}>
      {latest.source === "cache"
        ? `Cached · last updated ${formatTime(confirmedAt)}`
        : `Live · ${formatTime(confirmedAt)}`}
    </div>
  );
}

export default LastUpdatedLabel;
