import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  fetchAudit,
  fetchContext,
  fetchFlow,
  fetchFlows,
  fetchNodeTypes,
  fetchRun,
  fetchRunLogs,
  fetchRunMessages,
  fetchRuns,
  fetchTemplate,
  fetchTemplates,
  fetchTriggers,
  fetchVersion,
  fetchVersions,
} from "../api/automation";
import { API_BASE_URL } from "../api/config";
import { queryKeys } from "./keys";

const CATALOG_STALE_MS = 300_000;
const FLOW_STALE_MS = 15_000;
const RUN_STALE_MS = 5_000;

/** Cache options for the executable node catalog. */
export function nodeTypesQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.automation.nodeTypes(),
    queryFn: fetchNodeTypes,
    staleTime: CATALOG_STALE_MS,
  });
}

/** Cache options for the template catalog. */
export function templatesQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.automation.templates(),
    queryFn: fetchTemplates,
    staleTime: CATALOG_STALE_MS,
  });
}

/** Cache options for one template. */
export function templateQueryOptions(templateId: string | undefined) {
  return queryOptions({
    queryKey: queryKeys.automation.template(templateId ?? ""),
    queryFn: () => {
      if (!templateId) throw new Error("A template id is required.");
      return fetchTemplate(templateId);
    },
    enabled: Boolean(templateId),
    staleTime: CATALOG_STALE_MS,
  });
}

/** Cache options for a flow list page. */
export function flowListQueryOptions(params: {
  status?: string;
  search?: string;
  limit: number;
  offset: number;
}) {
  return queryOptions({
    queryKey: queryKeys.automation.flowList(params),
    queryFn: () => fetchFlows(params),
    staleTime: FLOW_STALE_MS,
  });
}

/** Cache options for one flow. */
export function flowQueryOptions(flowId: string | undefined) {
  return queryOptions({
    queryKey: queryKeys.automation.flow(flowId ?? ""),
    queryFn: () => {
      if (!flowId) throw new Error("A flow id is required.");
      return fetchFlow(flowId);
    },
    enabled: Boolean(flowId),
    staleTime: FLOW_STALE_MS,
  });
}

/** Cache options for a flow's versions. */
export function versionsQueryOptions(flowId: string | undefined) {
  return queryOptions({
    queryKey: queryKeys.automation.versions(flowId ?? ""),
    queryFn: () => {
      if (!flowId) throw new Error("A flow id is required.");
      return fetchVersions(flowId);
    },
    enabled: Boolean(flowId),
    staleTime: FLOW_STALE_MS,
  });
}

/** Cache options for one version. */
export function versionQueryOptions(
  flowId: string | undefined,
  versionNumber: number | undefined,
) {
  return queryOptions({
    queryKey: queryKeys.automation.version(flowId ?? "", versionNumber ?? 0),
    queryFn: () => {
      if (!flowId || versionNumber === undefined) {
        throw new Error("A flow id and version number are required.");
      }
      return fetchVersion(flowId, versionNumber);
    },
    enabled: Boolean(flowId) && versionNumber !== undefined,
    staleTime: FLOW_STALE_MS,
  });
}

/** Cache options for a flow's audit history. */
export function auditQueryOptions(flowId: string | undefined) {
  return queryOptions({
    queryKey: queryKeys.automation.audit(flowId ?? ""),
    queryFn: () => {
      if (!flowId) throw new Error("A flow id is required.");
      return fetchAudit(flowId);
    },
    enabled: Boolean(flowId),
    staleTime: FLOW_STALE_MS,
  });
}

/** Cache options for a flow's durable context. */
export function contextQueryOptions(flowId: string | undefined) {
  return queryOptions({
    queryKey: queryKeys.automation.context(flowId ?? ""),
    queryFn: () => {
      if (!flowId) throw new Error("A flow id is required.");
      return fetchContext(flowId);
    },
    enabled: Boolean(flowId),
    staleTime: FLOW_STALE_MS,
  });
}

/** Cache options for a flow's triggers. */
export function triggersQueryOptions(flowId: string | undefined) {
  return queryOptions({
    queryKey: queryKeys.automation.triggers(flowId ?? ""),
    queryFn: () => {
      if (!flowId) throw new Error("A flow id is required.");
      return fetchTriggers(flowId);
    },
    enabled: Boolean(flowId),
    staleTime: FLOW_STALE_MS,
  });
}

