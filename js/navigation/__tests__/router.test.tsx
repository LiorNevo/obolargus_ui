import { act, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import PlaceholderPage from "lx_client/js/components/PlaceholderPage";
import { buildAppRoutes } from "lx_client/js/navigation/routes";
import type { PageDefinition } from "lx_client/js/navigation/types";
import { AUTHENTICATED_ACCESS_CONTEXT } from "../access";
import { AppLayout } from "../AppLayout";
import { PAGES } from "../pages";
import { renderWithQueryClient } from "../../query/testUtils";
import { semanticDictionaryResponse } from "../../pages/semantic-layer/__fixtures__/semanticDictionary";

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

async function renderRoute(path: string, pages: PageDefinition[] = PAGES) {
  const router = createMemoryRouter(
    buildAppRoutes(pages, AppLayout, AUTHENTICATED_ACCESS_CONTEXT),
    { initialEntries: [path] },
  );
  const view = renderWithQueryClient(<RouterProvider router={router} />);
  // Let the Morpheus provider's mount sync settle inside act; otherwise its
  // state updates land after the test body returns.
  await act(async () => {});
  return { router, ...view };
}

describe("URL-driven routing", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders the dashboard at /", async () => {
    await renderRoute("/");

    expect(
      await screen.findByRole(
        "region",
        { name: "Dashboard" },
        { timeout: 15_000 },
      ),
    ).toBeInTheDocument();
  });

  it("redirects the legacy /dashboard URL to the dashboard root", async () => {
    const { router } = await renderRoute("/dashboard");

    expect(
      await screen.findByRole(
        "region",
        { name: "Dashboard" },
        { timeout: 15_000 },
      ),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("renders a registered page directly without visiting the landing page", async () => {
    await renderRoute("/portfolios");

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

  it("renders a nested registered path directly", async () => {
    await renderRoute("/portfolios/holdings", [...PAGES, NESTED_PAGE]);

    expect(
      screen.getByRole("heading", { level: 1, name: "Holdings" }),
    ).toBeInTheDocument();
  });

  it("renders not-found for an unknown path and keeps the requested URL", async () => {
    const { router } = await renderRoute("/not-a-real-page");

    expect(
      screen.getByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/not-a-real-page");
  });

  it("renders the same page when the same URL is loaded again", async () => {
    const first = await renderRoute("/portfolios");
    expect(
      screen.getByRole("heading", { level: 1, name: "Portfolios" }),
    ).toBeInTheDocument();
    first.unmount();

    await renderRoute("/portfolios");
    expect(
      screen.getByRole("heading", { level: 1, name: "Portfolios" }),
    ).toBeInTheDocument();
  });

  it("renders the Semantic Layer page directly from its URL", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.resolve(semanticDictionaryResponse()));
    await renderRoute("/semantic-layer");

    // The lazy page swaps its loading shell for the explorer, so assert the
    // heading was rendered rather than holding a node that may be replaced.
    await screen.findByRole(
      "heading",
      { level: 1, name: "Semantic Layer" },
      { timeout: 15_000 },
    );
    expect(
      await screen.findByText("Dictionary contents", undefined, {
        timeout: 15_000,
      }),
    ).toBeInTheDocument();

    fetchMock.mockRestore();
  });
});
