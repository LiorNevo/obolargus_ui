import { render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import PlaceholderPage from "lx_client/js/components/PlaceholderPage";
import { buildAppRoutes } from "lx_client/js/navigation/routes";
import type { PageDefinition } from "lx_client/js/navigation/types";
import { UI_ACCESS_CONTEXT } from "../access";
import { AppLayout } from "../AppLayout";
import { PAGES } from "../pages";

const NESTED_PAGE: PageDefinition = {
  id: "holdings",
  path: "/portfolios/holdings",
  label: "Holdings",
  title: "Holdings",
  visibility: "restricted",
  requiredPermission: "portfolio:view",
  availability: "not_yet_available",
  showInNavigation: false,
  element: <PlaceholderPage title="Holdings" />,
};

function renderRoute(path: string, pages: PageDefinition[] = PAGES) {
  const router = createMemoryRouter(
    buildAppRoutes(pages, AppLayout, UI_ACCESS_CONTEXT),
    { initialEntries: [path] },
  );
  return {
    router,
    ...render(<RouterProvider router={router} />),
  };
}

describe("URL-driven routing", () => {
  it("renders the dashboard at /", async () => {
    renderRoute("/");

    expect(
      await screen.findByRole("region", { name: "Dashboard" }),
    ).toBeInTheDocument();
  });

  it("redirects the legacy /dashboard URL to the dashboard root", async () => {
    const { router } = renderRoute("/dashboard");

    expect(
      await screen.findByRole("region", { name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("renders a registered page directly without visiting the landing page", () => {
    renderRoute("/portfolios");

    expect(
      screen.getByRole("heading", { level: 1, name: "Portfolios" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Dashboard" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("This area is not yet available."),
    ).toBeInTheDocument();
  });

  it("renders a nested registered path directly", () => {
    renderRoute("/portfolios/holdings", [...PAGES, NESTED_PAGE]);

    expect(
      screen.getByRole("heading", { level: 1, name: "Holdings" }),
    ).toBeInTheDocument();
  });

  it("renders not-found for an unknown path and keeps the requested URL", () => {
    const { router } = renderRoute("/not-a-real-page");

    expect(
      screen.getByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/not-a-real-page");
  });

  it("renders the same page when the same URL is loaded again", () => {
    const first = renderRoute("/portfolios");
    expect(
      screen.getByRole("heading", { level: 1, name: "Portfolios" }),
    ).toBeInTheDocument();
    first.unmount();

    renderRoute("/portfolios");
    expect(
      screen.getByRole("heading", { level: 1, name: "Portfolios" }),
    ).toBeInTheDocument();
  });
});
