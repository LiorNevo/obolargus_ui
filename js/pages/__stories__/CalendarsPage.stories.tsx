import type { Meta, StoryObj } from "@storybook/react";
import type { ComponentType } from "react";
import { MemoryRouter } from "react-router-dom";
import { CalendarsPageView } from "../calendars/CalendarsPageView";

/**
 * Calendars page.
 *
 * The page reads through the shared query cache; stories use the configured
 * API and exercise the list/detail layout.
 */
const meta = {
  title: "Pages/Calendars",
  component: CalendarsPageView,
  decorators: [
    (Story: ComponentType) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof CalendarsPageView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Calendar list with no selection. */
export const Default: Story = {};

/** Import error feedback state. */
export const ImportError: Story = {};

/** Retire confirmation state. */
export const Retire: Story = {};
