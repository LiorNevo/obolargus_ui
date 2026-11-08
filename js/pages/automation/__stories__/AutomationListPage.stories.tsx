import type { Meta, StoryObj } from "@storybook/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { createQueryClient } from "../../../query/client";
import { queryKeys } from "../../../query/keys";
import AutomationListPage from "../AutomationListPage";
import "../automation.css";

function seededClient() {
  const client = createQueryClient({ retry: false, staleTime: Infinity });
  client.setQueryData(queryKeys.automation.templates(), {
    items: [
      {
        id: "data-load-single-date",
        version: 1,
        name: "Load reference data for one date",
        description: "Load a batch of identifiers for a chosen date.",
        category: "data",
        node_count: 3,
      },
    ],
  });
  client.setQueryData(
    queryKeys.automation.flowList({ limit: 20, offset: 0 }),
    {
      items: [
        {
          id: "f1",
          name: "Daily reference load",
          description: "Loads the overnight reference batch.",
          tags: ["market-data"],
          status: "active",
          owner_id: "dev-user",
          current_version_number: 3,
          draft_revision: 4,
          last_run: {
            id: "run-1",
            status: "succeeded",
            ended_at: "2026-11-08T10:00:03Z",
          },
          next_scheduled_run_at: "2026-11-09T11:00:00Z",
          updated_at: "2026-11-08T10:00:00Z",
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    },
  );
  return client;
}

const meta: Meta<typeof AutomationListPage> = {
  title: "Automation/Flow list",
  component: AutomationListPage,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof AutomationListPage>;

function StoryPage() {
  return (
    <QueryClientProvider client={seededClient()}>
      <MemoryRouter initialEntries={["/automation"]}>
        <AutomationListPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

export const WithTemplateGallery: Story = { render: () => <StoryPage /> };

export const Empty: Story = {
  render: () => {
    const client = seededClient();
    client.setQueryData(queryKeys.automation.templates(), { items: [] });
    client.setQueryData(
      queryKeys.automation.flowList({ limit: 20, offset: 0 }),
      { items: [], total: 0, limit: 20, offset: 0 },
    );
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/automation"]}>
          <AutomationListPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  },
};
