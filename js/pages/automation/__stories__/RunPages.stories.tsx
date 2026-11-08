import type { Meta, StoryObj } from "@storybook/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createQueryClient } from "../../../query/client";
import { queryKeys } from "../../../query/keys";
import RunDetailPage from "../RunDetailPage";
import RunListPage from "../RunListPage";
import "../automation.css";

const run = {
  id: "run-12345678",
  flow_id: "flow-1",
  flow_version_id: "version-1",
  flow_version_number: 2,
  trigger_kind: "manual",
  trigger_node_id: null,
  actor_id: "dev-user",
  status: "succeeded",
  inputs: { identifiers: [{ scheme: "TICKER", value: "XNAS:AAPL" }] },
  outputs: {},
  summary: { nodes_total: 3, nodes_succeeded: 3, messages_total: 4 },
  error: null,
  parent_run_id: null,
  queued_at: "2026-11-08T10:00:00Z",
  started_at: "2026-11-08T10:00:01Z",
  ended_at: "2026-11-08T10:00:03Z",
  duration_ms: 2000,
  message_count: 4,
  nodes: [
    {
      node_id: "n1",
      node_type_id: "inject",
      node_type_version: 1,
      attempt: 1,
      status: "succeeded",
      started_at: "2026-11-08T10:00:01Z",
      ended_at: "2026-11-08T10:00:01Z",
      duration_ms: 2,
      messages_in: 1,
      messages_out: 1,
      output_truncated: false,
    },
    {
      node_id: "n2",
      node_type_id: "data_load",
      node_type_version: 1,
      attempt: 1,
      status: "succeeded",
      started_at: "2026-11-08T10:00:01Z",
      ended_at: "2026-11-08T10:00:02Z",
      duration_ms: 1600,
      messages_in: 1,
      messages_out: 1,
      output_truncated: false,
    },
    {
      node_id: "n3",
      node_type_id: "debug",
      node_type_version: 1,
      attempt: 1,
      status: "succeeded",
      started_at: "2026-11-08T10:00:02Z",
      ended_at: "2026-11-08T10:00:03Z",
      duration_ms: 4,
      messages_in: 1,
      messages_out: 0,
      output_truncated: false,
    },
  ],
};

function seededClient() {
  const client = createQueryClient({ retry: false, staleTime: Infinity });
  client.setQueryData(queryKeys.automation.run(run.id), run);
  client.setQueryData(queryKeys.automation.runMessages(run.id), {
    items: [
      {
        id: 1,
        node_id: "n2",
        direction: "out",
        output_port: "out",
        msg_id: "m1",
        ts: "2026-11-08T10:00:02Z",
        size_bytes: 120,
        truncated: false,
        payload: {
          payload: {
            report: {
              report_version: 1,
              status: "complete",
              identifiers_requested_raw: 1,
              identifiers_duplicated: 0,
              identifiers_attempted: 1,
              loaded: 1,
              no_op: 0,
              not_resolved: 0,
              no_data_for_date: 0,
              unsupported_scheme: 0,
              rejected: 0,
              source_unavailable: 0,
              rate_limited: 0,
              storage_failure: 0,
              identifiers: [],
            },
          },
        },
      },
    ],
  });
  client.setQueryData(queryKeys.automation.runLogs(run.id), {
    items: [
      {
        id: 1,
        node_id: "n1",
        ts: "2026-11-08T10:00:01Z",
        level: "info",
        message: "run started",
        fields: null,
      },
    ],
  });
  client.setQueryData(
    queryKeys.automation.runList({ limit: 25, offset: 0 }),
    {
      items: [
        {
          id: run.id,
          flow_id: run.flow_id,
          flow_name: "Load reference data",
          flow_version_number: 2,
          trigger_kind: "manual",
          trigger_node_id: null,
          actor_id: "dev-user",
          status: "succeeded",
          queued_at: run.queued_at,
          started_at: run.started_at,
          ended_at: run.ended_at,
          duration_ms: run.duration_ms,
          message_count: run.message_count,
          summary: run.summary,
        },
      ],
      total: 1,
      limit: 25,
      offset: 0,
    },
  );
  return client;
}

const meta: Meta = {
  title: "Automation/Runs",
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj;

export const RunDetail: Story = {
  render: () => (
    <QueryClientProvider client={seededClient()}>
      <MemoryRouter initialEntries={[`/automation/runs/${run.id}`]}>
        <Routes>
          <Route path="/automation/runs/:runId" element={<RunDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  ),
};

export const RunList: Story = {
  render: () => (
    <QueryClientProvider client={seededClient()}>
      <MemoryRouter initialEntries={["/automation/runs"]}>
        <RunListPage />
      </MemoryRouter>
    </QueryClientProvider>
  ),
};

export const EmptyRunList: Story = {
  render: () => {
    const client = createQueryClient({ retry: false, staleTime: Infinity });
    client.setQueryData(
      queryKeys.automation.runList({ limit: 25, offset: 0 }),
      { items: [], total: 0, limit: 25, offset: 0 },
    );
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/automation/runs"]}>
          <RunListPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  },
};
