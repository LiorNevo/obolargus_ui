import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { axe } from "jest-axe";
import { createPageRegistry } from "lx_client/js/navigation/registry";
import type { AccessContext } from "lx_client/js/navigation/types";
import { AppLayout } from "../../navigation/AppLayout";
import { PAGES } from "../../navigation/pages";

const ACCESS: AccessContext = { grantedPermissions: "all" };

function renderLanding(initialEntry = "/") {
  const registry = createPageRegistry(PAGES);
  const navigation = registry.getNavigationEntries(ACCESS);
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
    { initialEntries: [initialEntry] },
  );

  return render(<RouterProvider router={router} />);
}

describe("LandingPage", () => {
  it("renders Home plus the five workspace areas", () => {
    renderLanding();

    expect(
      screen.getByRole("heading", { level: 1, name: "Home" }),
    ).toBeInTheDocument();

    const workspace = screen.getByRole("navigation", {
      name: "Workspace areas",
    });
    expect(within(workspace).getAllByRole("link")).toHaveLength(5);

    for (const label of ["Dashboard", "Portfolios", "Analysis", "Rules", "Settings"]) {
      expect(
        within(workspace).getByRole("link", { name: new RegExp(`^${label}`) }),
      ).toBeInTheDocument();
    }
  });

  it("links every workspace area to its real URL", () => {
    renderLanding();

    const workspace = screen.getByRole("navigation", {
      name: "Workspace areas",
    });

    expect(
      within(workspace).getByRole("link", { name: /^Dashboard/ }),
    ).toHaveAttribute("href", "/dashboard");
    expect(
      within(workspace).getByRole("link", { name: /^Portfolios/ }),
    ).toHaveAttribute("href", "/portfolios");
    expect(
      within(workspace).getByRole("link", { name: /^Analysis/ }),
    ).toHaveAttribute("href", "/analysis");
    expect(
      within(workspace).getByRole("link", { name: /^Rules/ }),
    ).toHaveAttribute("href", "/rules");
    expect(
      within(workspace).getByRole("link", { name: /^Settings/ }),
    ).toHaveAttribute("href", "/settings");
  });

  it("does not expose developer-only surfaces", () => {
    renderLanding();

    expect(screen.queryByText(/component test/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/__components/)).not.toBeInTheDocument();
    expect(screen.queryByText(/docs-runner/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /__components/ }),
    ).not.toBeInTheDocument();
  });

  it("navigates to a labeled Portfolios placeholder", async () => {
    const user = userEvent.setup();
    renderLanding();

    const workspace = screen.getByRole("navigation", {
      name: "Workspace areas",
    });

    await user.click(
      within(workspace).getByRole("link", { name: /^Portfolios/ }),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Portfolios" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This area is not yet available."),
    ).toBeInTheDocument();
    expect(document.title).toBe("Portfolios");
  });

  it("contains no fabricated financial values", () => {
    const { container } = renderLanding();

    expect(container.textContent).not.toMatch(/[$€£¥%]/);
    expect(container.textContent).not.toMatch(
      /\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b/,
    );
  });

  it("has no accessibility violations", async () => {
    const { container } = renderLanding();

    expect(await axe(container)).toHaveNoViolations();
  });
});
