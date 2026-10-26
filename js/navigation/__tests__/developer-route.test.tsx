import { render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { createPageRegistry } from "lx_client/js/navigation/registry";
import { buildAppRoutes } from "lx_client/js/navigation/routes";
import { UI_ACCESS_CONTEXT } from "../access";
import { AppLayout } from "../AppLayout";
import { PAGES } from "../pages";

function renderAt(path: string) {
  const router = createMemoryRouter(
    buildAppRoutes(PAGES, AppLayout, UI_ACCESS_CONTEXT),
    { initialEntries: [path] },
  );
  return render(<RouterProvider router={router} />);
}

describe("developer-only route", () => {
  it("resolves /__components by direct URL", () => {
    renderAt("/__components");

    expect(
      screen.getByRole("heading", { level: 1, name: "Test Page" }),
    ).toBeInTheDocument();
  });

  it("keeps the developer route out of the landing page and primary navigation", () => {
    renderAt("/");

    expect(screen.queryByText(/component test/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/__components/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /component test/i }),
    ).not.toBeInTheDocument();
  });

  it("does not register the docs runner", () => {
    expect(
      createPageRegistry(PAGES).getPage("/docs-runner"),
    ).toBeUndefined();
  });
});
