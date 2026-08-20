import type { Meta, StoryObj } from "@storybook/react";

import { App } from "../App";

const meta = {
  title: "Shell/App",
  component: App,
} satisfies Meta<typeof App>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Placeholder: Story = {};
