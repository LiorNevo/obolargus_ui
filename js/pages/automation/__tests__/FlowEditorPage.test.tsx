import { screen, within } from "@testing-library/react";
import type { ForwardedRef } from "react";
import userEvent from "@testing-library/user-event";
import {
  RouterProvider,
  createMemoryRouter,
  type RouteObject,
} from "react-router-dom";
import FlowEditorPage from "../FlowEditorPage";
import { renderWithQueryClient } from "../../../query/testUtils";
import type { FlowDetail } from "../../../types/automation";

const mockSaveDraft = jest.fn();
const mockPublish = jest.fn();
const mockStartRun = jest.fn();
const mockValidate = jest.fn();
const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

jest.mock("lx_client/js/components/FlowEditor", () => {
  const React = jest.requireActual("react");
  const MockEditor = React.forwardRef(function MockEditor(
    props: {
      document: { name: string; nodes: unknown[] };
      onChange(document: unknown): void;
      workspaceTabs?: Array<{
        id: string;
        label: string;
        kind?: "flow" | "subflow";
      }>;
      activeWorkspaceTab?: string;
      onWorkspaceTabChange?(tabId: string): void;
      onAddWorkspaceTab?(): void;
      addWorkspaceTabLabel?: string;
      onRunNode?(nodeId: string): void;
      runningNodeId?: string | null;
      debugEvents?: Array<{ id: string; value: unknown }>;
    },
    ref: ForwardedRef<unknown>,
  ) {
    React.useImperativeHandle(ref, () => ({
      getDocument: () => props.document,
      setDocument: () => undefined,
      addNode: () => "n1",
      updateNode: () => undefined,
      removeSelection: () => undefined,
      duplicateSelection: () => undefined,
      undo: () => undefined,
      redo: () => undefined,
      selectNode: () => undefined,
      focusNode: () => undefined,
      fitView: () => undefined,
      zoomIn: () => undefined,
      zoomOut: () => undefined,
      toggleMinimap: () => undefined,
      exportJson: () => "{}",
      importJson: () => ({ document: props.document, error: null }),
    }));
    return React.createElement(
      "div",
      null,
      React.createElement("p", null, `Mock editor: ${props.document.name}`),
      React.createElement(
        "p",
        null,
        `Mock nodes: ${props.document.nodes.length}`,
      ),
      ...(props.workspaceTabs ?? []).map((tab) =>
        React.createElement(
          "button",
          {
            key: tab.id,
            type: "button",
            "aria-current":
              props.activeWorkspaceTab === tab.id ? "page" : undefined,
            onClick: () => props.onWorkspaceTabChange?.(tab.id),
          },
          tab.label,
        ),
      ),
      props.onAddWorkspaceTab
        ? React.createElement(
            "button",
            {
              type: "button",
              "aria-label": props.addWorkspaceTabLabel ?? "Add workspace tab",
              onClick: props.onAddWorkspaceTab,
            },
            "Add tab",
          )
        : null,
      props.onRunNode
        ? React.createElement(
            "button",
            {
              type: "button",
              onClick: () => props.onRunNode?.("n1"),
            },
            "Mock run node",
          )
        : null,
      ...(props.debugEvents ?? []).map((event) =>
        React.createElement(
          "p",
          { key: event.id },
          `Debug event: ${JSON.stringify(event.value)}`,
        ),
      ),
      React.createElement(
        "button",
        {
          type: "button",
          onClick: () =>
            props.onChange({
              ...props.document,
              nodes: [
                ...props.document.nodes,
                { id: "n9", type: "debug", type_version: 1, config: {} },
              ],
            }),
        },
        "Mock add node",
      ),
    );
  });
  return {
    FlowEditor: MockEditor,
    emptyFlow: (name: string) => ({
      schema_version: 1,
      name,
      description: "",
      tags: [],
      inputs: [],
      nodes: [],
      wires: [],
      subflows: [],
    }),
    normalizeFlowDocument: (value: unknown, fallbackName = "Flow") => {
      const source = (value ?? {}) as Record<string, unknown>;
      return {
        schema_version: 1,
        name: typeof source.name === "string" ? source.name : fallbackName,
        description: "",
        tags: [],
        inputs: Array.isArray(source.inputs) ? source.inputs : [],
        nodes: Array.isArray(source.nodes) ? source.nodes : [],
        wires: Array.isArray(source.wires) ? source.wires : [],
        subflows: Array.isArray(source.subflows) ? source.subflows : [],
      };
    },
    validateLocal: () => ({ markers: [], hasErrors: false }),
    findFreePosition: (_nodes: unknown[], base: { x: number; y: number }) =>
      base,
    cloneValue: (value: unknown) => value,
  };
});


