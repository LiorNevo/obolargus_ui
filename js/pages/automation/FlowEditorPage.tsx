import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useBlocker, useNavigate, useParams } from "react-router-dom";
import { usePageTitle } from "lx_client/js/navigation/usePageTitle";
import { Button } from "lx_client/js/components/Button";
import { Modal } from "lx_client/js/components/Modal";
import { Skeleton } from "lx_client/js/components/Skeleton";
import TabPanel from "lx_client/js/components/TabPanel";
import {
  Toast,
  ToastRegion,
  type ToastTone,
} from "lx_client/js/components/Toast";
import {
  FlowEditor,
  cloneValue,
  emptyFlow,
  findFreePosition,
  normalizeFlowDocument,
  validateLocal,
  type FlowDocument,
  type FlowDebugEvent,
  type FlowEditorApi,
  type FlowMarker,
  type FlowSelection,
  type FlowNode,
  type FlowWorkspaceTab,
  type NodeTypeDescriptor,
  type Wire,
} from "lx_client/js/components/FlowEditor";
import type { ValidationView } from "../../types/automation";
import { AutomationApiError } from "../../api/automation";
import {
  useFlowQuery,
  useFlowsQuery,
  useNodeTypesQuery,
  useRunEvents,
  useRunLogsQuery,
  useRunQuery,
} from "../../query/automationQueries";
import {
  usePublishFlowMutation,
  useSaveDraftMutation,
  useStartRunMutation,
  useValidateFlowMutation,
} from "../../query/mutations";
import { AuditPanel } from "./AuditPanel";
import { ContextPanel } from "./ContextPanel";
import "./DataLoadNodeFields";
import { TriggerPanel } from "./TriggerPanel";
import { VersionPanel } from "./VersionPanel";
import { errorMessage, formatInstant } from "./shared";
import "./automation.css";

type PanelId =
  | "details"
  | "versions"
  | "triggers"
  | "context"
  | "audit"
  | "subflows";

type Notice = {
  message: string;
  tone: ToastTone;
};

const TERMINAL_RUN_STATUSES = new Set([
  "succeeded",
  "partial",
  "failed",
  "cancelled",
  "interrupted",
]);

const STRUCTURAL_TYPES: NodeTypeDescriptor[] = [
  {
    id: "subflow_input",
    version: 1,
    category: "flow",
    display_name: "Subflow input",
    description: "Structural input of the subflow.",
    icon: "login",
    outputs: [{ name: "out", label: "Output" }],
    config_schema: { type: "object", properties: {} },
    capabilities: [],
    deprecated: false,
    docs:
      "Receives the instance message when a subflow is invoked.\n\nConnect it to the first node in the subflow.",
  },
  {
    id: "subflow_output",
    version: 1,
    category: "flow",
    display_name: "Subflow output",
    description: "Structural output of the subflow.",
    icon: "logout",
    input: { name: "in", label: "Input" },
    outputs: [],
    config_schema: { type: "object", properties: {} },
    capabilities: [],
    deprecated: false,
    docs:
      "Forwards a message to the subflow instance output.\n\nConnect nodes here to return a message to the caller.",
  },
];

const PANELS: Array<{ id: PanelId; label: string }> = [
  { id: "details", label: "Details" },
  { id: "versions", label: "Versions" },
  { id: "triggers", label: "Triggers" },
  { id: "context", label: "Context" },
  { id: "audit", label: "Audit" },
  { id: "subflows", label: "Subflows" },
];

function toMarkers(validation: ValidationView): FlowMarker[] {
  return [...validation.errors, ...validation.warnings].map((finding) => ({
    code: finding.code,
    message: finding.message,
    severity: finding.severity,
    nodeId: finding.node_id,
    wireId: finding.wire_id,
  }));
}

function nextKey(prefix: string, used: Set<string>): string {
  let index = 1;
  while (used.has(`${prefix}${index}`)) index += 1;
  const value = `${prefix}${index}`;
  used.add(value);
  return value;
}

/**
 * Package the selected nodes into a subflow and replace them with one
 * subflow instance, preserving external wiring.
 */
