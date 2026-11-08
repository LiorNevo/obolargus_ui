import { screen } from "@testing-library/react";
import type { ForwardedRef } from "react";
import userEvent from "@testing-library/user-event";
import {
  RouterProvider,
  createMemoryRouter,
  type RouteObject,
} from "react-router-dom";
import FlowEditorPage from "../FlowEditorPage";
import { renderWithQueryClient } from "../../../query/testUtils";

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
    cloneValue: (value: unknown) => value,
  };
});


const mockFlow = {
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
  current_version: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const mockNodeTypes = {
  items: [
    {
      id: "debug",
      version: 1,
      category: "flow",
      display_name: "Debug",
      description: "Debug",
      icon: "bug",
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
    data: mockFlow,
  }),
  useNodeTypesQuery: () => ({
    isPending: false,
    isError: false,
    data: mockNodeTypes,
  }),
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
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(mockSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRevision: 4 }),
    );
    expect(await screen.findByText("Draft saved.")).toBeInTheDocument();
  });

  it("requires a change note before publishing", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(mockPublish).not.toHaveBeenCalled();
    expect(
      screen.getByText("Enter a change note before publishing."),
    ).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("What changed?"), "initial");
    mockPublish.mockResolvedValue({
      version_number: 1,
      validation: { errors: [], warnings: [] },
    });
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({ changeNote: "initial" }),
    );
    expect(await screen.findByText("Published v1.")).toBeInTheDocument();
  });

  it("validates the draft and starts a run", async () => {
    mockValidate.mockResolvedValue({ errors: [], warnings: [] });
    mockStartRun.mockResolvedValue({ run_id: "r1", status: "queued" });
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Validate" }));
    expect(mockValidate).toHaveBeenCalled();
    expect(await screen.findByText("The flow is valid.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(mockStartRun).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/automation/runs/r1");
  });
});