const mockFlow: FlowDetail = {
  id: "f1",
  name: "Draft flow",
  description: "A flow",
  tags: ["test"],
  status: "active",
  owner_id: "dev-user",
  draft: {
    revision: 4,
    flow_json: {
      schema_version: 1,
      name: "Draft flow",
      description: "",
      tags: [],
      inputs: [],
      nodes: [],
      wires: [],
      subflows: [],
    },
    updated_at: "2026-01-01T00:00:00Z",
  },
  current_version: {
    id: "v1",
    version_number: 1,
    published_at: "2026-01-01T00:00:00Z",
    change_note: "initial",
  },
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

let mockFlowData: FlowDetail = mockFlow;
let mockRunData: Record<string, unknown> | undefined;
let mockRunLogsData:
  | { items: Array<Record<string, unknown>> }
  | undefined;

const mockNodeTypes = {
  items: [
    {
      id: "debug",
      version: 1,
      category: "flow",
      display_name: "Debug",
      description: "Debug",
      icon: "bug_report",
      outputs: [],
      config_schema: { type: "object" },
      capabilities: [],
      deprecated: false,
      docs: "",
    },
  ],
};

jest.mock("../../../query/automationQueries", () => ({
  useFlowQuery: () => ({
    isPending: false,
    isError: false,
    data: mockFlowData,
  }),
  useFlowsQuery: () => ({
    isPending: false,
    isError: false,
    data: {
      items: [
        {
          id: "f1",
          name: "Draft flow",
          description: "A flow",
          tags: ["test"],
          status: "active",
          owner_id: "dev-user",
          current_version_number: 1,
          draft_revision: 4,
          last_run: null,
          next_scheduled_run_at: null,
          updated_at: "2026-01-01T00:00:00Z",
        },
        {
          id: "f2",
          name: "Other flow",
          description: "Another flow",
          tags: [],
          status: "active",
          owner_id: "dev-user",
          current_version_number: null,
          draft_revision: 1,
          last_run: null,
          next_scheduled_run_at: null,
          updated_at: "2026-01-02T00:00:00Z",
        },
      ],
      total: 2,
      limit: 200,
      offset: 0,
    },
  }),
  useNodeTypesQuery: () => ({
    isPending: false,
    isError: false,
    data: mockNodeTypes,
  }),
  useRunQuery: (runId?: string) => ({
    isPending: false,
    isError: false,
    data: runId ? mockRunData : undefined,
  }),
  useRunLogsQuery: (runId?: string) => ({
    isPending: false,
    isError: false,
    data: runId ? mockRunLogsData : undefined,
  }),
  useRunEvents: () => undefined,
}));

jest.mock("../../../query/mutations", () => ({
  useSaveDraftMutation: () => ({
    mutateAsync: mockSaveDraft,
    isPending: false,
  }),
  useValidateFlowMutation: () => ({
    mutateAsync: mockValidate,
    isPending: false,
  }),
  usePublishFlowMutation: () => ({
    mutateAsync: mockPublish,
    isPending: false,
  }),
  useStartRunMutation: () => ({
    mutateAsync: mockStartRun,
    isPending: false,
  }),
}));

function renderPage() {
  const routes: RouteObject[] = [
    { path: "/automation/flows/:flowId", element: <FlowEditorPage /> },
    { path: "/automation/runs/:runId", element: <p>Run page</p> },
    { path: "/automation", element: <p>List page</p> },
  ];
  const router = createMemoryRouter(routes, {
    initialEntries: ["/automation/flows/f1"],
  });
  return renderWithQueryClient(<RouterProvider router={router} />);
}

describe("FlowEditorPage", () => {
  beforeEach(() => {
    mockFlowData = mockFlow;
    mockRunData = undefined;
    mockRunLogsData = undefined;
    mockSaveDraft.mockReset();
    mockPublish.mockReset();
    mockStartRun.mockReset();
    mockValidate.mockReset();
    mockNavigate.mockReset();
  });

  it("loads the draft and saves with the current revision", async () => {
    mockSaveDraft.mockResolvedValue({
      revision: 5,
      flow_json: {},
      validation: { errors: [], warnings: [] },
      updated_at: "2026-01-01T00:00:00Z",
    });
    renderPage();
    expect(screen.getByText("Mock editor: Draft flow")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Mock add node" }));
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(mockSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRevision: 4 }),
    );
    expect(await screen.findByText("Draft saved.")).toBeInTheDocument();
  });

  it("loads the current published version when the flow has no draft", () => {
    mockFlowData = {
      ...mockFlow,
      draft: null,
      current_version: {
        ...mockFlow.current_version!,
        flow_json: {
          ...mockFlow.draft!.flow_json,
          nodes: [
            { id: "n1", type: "debug", type_version: 1, config: {} },
          ],
        },
      },
    };
    renderPage();
    expect(screen.getByText("Mock nodes: 1")).toBeInTheDocument();
    expect(
      screen.getByText(/Loaded published v1/),
    ).toBeInTheDocument();
  });

  it("requires a change note before publishing", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    const dialog = screen.getByRole("dialog", { name: "Publish flow" });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Publish" }),
    );
    expect(mockPublish).not.toHaveBeenCalled();
    expect(
      within(dialog).getByText("Enter a change note before publishing."),
    ).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("What changed?"), "initial");
    mockPublish.mockResolvedValue({
      version_number: 1,
      validation: { errors: [], warnings: [] },
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Publish" }),
    );
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({ changeNote: "initial" }),
    );
    expect(await screen.findByText("Published v1.")).toBeInTheDocument();
  });

  it("uses the shared tab panel for flow settings", async () => {
    renderPage();
    await userEvent.click(
      screen.getByRole("button", { name: "Flow settings" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Flow settings" });
    expect(
      within(dialog).getByRole("tablist", { name: "Flow panels" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("tab", { name: "Details" }),
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("tab", { name: "Subflows" }),
    );
    expect(
      within(dialog).getByRole("region", { name: "Subflows" }),
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Close" }),
    );
  });

  it("switches flows from the workspace tabs and opens the new-flow list", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Other flow" }));
    expect(mockNavigate).toHaveBeenCalledWith("/automation/flows/f2");

    await userEvent.click(screen.getByRole("button", { name: "New flow" }));
    expect(mockNavigate).toHaveBeenCalledWith("/automation/flows?new=1");
  });

  it("starts a run from an inject node and stays in the editor", async () => {
    mockStartRun.mockResolvedValue({ run_id: "r2", status: "queued" });
    mockRunData = {
      id: "r2",
      status: "succeeded",
      error: null,
      queued_at: "2026-01-01T00:00:00Z",
      started_at: "2026-01-01T00:00:01Z",
      ended_at: "2026-01-01T00:00:02Z",
    };
    mockRunLogsData = {
      items: [
        {
          id: 1,
          node_id: "n1",
          ts: "2026-01-01T00:00:01Z",
          level: "debug",
          message: "debug",
          fields: { hello: "world" },
        },
      ],
    };
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Mock run node" }));
    expect(mockStartRun).toHaveBeenCalledWith({
      inputs: {},
      inject_node_id: "n1",
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(await screen.findByText(/hello/)).toBeInTheDocument();
    expect(screen.getByText("Run succeeded")).toBeInTheDocument();
  });

  it("validates the draft", async () => {
    mockValidate.mockResolvedValue({ errors: [], warnings: [] });
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Validate" }));
    expect(mockValidate).toHaveBeenCalled();
    expect(await screen.findByText("The flow is valid.")).toBeInTheDocument();
  });

  it("collects required inputs before running from an inject node", async () => {
    mockFlowData = {
      ...mockFlow,
      draft: {
        ...mockFlow.draft!,
        flow_json: {
          ...mockFlow.draft!.flow_json,
          inputs: [
            { name: "identifiers", type: "array", required: true },
          ],
        },
      },
    };
    mockStartRun.mockResolvedValue({ run_id: "r1", status: "queued" });
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Mock run node" }));
    const dialog = screen.getByRole("dialog", { name: "Run flow" });
    expect(within(dialog).getByText(/selected inject node/)).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Run with inputs" }),
    );
    expect(mockStartRun).toHaveBeenCalledWith({
      inputs: {},
      inject_node_id: "n1",
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