function createSubflowFromSelection(
  document: FlowDocument,
  selection: FlowSelection,
): { document: FlowDocument | null; error: string | null } {
  const selected = new Set(selection.nodeIds);
  const nodes = document.nodes.filter((node) => selected.has(node.id));
  if (nodes.length === 0) {
    return { document: null, error: "Select at least one node first." };
  }
  const usedSubflowIds = new Set(document.subflows.map((subflow) => subflow.id));
  const subflowId = nextKey("sf", usedSubflowIds);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const internal = document.wires.filter(
    (wire) => nodeIds.has(wire.source) && nodeIds.has(wire.target),
  );
  const roots = nodes.filter(
    (node) => !internal.some((wire) => wire.target === node.id),
  );
  const sinks = nodes.filter(
    (node) => !internal.some((wire) => wire.source === node.id),
  );
  const usedWireIds = new Set(document.wires.map((wire) => wire.id));
  const subflowWires: Wire[] = [];
  const usedSubflowWires = new Set<string>();
  for (const root of roots) {
    subflowWires.push({
      id: nextKey("sw", usedSubflowWires),
      source: "in",
      source_port: "out",
      target: root.id,
      target_port: "in",
    });
  }
  subflowWires.push(...internal.map((wire) => ({ ...wire })));
  for (const sink of sinks) {
    subflowWires.push({
      id: nextKey("sw", usedSubflowWires),
      source: sink.id,
      source_port: "out",
      target: "out",
      target_port: "in",
    });
  }

  const minX = Math.min(...nodes.map((node) => node.position?.x ?? 0));
  const minY = Math.min(...nodes.map((node) => node.position?.y ?? 0));
  const instanceId = nextKey("sub", new Set(document.nodes.map((node) => node.id)));
  const instance: FlowNode = {
    id: instanceId,
    type: "subflow",
    type_version: 1,
    label: `Subflow ${document.subflows.length + 1}`,
    position: { x: minX, y: minY },
    config: { subflow_id: subflowId },
    retry: { max_attempts: 1, backoff_seconds: 0 },
    timeout_seconds: 300,
    error_policy: "fail",
  };

  const externalIncoming = document.wires.filter(
    (wire) => !nodeIds.has(wire.source) && nodeIds.has(wire.target),
  );
  const externalOutgoing = document.wires.filter(
    (wire) => nodeIds.has(wire.source) && !nodeIds.has(wire.target),
  );
  const wires: Wire[] = [];
  const seen = new Set<string>();
  for (const wire of externalIncoming) {
    const key = `${wire.source}:${wire.source_port}`;
    if (seen.has(key)) continue;
    seen.add(key);
    wires.push({
      ...wire,
      id: nextKey("w", usedWireIds),
      target: instanceId,
      target_port: "in",
    });
  }
  for (const wire of externalOutgoing) {
    wires.push({
      ...wire,
      id: nextKey("w", usedWireIds),
      source: instanceId,
      source_port: "out",
    });
  }

  return {
    document: {
      ...document,
      nodes: [
        ...document.nodes.filter((node) => !selected.has(node.id)),
        instance,
      ],
      wires: [
        ...document.wires.filter(
          (wire) => !nodeIds.has(wire.source) && !nodeIds.has(wire.target),
        ),
        ...wires,
      ],
      subflows: [
        ...document.subflows,
        {
          id: subflowId,
          name: `Subflow ${document.subflows.length + 1}`,
          inputs: [{ id: "in", label: "Input" }],
          outputs: [{ id: "out", label: "Output" }],
          nodes: [
            {
              id: "in",
              type: "subflow_input",
              type_version: 1,
              label: "Input",
              position: { x: 0, y: minY },
              config: {},
            },
            ...nodes.map((node) => cloneValue(node)),
            {
              id: "out",
              type: "subflow_output",
              type_version: 1,
              label: "Output",
              position: { x: minX + 400, y: minY },
              config: {},
            },
          ],
          wires: subflowWires,
        },
      ],
    },
    error: null,
  };
}

