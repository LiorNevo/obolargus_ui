import type { QueryKey } from "@tanstack/react-query";
import { isBrowserOnline } from "../offline/errors";
import { useOfflineStore } from "../offline/offlineStore";
import {
  hashQueryKey,
  toProvenanceRecord,
  type ReadMeta,
} from "../offline/responseProvenance";

/** A query function that accepts the provenance callback. */
export type ReadQueryFn<T> = (
  context: { signal: AbortSignal },
  onMeta: (meta: ReadMeta) => void,
) => Promise<T>;

/**
 * Wraps a read query function so its response provenance is recorded under the
 * existing TanStack query identity.
 *
 * The wrapper changes no data shape: the underlying function still returns the
 * same promise value and the page keeps observing only the query cache.
 */
export function withReadProvenance<T>(
  queryKey: QueryKey,
  fn: ReadQueryFn<T>,
): (context: { signal: AbortSignal }) => Promise<T> {
  const queryKeyHash = hashQueryKey(queryKey);
  const requestUrl = `query:${String(queryKey[0] ?? "unknown")}`;

  return (context) =>
    fn(context, (meta) => {
      const store = useOfflineStore.getState();
      store.recordProvenance(
        toProvenanceRecord(
          queryKeyHash,
          requestUrl,
          meta,
          !isBrowserOnline(),
        ),
      );
      if (meta.source === "cache") {
        store.markCacheServed();
      }
    });
}
