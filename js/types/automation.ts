/**
 * Automation workflow types.
 *
 * Mirrors the canonical contracts in
 * `specs/030-automation-workflow-engine/contracts/` and the server response
 * projections. JSON stays structurally compatible with `FlowDocument` in
 * `obolargus_core`.
 */

/** Current flow document schema version. */
export const FLOW_SCHEMA_VERSION = 1;

/** Canvas position. */
export interface NodePosition {
  x: number;
  y: number;
}

/** Retry policy. */
export interface RetryPolicy {
  max_attempts: number;
  backoff_seconds: number;
}

/** A configured node instance. */
export interface FlowNode {
  id: string;
  type: string;
  type_version: number;
  label?: string;
  position?: NodePosition;
  config?: Record<string, unknown>;
  retry?: RetryPolicy;
  timeout_seconds?: number;
  error_policy?: "fail" | "continue" | "catch";
}

/** A wire from an output port to a target input. */
export interface Wire {
  id: string;
  source: string;
  source_port: string;
  target: string;
  target_port: string;
}

/** A declared runtime input. */
export interface RuntimeInput {
  name: string;
  type: string;
  required?: boolean;
  default?: unknown;
  secret?: boolean;
  description?: string;
}

/** A subflow input declaration. */
export interface SubflowInput {
  id: string;
  label?: string;
}

/** A subflow output declaration. */
export interface SubflowOutput {
  id: string;
  label?: string;
}

/** A reusable flow fragment. */
export interface Subflow {
  id: string;
  name: string;
  inputs: SubflowInput[];
  outputs: SubflowOutput[];
  nodes: FlowNode[];
  wires: Wire[];
}

/** A versioned automation flow document. */
export interface FlowDocument {
  schema_version: number;
  name: string;
  description: string;
  tags: string[];
  inputs: RuntimeInput[];
  nodes: FlowNode[];
  wires: Wire[];
  subflows: Subflow[];
}

/** A node input or output port. */
export interface PortDescriptor {
  name: string;
  label?: string;
}

/** A node type descriptor served by the catalog. */
export interface NodeTypeDescriptor {
  id: string;
  version: number;
  category:
    | "trigger"
    | "data"
    | "transform"
    | "flow"
    | "error"
    | "notify"
    | "output";
  display_name: string;
  description: string;
  icon: string;
  input?: PortDescriptor;
  outputs: PortDescriptor[];
  config_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  capabilities: string[];
  deprecated: boolean;
  docs: string;
}

/** A validation finding. */
export interface ValidationFinding {
  code: string;
  message: string;
  severity: "error" | "warning";
  node_id?: string;
  wire_id?: string;
  path?: string;
}

/** A validation report projection. */
export interface ValidationView {
  errors: ValidationFinding[];
  warnings: ValidationFinding[];
}

/** Template summary. */
export interface TemplateSummary {
  id: string;
  version: number;
  name: string;
  description: string;
  category: string;
  node_count: number;
}

/** Template detail. */
export interface TemplateDetail extends TemplateSummary {
  flow_json: FlowDocument;
  inputs_schema: Record<string, unknown>;
}

/** Pagination envelope. */
export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/** A flow list item. */
export interface FlowSummary {
  id: string;
  name: string;
  description: string;
  tags: string[];
  status: string;
  owner_id: string;
  current_version_number: number | null;
  draft_revision: number;
  last_run: { id: string; status: string; ended_at: string | null } | null;
  next_scheduled_run_at: string | null;
  updated_at: string;
}

/** A draft projection. */
export interface DraftView {
  revision: number;
  flow_json: FlowDocument;
  updated_at: string;
}

/** A published version projection. */
export interface VersionSummary {
  id: string;
  version_number: number;
  status: string;
  change_note: string | null;
  published_by: string | null;
  published_at: string | null;
}

/** A version with its document. */
export interface VersionDetail extends VersionSummary {
  flow_json: FlowDocument;
  validation: ValidationView;
}

/** Flow detail. */
export interface FlowDetail {
  id: string;
  name: string;
  description: string;
  tags: string[];
  status: string;
  owner_id: string;
  draft: DraftView | null;
  current_version: {
    id: string;
    version_number: number;
    published_at: string | null;
    change_note: string | null;
    /** Published document, used when a flow has no draft. */
    flow_json?: FlowDocument;
  } | null;
  created_at: string;
  updated_at: string;
}

/** Result of saving a draft. */
export interface DraftResponse extends DraftView {
  validation: ValidationView;
}

/** Run creation acknowledgement. */
export interface RunAccepted {
  run_id: string;
  parent_run_id?: string;
  status: string;
  flow_version_number?: number;
}

/** Run list item. */
export interface RunSummary {
  id: string;
  flow_id: string;
  flow_name: string;
  flow_version_number: number | null;
  trigger_kind: string;
  trigger_node_id: string | null;
  actor_id: string | null;
  status: string;
  queued_at: string;
  started_at: string | null;
  ended_at: string | null;
  duration_ms: number | null;
  message_count: number;
  summary: Record<string, unknown>;
}

/** Node run detail. */
export interface NodeDetail {
  node_id: string;
  attempt: number;
  status: string;
  input_message: unknown;
  output_messages: unknown;
  output_truncated: boolean;
  messages_in: number;
  messages_out: number;
  error: unknown;
}

/** Run detail. */
export interface RunDetail {
  id: string;
  flow_id: string;
  flow_version_id: string;
  flow_version_number: number | null;
  trigger_kind: string;
  trigger_node_id: string | null;
  actor_id: string | null;
  status: string;
  inputs: unknown;
  outputs: unknown;
  summary: Record<string, unknown>;
  error: unknown;
  parent_run_id: string | null;
  queued_at: string;
  started_at: string | null;
  ended_at: string | null;
  duration_ms: number | null;
  message_count: number;
  nodes: Array<{
    node_id: string;
    node_type_id: string;
    node_type_version: number;
    attempt: number;
    status: string;
    started_at: string | null;
    ended_at: string | null;
    duration_ms: number | null;
    messages_in: number;
    messages_out: number;
    output_truncated: boolean;
  }>;
}

/** A run message. */
export interface RunMessage {
  id: number;
  node_id: string | null;
  direction: "in" | "out";
  output_port: string | null;
  msg_id: string;
  ts: string;
  size_bytes: number;
  truncated: boolean;
  payload?: unknown;
}

/** A run log line. */
export interface RunLog {
  id: number;
  node_id: string | null;
  ts: string;
  level: string;
  message: string;
  fields: unknown;
}

/** A trigger projection. */
export interface Trigger {
  id: string;
  kind: string;
  node_id: string | null;
  enabled: boolean;
  repeat_kind: string | null;
  cron_expression: string | null;
  interval_seconds: number | null;
  timezone: string;
  overlap_policy: string;
  missed_policy: string;
  next_occurrence_at: string | null;
  last_occurrence_at: string | null;
}

/** A durable context entry. */
export interface ContextEntry {
  scope: string;
  scope_id: string;
  key: string;
  value: unknown;
  updated_at: string;
  updated_by_run_id: string | null;
}

/** An audit event. */
export interface AuditEvent {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  outcome: string;
  metadata: unknown;
  created_at: string;
}

/** The server JSON error envelope. */
export interface AutomationErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** The default template id shipped with the server. */
export const DATA_LOAD_TEMPLATE_ID = "data-load-single-date";
