import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RunDetailPage from "../RunDetailPage";
import { renderWithQueryClient } from "../../../query/testUtils";

const mockCancelMutate = jest.fn();
const mockRetryMutate = jest.fn();

const mockRun = {
  id: "run-1234-5678",
  flow_id: "flow-1234",
  flow_version_id: "version-1",
  flow_version_number: 2,
  trigger_kind: "manual",
  trigger_node_id: null,
  actor_id: "dev-user",
  status: "succeeded",
  inputs: { symbol: "AAPL" },
  outputs: {},
  summary: {},
  error: null,
  parent_run_id: null,
  queued_at: "2026-01-01T00:00:00Z",
  started_at: "2026-01-01T00:00:01Z",
  ended_at: "2026-01-01T00:00:02Z",
  duration_ms: 1_000,
  message_count: 1,
  nodes: [
    {
      node_id: "n1",
      node_type_id: "inject",
      node_type_version: 1,
      attempt: 1,
      status: "succeeded",
      started_at: null,
      ended_at: null,
      duration_ms: 10,
      messages_in: 1,
      messages_out: 1,
      output_truncated: false,
    },
  ],
};

jest.mock("../../../query/automationQueries", () => ({
  useRunQuery: () => ({ isPending: false, isError: false, data: mockRun, error: null }),
  useRunMessagesQuery: () => ({
    isPending: false,
    isError: false,
    data: {
      items: [
        {
          id: 1,
          node_id: "n1",
          direction: "out",
          output_port: "out",
          msg_id: "m1",
          ts: "2026-01-01T00:00:01Z",
          size_bytes: 10,
          truncated: false,
          payload: { payload: { hello: "world" } },
        },
      ],
    },
    error: null,
  }),
  useRunLogsQuery: () => ({
    isPending: false,
    data: {
      items: [
        {
          id: 1,
          node_id: "n1",
          ts: "2026-01-01T00:00:01Z",
          level: "info",
          message: "started",
          fields: null,
        },
      ],
    },
  }),
  useRunEvents: jest.fn(),
}));

jest.mock("../../../query/mutations", () => ({
  useCancelRunMutation: () => ({ mutate: mockCancelMutate, isPending: false }),
  useRetryRunMutation: () => ({ mutate: mockRetryMutate, isPending: false }),
}));

function renderPage() {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={["/automation/runs/mockRun-1234-5678"]}>
      <Routes>
        <Route path="/automation/runs/:runId" element={<RunDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RunDetailPage", () => {
  beforeEach(() => {
    mockCancelMutate.mockReset();
    mockRetryMutate.mockReset();
  });

  it("renders the node timeline, messages, and logs", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /Run run-1234/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Node timeline")).toHaveTextContent("n1");
    expect(screen.getByLabelText("Messages")).toHaveTextContent("hello");
    expect(screen.getByLabelText("Run logs")).toHaveTextContent("started");
  });

  it("disables cancel and allows retry for a terminal run", async () => {
    renderPage();
    expect(screen.getByRole("button", { name: "Cancel run" })).toBeDisabled();
    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry).toBeEnabled();
    await userEvent.click(retry);
    expect(mockRetryMutate).toHaveBeenCalled();
  });
});
