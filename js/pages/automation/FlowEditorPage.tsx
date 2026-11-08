import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useBlocker, useNavigate, useParams } from "react-router-dom";
import { usePageTitle } from "lx_client/js/navigation/usePageTitle";
import { Button } from "lx_client/js/components/Button";
import { Skeleton } from "lx_client/js/components/Skeleton";
import {
  FlowEditor,
  cloneValue,
  emptyFlow,
  type FlowDocument,
  type FlowEditorApi,
  type FlowMarker,
  type FlowSelection,
  type FlowNode,
  type Wire,
} from "lx_client/js/components/FlowEditor";
import type { ValidationView } from "../../types/automation";
import {
  useFlowQuery,
  useNodeTypesQuery,
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


type PanelId = "details" | "versions" | "triggers" | "context" | "audit";

const STRUCTURAL_TYPES = [
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
    docs: "Receives the instance message.",
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
    docs: "Forwards a message to the subflow instance output.",
  },
];

const PANELS: Array<{ id: PanelId; label: string }> = [
  { id: "details", label: "Details" },
  { id: "versions", label: "Versions" },
  { id: "triggers", label: "Triggers" },
  { id: "context", label: "Context" },
  { id: "audit", label: "Audit" },
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
      wires: [...document.wires.filter((wire) => !nodeIds.has(wire.source) && !nodeIds.has(wire.target)), ...wires],
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
  const nodeTypes = useNodeTypesQuery();
  const saveDraft = useSaveDraftMutation(flowId ?? "");
  const validate = useValidateFlowMutation(flowId ?? "");
  const publish = usePublishFlowMutation(flowId ?? "");
  const startRun = useStartRunMutation(flowId ?? "");
  const editor = useRef<FlowEditorApi>(null);

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
  const [notice, setNotice] = useState<string | null>(null);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const [runInputs, setRunInputs] = useState("{}");
  const [editingSubflow, setEditingSubflow] = useState<string | null>(null);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!flowQuery.data) return;
    const next =
      flowQuery.data.draft?.flow_json ?? emptyFlow(flowQuery.data.name);
    setDocument(next);
    setRevision(flowQuery.data.draft?.revision ?? null);
    setPublishedVersion(
      flowQuery.data.current_version?.version_number ?? null,
    );
    setDirty(false);
    setMarkers([]);
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

  const descriptorCount = nodeTypes.data?.items.length ?? 0;
  const selectedSubflow = useMemo(() => {
    if (!document || selection.nodeIds.length !== 1) return null;
    const node = document.nodes.find(
      (candidate) => candidate.id === selection.nodeIds[0],
    );
    if (!node || node.type !== "subflow") return null;
    const subflowId = node.config?.subflow_id;
    return (
      document.subflows.find((subflow) => subflow.id === subflowId) ?? null
    );
  }, [document, selection.nodeIds]);

  const applyDocument = (next: FlowDocument) => {
    setDocument(next);
    setDirty(true);
    setNotice(null);
  };

  const activeSubflow = editingSubflow
    ? document?.subflows.find((subflow) => subflow.id === editingSubflow)
    : undefined;
  const editorDocument =
    document && activeSubflow
      ? { ...document, nodes: activeSubflow.nodes, wires: activeSubflow.wires }
      : document;
  const editorNodeTypes = nodeTypes.data
    ? activeSubflow
      ? [...nodeTypes.data.items, ...STRUCTURAL_TYPES]
      : nodeTypes.data.items
    : [];
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
      return;
    }
    applyDocument(next);
  };

  const save = async () => {
    if (!document) return;
    setError(null);
    try {
      const saved = await saveDraft.mutateAsync({
        flow: document,
        expectedRevision: revision ?? undefined,
      });
      setRevision(saved.revision);
      setMarkers(toMarkers(saved.validation));
      setDirty(false);
      setNotice("Draft saved.");
    } catch (mutationError) {
      setError(errorMessage(mutationError));
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
          ? "The flow is valid."
          : `${validation.errors.length} validation error(s).`,
      );
    } catch (mutationError) {
      setError(errorMessage(mutationError));
    }
  };

  const publishFlow = async () => {
    if (!document) return;
    if (!changeNote.trim()) {
      setError("Enter a change note before publishing.");
      return;
    }
    setError(null);
    try {
      const version = await publish.mutateAsync({
        expectedRevision: revision ?? 0,
        changeNote: changeNote.trim(),
      });
      setPublishedVersion(version.version_number);
      setChangeNote("");
      setMarkers(toMarkers(version.validation));
      setNotice(`Published v${version.version_number}.`);
    } catch (mutationError) {
      setError(errorMessage(mutationError));
    }
  };

  const start = async (rawInputs = "{}") => {
    setError(null);
    let inputs: unknown = {};
    try {
      inputs = rawInputs.trim() ? JSON.parse(rawInputs) : {};
    } catch {
      setError("Run inputs must be valid JSON.");
      return;
    }
    try {
      const accepted = await startRun.mutateAsync({ inputs });
      navigate(`/automation/runs/${accepted.run_id}`);
    } catch (mutationError) {
      setError(errorMessage(mutationError));
    }
  };

  if (flowQuery.isPending || nodeTypes.isPending) {
    return (
      <main className="obolargus_automation_page">
        <Skeleton />
      </main>
    );
  }
  if (flowQuery.isError || !document) {
    return (
      <main className="obolargus_automation_page">
        <p className="obolargus_automation_error" role="alert">
          {errorMessage(flowQuery.error)}
        </p>
        <Link to="/automation">Back to automation</Link>
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

  return (
    <main className="obolargus_automation_page" aria-labelledby="flow-editor-title">
      <header className="obolargus_automation_header">
        <div>
          <p className="obolargus_automation_meta">
            <Link to="/automation">Automation</Link> / Draft
          </p>
          <h1 id="flow-editor-title">{flowQuery.data?.name}</h1>
          <p className="obolargus_automation_meta">
            Revision {revision ?? "new"} ·{" "}
            {publishedVersion ? `published v${publishedVersion}` : "never published"}{" "}
            · {descriptorCount} node types
          </p>
        </div>
        <div className="obolargus_automation_header__actions">
          <label>
            <span>Change note</span>
            <input
              value={changeNote}
              onChange={(event) => setChangeNote(event.target.value)}
              placeholder="What changed?"
            />
          </label>
          <Button onClick={() => void start()} disabled={startRun.isPending}>
            {startRun.isPending ? "Starting…" : "Run"}
          </Button>
          <Button onClick={() => void publishFlow()} disabled={publish.isPending}>
            {publish.isPending ? "Publishing…" : "Publish"}
          </Button>
          <Button onClick={() => void save()} disabled={saveDraft.isPending}>
            {saveDraft.isPending ? "Saving…" : "Save draft"}
          </Button>
          <Button onClick={() => void runValidation()} disabled={validate.isPending}>
            {validate.isPending ? "Validating…" : "Validate"}
          </Button>
        </div>
      </header>

      {error ? (
        <p className="obolargus_automation_error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="obolargus_automation_notice" role="status">
          {notice}
        </p>
      ) : null}

      {activeSubflow ? (
        <p className="obolargus_automation_notice" role="status">
          Editing subflow <strong>{activeSubflow.name}</strong>. Structural
          input/output nodes are editable while this mode is active.{" "}
          <button
            type="button"
            onClick={() => {
              setEditingSubflow(null);
              setSelection({ nodeIds: [], wireIds: [] });
            }}
          >
            Done editing subflow
          </button>
        </p>
      ) : null}
      <FlowEditor
        key={editingSubflow ?? "flow"}
        ref={editor}
        document={editorDocument as FlowDocument}
        nodeTypes={editorNodeTypes}
        markers={activeSubflow ? [] : markers}
        selection={selection}
        onChange={handleEditorChange}
        onSelectionChange={setSelection}
      />

      <section className="obolargus_automation_subflows" aria-label="Subflows">
        <h2>Subflows</h2>
        {document.subflows.length === 0 ? (
          <p>No subflows. Select nodes and package them to reuse their logic.</p>
        ) : (
          <ul>
            {document.subflows.map((subflow) => (
              <li key={subflow.id}>
                <strong>{subflow.name}</strong>{" "}
                <span className="obolargus_automation_meta">
                  {subflow.id} · {subflow.nodes.length} nodes
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingSubflow(subflow.id);
                    setSelection({ nodeIds: [], wireIds: [] });
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const instance: FlowNode = {
                      id: nextKey(
                        "sub",
                        new Set(document.nodes.map((node) => node.id)),
                      ),
                      type: "subflow",
                      type_version: 1,
                      label: subflow.name,
                      position: { x: 80, y: 80 + document.nodes.length * 40 },
                      config: { subflow_id: subflow.id },
                      retry: { max_attempts: 1, backoff_seconds: 0 },
                      timeout_seconds: 300,
                      error_policy: "fail",
                    };
                    applyDocument({
                      ...document,
                      nodes: [...document.nodes, instance],
                    });
                  }}
                >
                  Instantiate
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => {
            const result = createSubflowFromSelection(document, selection);
            if (result.error) setError(result.error);
            else if (result.document) {
              applyDocument(result.document);
              setSelection({ nodeIds: [], wireIds: [] });
              setNotice("Subflow created from the selection.");
            }
          }}
        >
          Create subflow from selection
        </button>
        {selectedSubflow ? (
          <p role="status">
            Selected instance uses subflow <strong>{selectedSubflow.name}</strong>{" "}
            ({selectedSubflow.id}).
          </p>
        ) : null}
      </section>

      <nav className="obolargus_automation_tabs" aria-label="Flow panels">
        {PANELS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-current={panel === entry.id ? "page" : undefined}
            onClick={() => setPanel(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {panel === "details" ? (
        <section className="obolargus_automation_panel" aria-label="Flow details">
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
          <label className="obolargus_automation_run_inputs">
            <span>Run inputs (JSON)</span>
            <textarea
              rows={5}
              value={runInputs}
              onChange={(event) => setRunInputs(event.target.value)}
              placeholder={'{\n  "identifiers": [{"scheme": "TICKER", "value": "XNAS:AAPL"}]\n}'}
            />
          </label>
          <Button
            onClick={() => void start(runInputs)}
            disabled={startRun.isPending}
          >
            Run with inputs
          </Button>
        </section>
      ) : null}
      {panel === "versions" && flowId ? (
        <VersionPanel
          flowId={flowId}
          currentVersionNumber={publishedVersion}
        />
      ) : null}
      {panel === "triggers" && flowId ? <TriggerPanel flowId={flowId} /> : null}
      {panel === "context" && flowId ? <ContextPanel flowId={flowId} /> : null}
      {panel === "audit" && flowId ? <AuditPanel flowId={flowId} /> : null}

      {blocker.state === "blocked" ? (
        <div
          className="obolargus_automation_dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Unsaved changes"
        >
          <p>You have unsaved changes. Discard them and leave this page?</p>
          <button type="button" onClick={() => blocker.proceed()}>
            Discard changes
          </button>
          <button type="button" onClick={() => blocker.reset()}>
            Stay on this page
          </button>
        </div>
      ) : null}
    </main>
  );
}
