import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  loadOnce,
  loadRange,
  startLoadRange,
  stopLoadRange,
  toggleSource,
  type RangeLoadRequest,
  type SingleLoadRequest,
} from "../api/dataLoad";
import type {
  DataDomainId,
  LoadReport,
  RangeLoadAccepted,
  RangeReport,
  StopRangeResult,
} from "../types/dataLoad";
import {
  invalidateAfterLoad,
  invalidateAfterSourceToggle,
} from "./invalidation";
import { queryKeys } from "./keys";
import { assertOnlineForWrite } from "../offline/assertOnlineForWrite";

export interface ToggleSourceVariables {
  sourceId: string;
  enabled: boolean;
  reason?: string | null;
}

/** Enables or disables one configured upstream source. */
export function useToggleSourceMutation(domain: DataDomainId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: ToggleSourceVariables) => {
      assertOnlineForWrite();
      return variables.reason === undefined
        ? toggleSource(variables.sourceId, variables.enabled)
        : toggleSource(
            variables.sourceId,
            variables.enabled,
            variables.reason,
          );
    },
    retry: false,
    onSuccess: () => invalidateAfterSourceToggle(queryClient, domain),
  });
}

/** Runs one single-date load and invalidates the reads it changes. */
export function useLoadOnceMutation() {
  const queryClient = useQueryClient();
  return useMutation<LoadReport, unknown, SingleLoadRequest>({
    mutationFn: (body) => {
      assertOnlineForWrite();
      return loadOnce(body);
    },
    retry: false,
    onSuccess: (report) => invalidateAfterLoad(queryClient, { report }),
  });
}

/** Runs one date-range load and invalidates history, series, and progress. */
export function useLoadRangeMutation() {
  const queryClient = useQueryClient();
  return useMutation<RangeReport, unknown, RangeLoadRequest>({
    mutationFn: (body) => {
      assertOnlineForWrite();
      return loadRange(body);
    },
    retry: false,
    onSuccess: (report, variables) =>
      invalidateAfterLoad(queryClient, {
        report,
        groupId: variables.client_group_id,
      }),
  });
}

/**
 * Starts one date-range load in the background.
 *
 * The POST returns as soon as the server accepts it; completion is observed by
 * the range-progress poll and the history detail read.
 */
export function useStartRangeLoadMutation() {
  const queryClient = useQueryClient();
  return useMutation<RangeLoadAccepted, unknown, RangeLoadRequest>({
    mutationFn: (body) => {
      assertOnlineForWrite();
      return startLoadRange(body);
    },
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dataLoad.allHistory(),
      });
    },
  });
}

/** Requests cancellation of a running range load. */
export function useStopRangeLoadMutation() {
  const queryClient = useQueryClient();
  return useMutation<StopRangeResult, unknown, string>({
    mutationFn: (groupId) => {
      assertOnlineForWrite();
      return stopLoadRange(groupId);
    },
    retry: false,
    onSuccess: (_result, groupId) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dataLoad.allHistory(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dataLoad.progress(groupId),
      });
    },
  });
}
