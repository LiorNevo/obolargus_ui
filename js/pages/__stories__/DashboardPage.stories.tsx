import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "../DashboardPage";

/**
 * Dashboard page. The page wires the HTTP adapter; the dashboard itself is a
 * reusable `lx_client` component.
 */
const meta = {
  title: "Pages/Dashboard",
  component: DashboardPage,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DashboardPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The promoted dashboard page. */
export const Default: Story = {};
