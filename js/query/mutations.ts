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

// --- Automation -----------------------------------------------------------

import {
  archiveFlow as archiveAutomationFlow,
  archiveVersion as archiveAutomationVersion,
  cancelRun as cancelAutomationRun,
  createFlow as createAutomationFlow,
  createTrigger as createAutomationTrigger,
  deleteContext as deleteAutomationContext,
  deleteFlow as deleteAutomationFlow,
  deleteTrigger as deleteAutomationTrigger,
  importFlow as importAutomationFlow,
  invokeTrigger as invokeAutomationTrigger,
  publishFlow as publishAutomationFlow,
  restoreFlow as restoreAutomationFlow,
  retryRun as retryAutomationRun,
  saveDraft as saveAutomationDraft,
  startRun as startAutomationRun,
  updateFlow as updateAutomationFlow,
  updateTrigger as updateAutomationTrigger,
  validateFlow as validateAutomationFlow,
} from "../api/automation";
import type { FlowDocument } from "../types/automation";
import { queryKeys as automationKeys } from "./keys";

/** Creates a flow and refreshes the flow list. */
export function useCreateFlowMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      description?: string;
      tags?: string[];
      template_id?: string;
    }) => {
      assertOnlineForWrite();
      return createAutomationFlow(body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.allFlowLists(),
      });
    },
  });
}

/** Updates flow metadata. */
export function useUpdateFlowMutation(flowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; description?: string; tags?: string[] }) => {
      assertOnlineForWrite();
      return updateAutomationFlow(flowId, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.flow(flowId),
      });
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.allFlowLists(),
      });
    },
  });
}

/** Archives a flow. */
export function useArchiveFlowMutation(flowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      assertOnlineForWrite();
      return archiveAutomationFlow(flowId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.flow(flowId),
      });
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.allFlowLists(),
      });
    },
  });
}

/** Restores an archived flow. */
export function useRestoreFlowMutation(flowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      assertOnlineForWrite();
      return restoreAutomationFlow(flowId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.flow(flowId),
      });
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.allFlowLists(),
      });
    },
  });
}

/** Deletes a flow. */
export function useDeleteFlowMutation(flowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      assertOnlineForWrite();
      return deleteAutomationFlow(flowId);
    },
    onSuccess: () => {
      queryClient.removeQueries({
        queryKey: automationKeys.automation.flow(flowId),
      });
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.allFlowLists(),
      });
    },
  });
}

export interface SaveDraftVariables {
  flow: FlowDocument;
  expectedRevision?: number;
}

/** Saves a flow draft. */
export function useSaveDraftMutation(flowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: SaveDraftVariables) => {
      assertOnlineForWrite();
      return saveAutomationDraft(
        flowId,
        variables.flow,
        variables.expectedRevision,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.flow(flowId),
      });
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.allFlowLists(),
      });
    },
  });
}

export interface ValidateDraftVariables {
  flow: FlowDocument;
}

/** Validates a draft without saving it. */
export function useValidateFlowMutation(flowId: string) {
  return useMutation({
    mutationFn: (variables: ValidateDraftVariables) =>
      validateAutomationFlow(flowId, variables.flow),
  });
}

export interface PublishVariables {
  expectedRevision: number;
  changeNote: string;
}

/** Publishes a draft. */
export function usePublishFlowMutation(flowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: PublishVariables) => {
      assertOnlineForWrite();
      return publishAutomationFlow(
        flowId,
        variables.expectedRevision,
        variables.changeNote,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.flow(flowId),
      });
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.versions(flowId),
      });
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.triggers(flowId),
      });
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.allFlowLists(),
      });
    },
  });
}

/** Archives a published version. */
export function useArchiveVersionMutation(flowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionNumber: number) => {
      assertOnlineForWrite();
      return archiveAutomationVersion(flowId, versionNumber);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.versions(flowId),
      });
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.flow(flowId),
      });
    },
  });
}

export interface ImportFlowVariables {
  flowJson: unknown;
  replaceDraft?: boolean;
}

/** Imports a flow document. */
export function useImportFlowMutation(flowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: ImportFlowVariables) => {
      assertOnlineForWrite();
      return importAutomationFlow(
        flowId,
        variables.flowJson,
        variables.replaceDraft ?? true,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.flow(flowId),
      });
    },
  });
}

/** Starts a manual run. */
export function useStartRunMutation(flowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      inputs?: unknown;
      version_number?: number;
      inject_node_id?: string;
    }) => {
      assertOnlineForWrite();
      return startAutomationRun(flowId, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.allRunLists(),
      });
    },
  });
}

/** Cancels a run. */
export function useCancelRunMutation(runId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      assertOnlineForWrite();
      return cancelAutomationRun(runId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.run(runId),
      });
    },
  });
}

/** Retries a terminal run. */
export function useRetryRunMutation(runId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      assertOnlineForWrite();
      return retryAutomationRun(runId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.allRunLists(),
      });
    },
  });
}

/** Creates an API trigger. */
export function useCreateTriggerMutation(flowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      assertOnlineForWrite();
      return createAutomationTrigger(flowId, { kind: "api" });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.triggers(flowId),
      });
    },
  });
}

export interface UpdateTriggerVariables {
  triggerId: string;
  enabled?: boolean;
  overlap_policy?: string;
  missed_policy?: string;
}

/** Updates a trigger. */
export function useUpdateTriggerMutation(flowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: UpdateTriggerVariables) => {
      assertOnlineForWrite();
      const { triggerId, ...body } = variables;
      return updateAutomationTrigger(triggerId, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.triggers(flowId),
      });
    },
  });
}

/** Deletes a trigger. */
export function useDeleteTriggerMutation(flowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (triggerId: string) => {
      assertOnlineForWrite();
      return deleteAutomationTrigger(triggerId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.triggers(flowId),
      });
    },
  });
}

export interface InvokeTriggerVariables {
  triggerId: string;
  inputs?: unknown;
  idempotencyKey?: string;
}

/** Invokes an API trigger. */
export function useInvokeTriggerMutation(flowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: InvokeTriggerVariables) => {
      assertOnlineForWrite();
      return invokeAutomationTrigger(
        variables.triggerId,
        { inputs: variables.inputs ?? {} },
        variables.idempotencyKey,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.allRunLists(),
      });
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.triggers(flowId),
      });
    },
  });
}

/** Clears a flow's durable context. */
export function useDeleteContextMutation(flowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      assertOnlineForWrite();
      return deleteAutomationContext(flowId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: automationKeys.automation.context(flowId),
      });
    },
  });
}