/** Cache options for a run list page. */
export function runListQueryOptions(params: {
  flow_id?: string;
  status?: string;
  trigger_kind?: string;
  limit: number;
  offset: number;
}) {
  return queryOptions({
    queryKey: queryKeys.automation.runList(params),
    queryFn: () => fetchRuns(params),
    staleTime: RUN_STALE_MS,
  });
}

/** Cache options for one run. */
export function runQueryOptions(runId: string | undefined) {
  return queryOptions({
    queryKey: queryKeys.automation.run(runId ?? ""),
    queryFn: () => {
      if (!runId) throw new Error("A run id is required.");
      return fetchRun(runId);
    },
    enabled: Boolean(runId),
    staleTime: RUN_STALE_MS,
  });
}

/** Cache options for a run's messages. */
export function runMessagesQueryOptions(
  runId: string | undefined,
  nodeId?: string,
) {
  return queryOptions({
    queryKey: queryKeys.automation.runMessages(runId ?? "", nodeId),
    queryFn: () => {
      if (!runId) throw new Error("A run id is required.");
      return fetchRunMessages(runId, nodeId ? { node_id: nodeId } : {});
    },
    enabled: Boolean(runId),
    staleTime: 1_000,
  });
}

/** Cache options for a run's logs. */
export function runLogsQueryOptions(runId: string | undefined) {
  return queryOptions({
    queryKey: queryKeys.automation.runLogs(runId ?? ""),
    queryFn: () => {
      if (!runId) throw new Error("A run id is required.");
      return fetchRunLogs(runId);
    },
    enabled: Boolean(runId),
    staleTime: 1_000,
  });
}

/** Loads the node catalog. */
export function useNodeTypesQuery() {
  return useQuery(nodeTypesQueryOptions());
}

/** Loads the template catalog. */
export function useTemplatesQuery() {
  return useQuery(templatesQueryOptions());
}

/** Loads a flow list page. */
export function useFlowsQuery(params: {
  status?: string;
  search?: string;
  limit: number;
  offset: number;
}) {
  return useQuery(flowListQueryOptions(params));
}

/** Loads one flow. */
export function useFlowQuery(flowId: string | undefined) {
  return useQuery(flowQueryOptions(flowId));
}

/** Loads a flow's versions. */
export function useVersionsQuery(flowId: string | undefined) {
  return useQuery(versionsQueryOptions(flowId));
}

/** Loads a flow's audit history. */
export function useAuditQuery(flowId: string | undefined) {
  return useQuery(auditQueryOptions(flowId));
}

/** Loads a flow's durable context. */
export function useContextQuery(flowId: string | undefined) {
  return useQuery(contextQueryOptions(flowId));
}

/** Loads a flow's triggers. */
export function useTriggersQuery(flowId: string | undefined) {
  return useQuery(triggersQueryOptions(flowId));
}

/** Loads a run list page. */
export function useRunsQuery(params: {
  flow_id?: string;
  status?: string;
  trigger_kind?: string;
  limit: number;
  offset: number;
}) {
  return useQuery(runListQueryOptions(params));
}

/** Loads one run. */
export function useRunQuery(runId: string | undefined) {
  return useQuery(runQueryOptions(runId));
}

/** Loads a run's messages. */
export function useRunMessagesQuery(runId: string | undefined, nodeId?: string) {
  return useQuery(runMessagesQueryOptions(runId, nodeId));
}

/** Loads a run's logs. */
export function useRunLogsQuery(runId: string | undefined) {
  return useQuery(runLogsQueryOptions(runId));
}

/**
 * Subscribes to the run SSE stream and refreshes the affected queries.
 *
 * The server stream is a projection over persisted rows; the hook only
 * invalidates caches, so a dropped connection degrades to polling.
 */
export function useRunEvents(runId: string | undefined, enabled = true) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!runId || !enabled || typeof EventSource === "undefined") {
      return;
    }
    const source = new EventSource(
      `${API_BASE_URL}/automation/runs/${encodeURIComponent(runId)}/events`,
    );
    const refresh = () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.automation.run(runId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.automation.runMessages(runId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.automation.runLogs(runId),
      });
    };
    for (const eventName of [
      "snapshot",
      "message",
      "log",
      "node.status",
      "run.status",
      "end",
    ]) {
      source.addEventListener(eventName, refresh);
    }
    return () => source.close();
  }, [queryClient, runId, enabled]);
}
