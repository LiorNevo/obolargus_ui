import { act, render, screen, within } from "@testing-library/react";
import { createMemoryRouter } from "react-router-dom";
import { buildAppRoutes } from "lx_client/js/navigation/routes";
import { App } from "../App";
import { AUTHENTICATED_ACCESS_CONTEXT } from "../navigation/access";
import { AppLayout } from "../navigation/AppLayout";
import { PAGES } from "../navigation/pages";
import { getAppRouter } from "../router";

jest.mock("../router", () => ({
  getAppRouter: jest.fn(),
}));

const mockedGetAppRouter = jest.mocked(getAppRouter);

async function renderAppAt(path: string) {
  const router = createMemoryRouter(
    buildAppRoutes(PAGES, AppLayout, AUTHENTICATED_ACCESS_CONTEXT),
    { initialEntries: [path] },
  );

  const view = render(<App router={router} authEnabled={false} />);
  // Let the Morpheus provider's mount sync settle inside act; otherwise its
  // state updates land after the test body returns.
  await act(async () => {});
  return view;
}

describe("App", () => {
  it("renders the dashboard at /", async () => {
    await renderAppAt("/");

    expect(
      await screen.findByRole(
        "region",
        { name: "Dashboard" },
        { timeout: 15_000 },
      ),
    ).toBeInTheDocument();
  });

  it("keeps unavailable areas out of the top bar", async () => {
    await renderAppAt("/");

    const primary = screen.getByRole("navigation", { name: "Primary" });
    expect(
      within(primary).queryByRole("link", { name: /Portfolios/ }),
    ).toBeNull();
    expect(
      within(primary).queryByRole("link", { name: /Analysis/ }),
    ).toBeNull();
    expect(
      within(primary).getByRole("link", { name: /Dashboard/ }),
    ).toHaveAttribute("href", "/");
    expect(
      within(primary).queryByRole("link", { name: /Home/ }),
    ).toBeNull();
  });

  it("renders the Portfolios placeholder for /portfolios", async () => {
    await renderAppAt("/portfolios");

    expect(
      screen.getByRole("heading", { level: 1, name: "Portfolios" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This area is not yet available."),
    ).toBeInTheDocument();
  });

  it("uses the production router when none is injected", async () => {
    const router = createMemoryRouter(
      buildAppRoutes(PAGES, AppLayout, AUTHENTICATED_ACCESS_CONTEXT),
      { initialEntries: ["/"] },
    );
    mockedGetAppRouter.mockReturnValue(router);

    render(<App authEnabled={false} />);
    await act(async () => {});

    expect(mockedGetAppRouter).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole(
        "region",
        { name: "Dashboard" },
        { timeout: 15_000 },
      ),
    ).toBeInTheDocument();
  });
});
