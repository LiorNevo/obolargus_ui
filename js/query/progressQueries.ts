import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchProgress } from "../api/dataLoad";
import { isBrowserOnline } from "../offline/errors";
import type { RangeProgress } from "../types/dataLoad";
import { queryKeys } from "./keys";

const PROGRESS_POLL_MS = 2_000;
const PROGRESS_GC_MS = 30_000;
const TERMINAL_STATUSES: ReadonlySet<RangeProgress["status"]> = new Set([
  "complete",
  "partial",
  "failed",
]);

/** Cache options for one range group's live progress. */
export function rangeProgressQueryOptions(groupId: string) {
  return queryOptions({
    queryKey: queryKeys.dataLoad.progress(groupId),
    queryFn: ({ signal }) => fetchProgress(groupId, signal),
    staleTime: 0,
    gcTime: PROGRESS_GC_MS,
    refetchInterval: (query) => {
      if (!isBrowserOnline()) return false;
      return TERMINAL_STATUSES.has(query.state.data?.status ?? "starting")
        ? false
        : PROGRESS_POLL_MS;
    },
    refetchIntervalInBackground: false,
  });
}

/** Reads and polls range progress only while a group id is present. */
export function useRangeProgressQuery(groupId: string | null) {
  return useQuery({
    ...rangeProgressQueryOptions(groupId ?? ""),
    enabled: Boolean(groupId),
  });
}
