import type { Meta, StoryObj } from "@storybook/react";
import { createMemoryRouter } from "react-router-dom";
import { buildAppRoutes } from "lx_client/js/navigation/routes";
import { App } from "../App";
import { UI_ACCESS_CONTEXT } from "../navigation/access";
import { AppLayout } from "../navigation/AppLayout";
import { PAGES } from "../navigation/pages";

const router = createMemoryRouter(
  buildAppRoutes(PAGES, AppLayout, UI_ACCESS_CONTEXT),
  { initialEntries: ["/"] },
);

const meta = {
  title: "Shell/App",
  component: App,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Routed application shell rendered at the landing page through a memory router.",
      },
    },
  },
} satisfies Meta<typeof App>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LandingPage: Story = {
  args: { router },
};
