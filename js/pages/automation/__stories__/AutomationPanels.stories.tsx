import type { Meta, StoryObj } from "@storybook/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { createQueryClient } from "../../../query/client";
import { queryKeys } from "../../../query/keys";
import { ContextPanel } from "../ContextPanel";
import { TriggerPanel } from "../TriggerPanel";
import "../automation.css";

function seededClient() {
  const client = createQueryClient({ retry: false, staleTime: Infinity });
  client.setQueryData(queryKeys.automation.context("f1"), {
    flow: { last_batch: { date: "2026-11-08", loaded: 12 } },
    global: { environment: "production" },
  });
  client.setQueryData(queryKeys.automation.triggers("f1"), {
    items: [
      {
        id: "t1",
        kind: "inject",
        node_id: "n1",
        enabled: true,
        repeat_kind: "cron",
        cron_expression: "0 0 6 * * *",
        interval_seconds: null,
        timezone: "America/New_York",
        overlap_policy: "skip",
        missed_policy: "run_once",
        next_occurrence_at: "2026-11-09T11:00:00Z",
        last_occurrence_at: "2026-11-08T11:00:00Z",
      },
      {
        id: "t2",
        kind: "api",
        node_id: null,
        enabled: true,
        repeat_kind: null,
        cron_expression: null,
        interval_seconds: null,
        timezone: "UTC",
        overlap_policy: "skip",
        missed_policy: "run_once",
        next_occurrence_at: null,
        last_occurrence_at: null,
      },
    ],
  });
  return client;
}

const meta: Meta = {
  title: "Automation/Panels",
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj;

export const Context: Story = {
  render: () => (
    <QueryClientProvider client={seededClient()}>
      <MemoryRouter>
        <ContextPanel flowId="f1" />
      </MemoryRouter>
    </QueryClientProvider>
  ),
};

export const Triggers: Story = {
  render: () => (
    <QueryClientProvider client={seededClient()}>
      <MemoryRouter>
        <TriggerPanel flowId="f1" />
      </MemoryRouter>
    </QueryClientProvider>
  ),
};
