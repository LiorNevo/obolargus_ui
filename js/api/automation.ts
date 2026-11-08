/** REST client for `/api/automation`. */

import { API_BASE_URL } from "./config";
import type {
  AuditEvent,
  AutomationErrorBody,
  DraftResponse,
  FlowDetail,
  FlowDocument,
  FlowSummary,
  NodeTypeDescriptor,
  Page,
  RunAccepted,
  RunDetail,
  RunLog,
  RunMessage,
  RunSummary,
  TemplateDetail,
  TemplateSummary,
  Trigger,
  ValidationView,
  VersionDetail,
  VersionSummary,
} from "../types/automation";

/** A normalized automation request error with a stable code. */
export class AutomationApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AutomationApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(
  path: string,
  init?: Parameters<typeof fetch>[1],
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (response.ok) {
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }
  const text = await response.text();
  let code = "request_failed";
  let message = text || `request failed with status ${response.status}`;
  let details: unknown;
  try {
    const envelope = JSON.parse(text) as AutomationErrorBody;
    code = envelope.error?.code ?? code;
    message = envelope.error?.message ?? message;
    details = envelope.error?.details;
  } catch {
    // Keep the text when the response is not a JSON envelope.
  }
  throw new AutomationApiError(response.status, code, message, details);
}

/** Loads the executable node-type catalog. */
export function fetchNodeTypes(): Promise<{ items: NodeTypeDescriptor[] }> {
  return request("/automation/node-types");
}

/** Loads the first-party template catalog. */
export function fetchTemplates(): Promise<{ items: TemplateSummary[] }> {
  return request("/automation/templates");
}

/** Loads one template, including its flow document. */
export function fetchTemplate(templateId: string): Promise<TemplateDetail> {
  return request(`/automation/templates/${encodeURIComponent(templateId)}`);
}

/** Lists flows with optional filters. */
export function fetchFlows(params: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Page<FlowSummary>> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.search) query.set("search", params.search);
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.offset !== undefined) query.set("offset", String(params.offset));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request(`/automation/flows${suffix}`);
}

/** Loads one flow with its draft and current published version. */
export function fetchFlow(flowId: string): Promise<FlowDetail> {
  return request(`/automation/flows/${encodeURIComponent(flowId)}`);
}

