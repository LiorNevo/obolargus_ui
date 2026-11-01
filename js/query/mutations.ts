import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  loadOnce,
  loadRange,
  toggleSource,
  type RangeLoadRequest,
  type SingleLoadRequest,
} from "../api/dataLoad";
import type {
  DataDomainId,
  LoadReport,
  RangeReport,
} from "../types/dataLoad";
import {
  invalidateAfterLoad,
  invalidateAfterSourceToggle,
} from "./invalidation";

export interface ToggleSourceVariables {
  sourceId: string;
  enabled: boolean;
  reason?: string | null;
}

/** Enables or disables one configured upstream source. */
export function useToggleSourceMutation(domain: DataDomainId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: ToggleSourceVariables) =>
      variables.reason === undefined
        ? toggleSource(variables.sourceId, variables.enabled)
        : toggleSource(
            variables.sourceId,
            variables.enabled,
            variables.reason,
          ),
    retry: false,
    onSuccess: () => invalidateAfterSourceToggle(queryClient, domain),
  });
}

/** Runs one single-date load and invalidates the reads it changes. */
export function useLoadOnceMutation() {
  const queryClient = useQueryClient();
  return useMutation<LoadReport, unknown, SingleLoadRequest>({
    mutationFn: (body) => loadOnce(body),
    retry: false,
    onSuccess: (report) => invalidateAfterLoad(queryClient, { report }),
  });
}

/** Runs one date-range load and invalidates history, series, and progress. */
export function useLoadRangeMutation() {
  const queryClient = useQueryClient();
  return useMutation<RangeReport, unknown, RangeLoadRequest>({
    mutationFn: (body) => loadRange(body),
    retry: false,
    onSuccess: (report, variables) =>
      invalidateAfterLoad(queryClient, {
        report,
        groupId: variables.client_group_id,
      }),
  });
}
