import type { Meta, StoryObj } from "@storybook/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import ThemeProvider from "lx_client/js/components/ThemeProvider";
import { createPageRegistry } from "lx_client/js/navigation/registry";
import { AppLayout } from "../../navigation/AppLayout";
import { PAGES } from "../../navigation/pages";

const registry = createPageRegistry(PAGES);
const navigation = registry.getNavigationEntries({
  grantedPermissions: "all",
});

const router = createMemoryRouter(
  [
    {
      path: "/",
      element: <AppLayout navigation={navigation} />,
      children: PAGES.map((page) =>
        page.path === "/"
          ? { index: true as const, element: page.element }
          : { path: page.path.replace(/^\//, ""), element: page.element },
      ),
    },
  ],
  { initialEntries: ["/"] },
);

/**
 * Routed rendering of the landing page.
 *
 * Storybook renders the real application layout and memory router so the
 * landing page receives its navigation context exactly as it does in the app.
 */
function LandingPageStory() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

const meta = {
  title: "Pages/LandingPage",
  component: LandingPageStory,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Authenticated home page presenting the five financial workspace areas as real, copyable links. Unfinished areas render labeled placeholders.",
      },
    },
  },
} satisfies Meta<typeof LandingPageStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