/** Creates a flow, optionally from a template. */
export function createFlow(body: {
  name: string;
  description?: string;
  tags?: string[];
  template_id?: string;
}): Promise<FlowDetail> {
  return request("/automation/flows", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Updates flow metadata. */
export function updateFlow(
  flowId: string,
  body: { name?: string; description?: string; tags?: string[] },
): Promise<FlowDetail> {
  return request(`/automation/flows/${encodeURIComponent(flowId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** Archives a flow. */
export function archiveFlow(flowId: string): Promise<FlowDetail> {
  return request(`/automation/flows/${encodeURIComponent(flowId)}/archive`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

/** Restores an archived flow. */
export function restoreFlow(flowId: string): Promise<FlowDetail> {
  return request(`/automation/flows/${encodeURIComponent(flowId)}/restore`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

/** Deletes a flow. */
export function deleteFlow(flowId: string): Promise<void> {
  return request(`/automation/flows/${encodeURIComponent(flowId)}`, {
    method: "DELETE",
  });
}

/** Saves a draft with optimistic concurrency. */
export function saveDraft(
  flowId: string,
  flowJson: FlowDocument,
  expectedRevision?: number,
): Promise<DraftResponse> {
  return request(`/automation/flows/${encodeURIComponent(flowId)}/draft`, {
    method: "PUT",
    body: JSON.stringify({
      expected_revision: expectedRevision ?? null,
      flow_json: flowJson,
    }),
  });
}

/** Validates a flow document without saving it. */
export function validateFlow(
  flowId: string,
  flowJson: FlowDocument,
): Promise<ValidationView> {
  return request(`/automation/flows/${encodeURIComponent(flowId)}/validate`, {
    method: "POST",
    body: JSON.stringify({ flow_json: flowJson }),
  });
}

/** Publishes the current draft. */
export function publishFlow(
  flowId: string,
  expectedRevision: number,
  changeNote: string,
): Promise<VersionDetail> {
  return request(`/automation/flows/${encodeURIComponent(flowId)}/publish`, {
    method: "POST",
    body: JSON.stringify({
      expected_revision: expectedRevision,
      change_note: changeNote,
    }),
  });
}

/** Lists published versions. */
export function fetchVersions(
  flowId: string,
  limit = 50,
  offset = 0,
): Promise<Page<VersionSummary>> {
  return request(
    `/automation/flows/${encodeURIComponent(flowId)}/versions?limit=${limit}&offset=${offset}`,
  );
}

/** Loads one version. */
export function fetchVersion(
  flowId: string,
  versionNumber: number,
): Promise<VersionDetail> {
  return request(
    `/automation/flows/${encodeURIComponent(flowId)}/versions/${versionNumber}`,
  );
}

/** Archives one version. */
export function archiveVersion(
  flowId: string,
  versionNumber: number,
): Promise<VersionDetail> {
  return request(
    `/automation/flows/${encodeURIComponent(flowId)}/versions/${versionNumber}/archive`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

/** Downloads a version document as pretty-printed JSON. */
export async function exportVersion(
  flowId: string,
  versionNumber: number,
): Promise<{ filename: string; text: string }> {
  const response = await fetch(
    `${API_BASE_URL}/automation/flows/${encodeURIComponent(flowId)}/versions/${versionNumber}/export`,
  );
  if (!response.ok) {
    throw new AutomationApiError(response.status, "request_failed", "export failed");
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename="?([^";]+)"?/.exec(disposition);
  return {
    filename: match?.[1] ?? `flow-v${versionNumber}.json`,
    text: await response.text(),
  };
}

/** Imports a flow document, reporting unknown node types. */
export function importFlow(
  flowId: string,
  flowJson: unknown,
  replaceDraft = true,
): Promise<{
  revision: number;
  flow_json: FlowDocument;
  validation: ValidationView;
  unknown_node_types: Array<{ type: string; version: number; count: number }>;
}> {
  return request(`/automation/flows/${encodeURIComponent(flowId)}/import`, {
    method: "POST",
    body: JSON.stringify({ flow_json: flowJson, replace_draft: replaceDraft }),
  });
}

/** Starts a manual run. */
export function startRun(
  flowId: string,
  body: {
    inputs?: unknown;
    version_number?: number;
    inject_node_id?: string;
  } = {},
): Promise<RunAccepted> {
  return request(`/automation/flows/${encodeURIComponent(flowId)}/runs`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Lists runs. */
export function fetchRuns(params: {
  flow_id?: string;
  status?: string;
  trigger_kind?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Page<RunSummary>> {
  const query = new URLSearchParams();
  if (params.flow_id) query.set("flow_id", params.flow_id);
  if (params.status) query.set("status", params.status);
  if (params.trigger_kind) query.set("trigger_kind", params.trigger_kind);
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.offset !== undefined) query.set("offset", String(params.offset));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request(`/automation/runs${suffix}`);
}

/** Loads run detail with node rows. */
export function fetchRun(runId: string): Promise<RunDetail> {
  return request(`/automation/runs/${encodeURIComponent(runId)}`);
}

/** Loads one node run. */
export function fetchRunNode(runId: string, nodeId: string): Promise<unknown> {
  return request(
    `/automation/runs/${encodeURIComponent(runId)}/nodes/${encodeURIComponent(nodeId)}`,
  );
}

/** Lists run messages. */
export function fetchRunMessages(
  runId: string,
  params: { node_id?: string; direction?: string; after_id?: number; limit?: number } = {},
): Promise<{ items: RunMessage[] }> {
  const query = new URLSearchParams();
  if (params.node_id) query.set("node_id", params.node_id);
  if (params.direction) query.set("direction", params.direction);
  if (params.after_id !== undefined) query.set("after_id", String(params.after_id));
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request(`/automation/runs/${encodeURIComponent(runId)}/messages${suffix}`);
}

/** Lists run logs. */
export function fetchRunLogs(
  runId: string,
  params: { node_id?: string; after_id?: number; limit?: number } = {},
): Promise<{ items: RunLog[] }> {
  const query = new URLSearchParams();
  if (params.node_id) query.set("node_id", params.node_id);
  if (params.after_id !== undefined) query.set("after_id", String(params.after_id));
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request(`/automation/runs/${encodeURIComponent(runId)}/logs${suffix}`);
}

/** Requests cancellation of a run. */
export function cancelRun(
  runId: string,
): Promise<{ id: string; status: string; cancel_requested_at: string | null }> {
  return request(`/automation/runs/${encodeURIComponent(runId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

/** Retries a terminal run. */
export function retryRun(runId: string): Promise<RunAccepted> {
  return request(`/automation/runs/${encodeURIComponent(runId)}/retry`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

/** Lists triggers for a flow. */
export function fetchTriggers(flowId: string): Promise<{ items: Trigger[] }> {
  return request(`/automation/flows/${encodeURIComponent(flowId)}/triggers`);
}

/** Creates an API trigger. */
export function createTrigger(
  flowId: string,
  body: {
    kind: "api";
    enabled?: boolean;
    overlap_policy?: string;
    missed_policy?: string;
  },
): Promise<Trigger> {
  return request(`/automation/flows/${encodeURIComponent(flowId)}/triggers`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Updates a trigger. */
export function updateTrigger(
  triggerId: string,
  body: { enabled?: boolean; overlap_policy?: string; missed_policy?: string },
): Promise<Trigger> {
  return request(`/automation/triggers/${encodeURIComponent(triggerId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** Deletes a trigger. */
export function deleteTrigger(triggerId: string): Promise<void> {
  return request(`/automation/triggers/${encodeURIComponent(triggerId)}`, {
    method: "DELETE",
  });
}

/** Invokes an API trigger. */
export function invokeTrigger(
  triggerId: string,
  body: { inputs?: unknown },
  idempotencyKey?: string,
): Promise<RunAccepted> {
  return request(`/automation/triggers/${encodeURIComponent(triggerId)}/invoke`, {
    method: "POST",
    headers: idempotencyKey ? { "idempotency-key": idempotencyKey } : undefined,
    body: JSON.stringify(body),
  });
}

/** Loads flow and global context. */
export function fetchContext(
  flowId: string,
): Promise<{
  flow: Record<string, unknown>;
  global: Record<string, unknown>;
}> {
  return request(`/automation/flows/${encodeURIComponent(flowId)}/context`);
}

/** Clears flow context. */
export function deleteContext(flowId: string): Promise<void> {
  return request(`/automation/flows/${encodeURIComponent(flowId)}/context`, {
    method: "DELETE",
  });
}

/** Lists audit events. */
export function fetchAudit(
  flowId: string,
  params: { action?: string; actor_id?: string; limit?: number; offset?: number } = {},
): Promise<Page<AuditEvent>> {
  const query = new URLSearchParams();
  if (params.action) query.set("action", params.action);
  if (params.actor_id) query.set("actor_id", params.actor_id);
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.offset !== undefined) query.set("offset", String(params.offset));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request(`/automation/flows/${encodeURIComponent(flowId)}/audit${suffix}`);
}
