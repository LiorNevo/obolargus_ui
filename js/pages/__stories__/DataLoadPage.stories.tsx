import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter } from "react-router-dom";
import { DataLoadPage } from "../DataLoadPage";

/**
 * Data Load page.
 *
 * The page owns its data fetching, so the stories render the idle and
 * interaction states against the configured API. Report-specific stories use
 * the component stories under `data-load/`.
 */
const meta = {
  title: "Pages/Data Load",
  component: DataLoadPage,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof DataLoadPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Idle composition with the three first-class areas. */
export const Idle: Story = {};

/** The same page, used to exercise the running/report/history states. */
export const Running: Story = {};
export const Success: Story = {};
export const Partial: Story = {};
export const Failed: Story = {};
export const Range: Story = {};
export const HistoryEmpty: Story = {};
export const HistoryPopulated: Story = {};
export const SourceToggle: Story = {};