/** The authoring surface for one automation flow. */
export default function FlowEditorPage() {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();
  const flowQuery = useFlowQuery(flowId);
  const flowsQuery = useFlowsQuery({ limit: 200, offset: 0 });
  const nodeTypes = useNodeTypesQuery();
  const saveDraft = useSaveDraftMutation(flowId ?? "");
  const validate = useValidateFlowMutation(flowId ?? "");
  const publish = usePublishFlowMutation(flowId ?? "");
  const startRun = useStartRunMutation(flowId ?? "");
  const editor = useRef<FlowEditorApi>(null);
  const hydratedFlowId = useRef<string | null>(null);

  const [document, setDocument] = useState<FlowDocument | null>(null);
  const [revision, setRevision] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [markers, setMarkers] = useState<FlowMarker[]>([]);
  const [selection, setSelection] = useState<FlowSelection>({
    nodeIds: [],
    wireIds: [],
  });
  const [panel, setPanel] = useState<PanelId>("details");
  const [changeNote, setChangeNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const [runInputs, setRunInputs] = useState("{}");
  const [editingSubflow, setEditingSubflow] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runningNodeId, setRunningNodeId] = useState<string | null>(null);
  const [runFromNodeId, setRunFromNodeId] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const notifiedRun = useRef<string | null>(null);
  const activeRun = useRunQuery(activeRunId ?? undefined);
  const runLogs = useRunLogsQuery(activeRunId ?? undefined);
  const runTerminal = Boolean(
    activeRun.data && TERMINAL_RUN_STATUSES.has(activeRun.data.status),
  );
  useRunEvents(activeRunId ?? undefined, Boolean(activeRunId) && !runTerminal);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    const data = flowQuery.data;
    if (!data || hydratedFlowId.current === data.id) return;
    hydratedFlowId.current = data.id;
    const source =
      data.draft?.flow_json ?? data.current_version?.flow_json ?? null;
    const next = source
      ? normalizeFlowDocument(source, data.name)
      : emptyFlow(data.name);
    setDocument(next);
    setRevision(data.draft?.revision ?? null);
    setPublishedVersion(data.current_version?.version_number ?? null);
    setDirty(false);
    setMarkers([]);
    setSelection({ nodeIds: [], wireIds: [] });
    setEditingSubflow(null);
    setError(null);
    setNotice(
      !data.draft && data.current_version
        ? {
            message: `Loaded published v${data.current_version.version_number}. Save to create a new draft.`,
            tone: "info",
          }
        : null,
    );
    setConflict(false);
  }, [flowQuery.data]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  usePageTitle(flowQuery.data?.name ?? "Flow editor");

  useEffect(() => {
    if (!activeRunId || runTerminal) return;
    const timer = window.setInterval(() => {
      void activeRun.refetch?.();
      void runLogs.refetch?.();
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [activeRun.refetch, activeRunId, runLogs.refetch, runTerminal]);

  useEffect(() => {
    const run = activeRun.data;
    if (!run || !TERMINAL_RUN_STATUSES.has(run.status)) return;
    if (notifiedRun.current === run.id) return;
    notifiedRun.current = run.id;
    setNotice({
      message: `Run ${run.status}.`,
      tone:
        run.status === "succeeded"
          ? "success"
          : run.status === "partial"
            ? "warning"
            : "error",
    });
  }, [activeRun.data]);

  const catalog = useMemo(() => nodeTypes.data?.items ?? [], [nodeTypes.data]);

  const activeSubflow = editingSubflow
    ? document?.subflows.find((subflow) => subflow.id === editingSubflow)
    : undefined;
  const subflowMode = Boolean(activeSubflow);
  const editorNodeTypes = useMemo(
    () => (subflowMode ? [...catalog, ...STRUCTURAL_TYPES] : catalog),
    [catalog, subflowMode],
  );
  const editorDocument =
    document && activeSubflow
      ? { ...document, nodes: activeSubflow.nodes, wires: activeSubflow.wires }
      : document;

  const workspaceTabs = useMemo<FlowWorkspaceTab[]>(() => {
    const tabs: FlowWorkspaceTab[] = [];
    const seen = new Set<string>();
    const addFlowTab = (id: string, label: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      tabs.push({
        id: `flow:${id}`,
        label: label || "Untitled automation",
        icon: "account_tree",
        kind: "flow",
        dirty: id === flowId && dirty,
      });
    };

    for (const flow of flowsQuery.data?.items ?? []) {
      if (flow.status === "archived") continue;
      addFlowTab(flow.id, flow.name);
    }
    if (flowQuery.data) {
      addFlowTab(flowQuery.data.id, flowQuery.data.name);
    }
    if (document) {
      for (const subflow of document.subflows) {
        tabs.push({
          id: `subflow:${subflow.id}`,
          label: subflow.name,
          icon: "call_split",
          kind: "subflow",
          dirty,
        });
      }
    }
    return tabs;
  }, [document, dirty, flowId, flowQuery.data, flowsQuery.data]);

  const activeWorkspaceTab = editingSubflow
    ? `subflow:${editingSubflow}`
    : `flow:${flowId ?? ""}`;

  const debugEvents = useMemo<FlowDebugEvent[]>(() => {
    const labels = new Map<string, string>();
    for (const node of document?.nodes ?? []) {
      const descriptor = catalog.find(
        (candidate) =>
          candidate.id === node.type &&
          candidate.version === node.type_version,
      );
      labels.set(
        node.id,
        node.label || descriptor?.display_name || node.id,
      );
    }
    const events: FlowDebugEvent[] = (runLogs.data?.items ?? []).map(
      (log) => ({
        id: `log:${log.id}`,
        sourceNodeId: log.node_id ?? undefined,
        sourceLabel: log.node_id
          ? labels.get(log.node_id) ?? log.node_id
          : "run",
        ts: log.ts,
        value: log.fields ?? log.message,
      }),
    );
    if (activeRun.data?.error) {
      events.push({
        id: `run:${activeRun.data.id}:error`,
        sourceLabel: "run",
        ts:
          activeRun.data.ended_at ??
          activeRun.data.started_at ??
          activeRun.data.queued_at,
        value: activeRun.data.error,
      });
    }
    return events;
  }, [activeRun.data, catalog, document, runLogs.data]);

  const handleWorkspaceTabChange = (tabId: string) => {
    if (tabId.startsWith("flow:")) {
      const id = tabId.slice("flow:".length);
      if (id === flowId) {
        setEditingSubflow(null);
        setSelection({ nodeIds: [], wireIds: [] });
        return;
      }
      navigate(`/automation/flows/${id}`);
      return;
    }

    if (tabId.startsWith("subflow:")) {
      const id = tabId.slice("subflow:".length);
      if (id === editingSubflow) return;
      if (!document?.subflows.some((subflow) => subflow.id === id)) return;
      setEditingSubflow(id);
      setSelection({ nodeIds: [], wireIds: [] });
      setNotice(null);
    }
  };

  const handleAddWorkspaceTab = () => {
    navigate("/automation/flows?new=1");
  };

  const selectedSubflow = useMemo(() => {
    if (!document || selection.nodeIds.length !== 1) return null;
    const node = document.nodes.find(
      (candidate) => candidate.id === selection.nodeIds[0],
    );
    if (!node || node.type !== "subflow") return null;
    const subflowId = node.config?.subflow_id;
    if (typeof subflowId !== "string") return null;
    return document.subflows.find((subflow) => subflow.id === subflowId) ?? null;
  }, [document, selection.nodeIds]);

  const applyDocument = (next: FlowDocument) => {
    setDocument(next);
    setDirty(true);
    setNotice(null);
    setError(null);
  };

  const handleEditorChange = (next: FlowDocument) => {
    if (!document) return;
    if (activeSubflow) {
      setDocument({
        ...document,
        subflows: document.subflows.map((subflow) =>
          subflow.id === activeSubflow.id
            ? { ...subflow, nodes: next.nodes, wires: next.wires }
            : subflow,
        ),
      });
      setDirty(true);
      setNotice(null);
      setError(null);
      return;
    }
    applyDocument(next);
  };

  const reloadLatest = () => {
    hydratedFlowId.current = null;
    setConflict(false);
    void flowQuery.refetch();
  };

  const save = async () => {
    if (!document) return null;
    setError(null);
    setConflict(false);
    try {
      const saved = await saveDraft.mutateAsync({
        flow: document,
        expectedRevision: revision ?? undefined,
      });
      setRevision(saved.revision);
      setMarkers(toMarkers(saved.validation));
      setDirty(false);
      setNotice({ message: "Draft saved.", tone: "success" });
      return saved;
    } catch (mutationError) {
      if (
        mutationError instanceof AutomationApiError &&
        mutationError.status === 409
      ) {
        setConflict(true);
        setError(
          "This draft changed elsewhere. Reload the latest revision before saving.",
        );
      } else {
        setError(errorMessage(mutationError));
      }
      return null;
    }
  };

  const runValidation = async () => {
    if (!document) return;
    setError(null);
    try {
      const validation = await validate.mutateAsync({ flow: document });
      setMarkers(toMarkers(validation));
      setNotice(
        validation.errors.length === 0
          ? { message: "The flow is valid.", tone: "success" }
          : {
              message: `${validation.errors.length} validation error(s).`,
              tone: "warning",
            },
      );
    } catch (mutationError) {
      setError(errorMessage(mutationError));
    }
  };

  const publishFlow = async () => {
    if (!document) return;
    setPublishError(null);
    if (!changeNote.trim()) {
      setPublishError("Enter a change note before publishing.");
      return;
    }
    const checked = validateLocal(document, catalog);
    if (checked.hasErrors) {
      setMarkers(checked.markers);
      setPublishError("Fix the validation errors before publishing.");
      return;
    }
    let expectedRevision = revision ?? 0;
    try {
      if (dirty || revision === null) {
        const saved = await saveDraft.mutateAsync({
          flow: document,
          expectedRevision: revision ?? undefined,
        });
        setRevision(saved.revision);
        setMarkers(toMarkers(saved.validation));
        setDirty(false);
        expectedRevision = saved.revision;
        if (saved.validation.errors.length > 0) {
          setPublishError(
            "The server rejected the draft validation. Fix the errors and try again.",
          );
          return;
        }
      }
      const version = await publish.mutateAsync({
        expectedRevision,
        changeNote: changeNote.trim(),
      });
      setPublishedVersion(version.version_number);
      setChangeNote("");
      setMarkers(toMarkers(version.validation));
      setDirty(false);
      setPublishOpen(false);
      setError(null);
      setNotice({
        message: `Published v${version.version_number}.`,
        tone: "success",
      });
    } catch (mutationError) {
      const message = errorMessage(mutationError);
      setPublishError(message);
      setError(message);
      if (
        mutationError instanceof AutomationApiError &&
        mutationError.status === 409
      ) {
        setConflict(true);
      }
    }
  };

  const startEditorRun = async (
    nodeId: string | null,
    inputs: unknown,
    fromModal: boolean,
  ) => {
    setError(null);
    setRunningNodeId(nodeId);
    try {
      const accepted = await startRun.mutateAsync({
        inputs,
        ...(nodeId ? { inject_node_id: nodeId } : {}),
      });
      notifiedRun.current = null;
      setActiveRunId(accepted.run_id);
      setRunOpen(false);
      setRunFromNodeId(null);
      setRunError(null);
      setNotice({
        message: "Run started. Debug output appears in the Debug tab.",
        tone: "info",
      });
    } catch (mutationError) {
      const message = errorMessage(mutationError);
      if (fromModal) setRunError(message);
      else setError(message);
    } finally {
      setRunningNodeId(null);
    }
  };

  const runFromNode = async (nodeId: string) => {
    setError(null);
    if (publishedVersion === null) {
      setError("Publish a version before running this flow.");
      return;
    }
    const requiredInputs = (document?.inputs ?? []).filter(
      (input) => input.required && !input.secret,
    );
    if (requiredInputs.length > 0) {
      setRunFromNodeId(nodeId);
      setRunError(null);
      setRunOpen(true);
      return;
    }
    await startEditorRun(nodeId, {}, false);
  };

  const runFlow = async () => {
    setRunError(null);
    if (publishedVersion === null) {
      setRunError("Publish a version before running this flow.");
      return;
    }
    let inputs: unknown = {};
    try {
      inputs = runInputs.trim() ? JSON.parse(runInputs) : {};
    } catch {
      setRunError("Run inputs must be valid JSON.");
      return;
    }
    await startEditorRun(runFromNodeId, inputs, true);
  };

  const closeRunModal = () => {
    setRunOpen(false);
    setRunFromNodeId(null);
    setRunError(null);
  };

  const createSubflow = () => {
    if (!document) return;
    const result = createSubflowFromSelection(document, selection);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.document) {
      applyDocument(result.document);
      setSelection({ nodeIds: [], wireIds: [] });
      setNotice({
        message: "Subflow created from the selection.",
        tone: "success",
      });
      setSettingsOpen(false);
    }
  };

  const instantiateSubflow = (subflowId: string, name: string) => {
    if (!document) return;
    const instance: FlowNode = {
      id: nextKey("sub", new Set(document.nodes.map((node) => node.id))),
      type: "subflow",
      type_version: 1,
      label: name,
      position: findFreePosition(document.nodes, { x: 80, y: 80 }),
      config: { subflow_id: subflowId },
      retry: { max_attempts: 1, backoff_seconds: 0 },
      timeout_seconds: 300,
      error_policy: "fail",
    };
    applyDocument({
      ...document,
      nodes: [...document.nodes, instance],
    });
    setSettingsOpen(false);
  };

  if (flowQuery.isError) {
    return (
      <main className="obolargus_automation_page">
        <p className="obolargus_automation_error" role="alert">
          {errorMessage(flowQuery.error)}
        </p>
        <Link to="/automation/flows">Back to flows</Link>
      </main>
    );
  }
  if (nodeTypes.isError) {
    return (
      <main className="obolargus_automation_page">
        <p className="obolargus_automation_error" role="alert">
          {errorMessage(nodeTypes.error)}
        </p>
      </main>
    );
  }
  if (
    flowQuery.isPending ||
    nodeTypes.isPending ||
    !document ||
    hydratedFlowId.current !== flowId
  ) {
    return (
      <main className="obolargus_automation_page">
        <Skeleton />
      </main>
    );
  }

  const settingsTabIndex = Math.max(
    0,
    PANELS.findIndex((entry) => entry.id === panel),
  );

  const settingsPanelByTab = {
    details:
      panel === "details" ? (
        <section
          className="obolargus_automation_panel"
          aria-label="Flow details"
        >
          <h2>Details</h2>
          <dl>
            <dt>Description</dt>
            <dd>{flowQuery.data?.description || "No description."}</dd>
            <dt>Tags</dt>
            <dd>{flowQuery.data?.tags.join(", ") || "None"}</dd>
            <dt>Status</dt>
            <dd>{flowQuery.data?.status}</dd>
            <dt>Updated</dt>
            <dd>{formatInstant(flowQuery.data?.updated_at)}</dd>
          </dl>
        </section>
      ) : null,
    versions:
      panel === "versions" && flowId ? (
        <VersionPanel
          flowId={flowId}
          currentVersionNumber={publishedVersion}
        />
      ) : null,
    triggers:
      panel === "triggers" && flowId ? <TriggerPanel flowId={flowId} /> : null,
    context:
      panel === "context" && flowId ? <ContextPanel flowId={flowId} /> : null,
    audit:
      panel === "audit" && flowId ? <AuditPanel flowId={flowId} /> : null,
    subflows:
      panel === "subflows" ? (
        <section className="obolargus_automation_panel" aria-label="Subflows">
          <h2>Subflows</h2>
          {document.subflows.length === 0 ? (
            <p>
              No subflows. Select nodes and package them to reuse their logic.
            </p>
          ) : (
            <ul className="obolargus_automation_subflow_list">
              {document.subflows.map((subflow) => (
                <li key={subflow.id}>
                  <span>
                    <strong>{subflow.name}</strong>{" "}
                    <span className="obolargus_automation_meta">
                      {subflow.id} · {subflow.nodes.length} nodes
                    </span>
                  </span>
                  <span className="obolargus_automation_row_actions">
                    <Button
                      onClick={() => {
                        setEditingSubflow(subflow.id);
                        setSelection({ nodeIds: [], wireIds: [] });
                        setSettingsOpen(false);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() =>
                        instantiateSubflow(subflow.id, subflow.name)
                      }
                    >
                      Instantiate
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button
            onClick={createSubflow}
            disabled={selection.nodeIds.length === 0}
          >
            Create subflow from selection
          </Button>
          {selectedSubflow ? (
            <p className="obolargus_automation_meta" role="status">
              Selected instance uses subflow{" "}
              <strong>{selectedSubflow.name}</strong> ({selectedSubflow.id}).
            </p>
          ) : null}
        </section>
      ) : null,
  };

  const settingsTabItems = PANELS.map((entry) => ({
    id: entry.id,
    header: entry.label,
    component: settingsPanelByTab[entry.id],
  }));

  return (
    <main
      className="obolargus_automation_page obolargus_automation_page--flow"
      aria-labelledby="flow-editor-title"
    >
      <h1 id="flow-editor-title" className="obolargus_visually_hidden">
        {flowQuery.data?.name}
      </h1>

      <div className="obolargus_automation_flowbar">
        <div className="obolargus_automation_flowbar__left">
          <Button
            variant="ghost"
            className="obolargus_automation_compact"
            onClick={() => navigate("/automation/flows")}
          >
            Flows
          </Button>
          <span className="obolargus_automation_flowbar__meta">
            <span
              className={
                dirty
                  ? "obolargus_automation_flowbar__dirty"
                  : "obolargus_automation_flowbar__saved"
              }
              role="status"
            >
              {dirty ? "Unsaved changes" : "Saved"}
            </span>{" "}
            · Revision {revision ?? "new"} ·{" "}
            {publishedVersion ? `published v${publishedVersion}` : "unpublished"}
          </span>
          {activeRunId ? (
            <span
              className="obolargus_automation_runstatus"
              data-status={activeRun.data?.status ?? "queued"}
              role="status"
            >
              Run {activeRun.data?.status ?? "queued"}
            </span>
          ) : null}
          {activeSubflow ? (
            <span className="obolargus_automation_flowbar__subflow">
              Subflow <strong>{activeSubflow.name}</strong>
              <button
                type="button"
                onClick={() => {
                  setEditingSubflow(null);
                  setSelection({ nodeIds: [], wireIds: [] });
                }}
              >
                Done
              </button>
            </span>
          ) : null}
        </div>
        <div className="obolargus_automation_flowbar__actions">
          <Button
            variant="ghost"
            className="obolargus_automation_compact"
            onClick={() => setSettingsOpen(true)}
          >
            Flow settings
          </Button>
          <Button
            className="obolargus_automation_compact"
            onClick={() => void save()}
            disabled={saveDraft.isPending || (!dirty && revision !== null)}
          >
            {saveDraft.isPending ? "Saving…" : "Save draft"}
          </Button>
          <Button
            className="obolargus_automation_compact"
            onClick={() => void runValidation()}
            disabled={validate.isPending}
          >
            {validate.isPending ? "Validating…" : "Validate"}
          </Button>
          <Button
            variant="primary"
            className="obolargus_automation_compact"
            onClick={() => {
              setPublishError(null);
              setPublishOpen(true);
            }}
          >
            Publish
          </Button>
        </div>
      </div>

      {error || notice ? (
        <ToastRegion>
          {error ? (
            <Toast
              tone="error"
              title="Something went wrong"
              onClose={() => setError(null)}
              action={
                conflict ? (
                  <Button variant="ghost" onClick={reloadLatest}>
                    Reload latest
                  </Button>
                ) : undefined
              }
            >
              {error}
            </Toast>
          ) : null}
          {notice ? (
            <Toast
              tone={notice.tone}
              onClose={() => setNotice(null)}
              autoCloseMs={6000}
            >
              {notice.message}
            </Toast>
          ) : null}
        </ToastRegion>
      ) : null}

      <FlowEditor
        key={`${flowId ?? "flow"}:${editingSubflow ?? "flow"}`}
        ref={editor}
        document={editorDocument as FlowDocument}
        nodeTypes={editorNodeTypes}
        markers={activeSubflow ? [] : markers}
        debugEvents={debugEvents}
        selection={selection}
        onChange={handleEditorChange}
        onSelectionChange={setSelection}
        workspaceTabs={workspaceTabs}
        activeWorkspaceTab={activeWorkspaceTab}
        onWorkspaceTabChange={handleWorkspaceTabChange}
        onAddWorkspaceTab={handleAddWorkspaceTab}
        addWorkspaceTabLabel="New flow"
        onRunNode={
          activeSubflow
            ? undefined
            : (nodeId) => void runFromNode(nodeId)
        }
        runningNodeId={runningNodeId}
        debugRevealKey={activeRunId ?? runningNodeId}
      />

      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Flow settings"
        className="obolargus_automation_modal"
        footer={<Button onClick={() => setSettingsOpen(false)}>Close</Button>}
      >
        <TabPanel
          variant="plain"
          className="obolargus_automation_settings_tabs"
          ariaLabel="Flow panels"
          tabs={settingsTabItems}
          selected={settingsTabIndex}
          onSelect={(index) => {
            const entry = PANELS[index];
            if (entry) setPanel(entry.id);
          }}
        />
      </Modal>

      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title="Publish flow"
        className="obolargus_automation_modal"
        footer={
          <>
            <Button onClick={() => setPublishOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => void publishFlow()}
              disabled={publish.isPending}
            >
              {publish.isPending ? "Publishing…" : "Publish"}
            </Button>
          </>
        }
      >
        <p className="obolargus_automation_meta">
          {dirty
            ? "The current draft is saved before publishing."
            : "The saved draft will be published."}{" "}
          Current published version:{" "}
          {publishedVersion ? `v${publishedVersion}` : "none"}.
        </p>
        <label className="obolargus_automation_field">
          <span>Change note</span>
          <input
            value={changeNote}
            onChange={(event) => setChangeNote(event.target.value)}
            placeholder="What changed?"
          />
        </label>
        {publishError ? (
          <p className="obolargus_automation_error" role="alert">
            {publishError}
          </p>
        ) : null}
      </Modal>

      <Modal
        open={runOpen}
        onClose={closeRunModal}
        title="Run flow"
        className="obolargus_automation_modal"
        footer={
          <>
            <Button onClick={closeRunModal}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => void runFlow()}
              disabled={startRun.isPending || publishedVersion === null}
            >
              {startRun.isPending ? "Starting…" : "Run with inputs"}
            </Button>
          </>
        }
      >
        <p className="obolargus_automation_meta">
          Runs the latest published version
          {publishedVersion ? ` (v${publishedVersion})` : ""}
          {runFromNodeId ? " from the selected inject node" : ""}.
          {dirty ? " Unsaved changes are not included." : ""}
        </p>
        {runFromNodeId ? (
          <p className="obolargus_automation_meta">
            Starting from{" "}
            <strong>
              {document.nodes.find((node) => node.id === runFromNodeId)
                ?.label ?? runFromNodeId}
            </strong>
            . That node and every downstream node will run.
          </p>
        ) : null}
        {publishedVersion === null ? (
          <p className="obolargus_automation_error" role="alert">
            Publish a version before running this flow.
          </p>
        ) : null}
        <label className="obolargus_automation_field">
          <span>Run inputs (JSON)</span>
          <textarea
            rows={8}
            value={runInputs}
            onChange={(event) => setRunInputs(event.target.value)}
            placeholder={
              '{\n  "identifiers": [{"scheme": "TICKER", "value": "XNAS:AAPL"}]\n}'
            }
          />
        </label>
        {runError ? (
          <p className="obolargus_automation_error" role="alert">
            {runError}
          </p>
        ) : null}
      </Modal>

      <Modal
        open={blocker.state === "blocked"}
        onClose={() => {
          if (blocker.state === "blocked") blocker.reset();
        }}
        title="Unsaved changes"
        role="alertdialog"
        footer={
          <>
            <Button
              onClick={() => {
                if (blocker.state === "blocked") blocker.reset();
              }}
            >
              Stay on this page
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (blocker.state === "blocked") blocker.proceed();
              }}
            >
              Discard changes
            </Button>
          </>
        }
      >
        <p>You have unsaved changes. Discard them and leave this page?</p>
      </Modal>
    </main>
  );
}
