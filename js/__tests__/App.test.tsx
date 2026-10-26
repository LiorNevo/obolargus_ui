import { render, screen } from "@testing-library/react";
import { createMemoryRouter } from "react-router-dom";
import { buildAppRoutes } from "lx_client/js/navigation/routes";
import { App } from "../App";
import { UI_ACCESS_CONTEXT } from "../navigation/access";
import { AppLayout } from "../navigation/AppLayout";
import { PAGES } from "../navigation/pages";
import { getAppRouter } from "../router";

jest.mock("../router", () => ({
  getAppRouter: jest.fn(),
}));

const mockedGetAppRouter = jest.mocked(getAppRouter);

function renderAppAt(path: string) {
  const router = createMemoryRouter(
    buildAppRoutes(PAGES, AppLayout, UI_ACCESS_CONTEXT),
    { initialEntries: [path] },
  );

  return render(<App router={router} />);
}

describe("App", () => {
  it("renders the landing page at /", () => {
    renderAppAt("/");

    expect(
      screen.getByRole("heading", { level: 1, name: "Home" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Workspace areas" }),
    ).toBeInTheDocument();
  });

  it("renders the Portfolios placeholder for /portfolios", () => {
    renderAppAt("/portfolios");

    expect(
      screen.getByRole("heading", { level: 1, name: "Portfolios" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This area is not yet available."),
    ).toBeInTheDocument();
  });

  it("uses the production router when none is injected", () => {
    const router = createMemoryRouter(
      buildAppRoutes(PAGES, AppLayout, UI_ACCESS_CONTEXT),
      { initialEntries: ["/"] },
    );
    mockedGetAppRouter.mockReturnValue(router);

    render(<App />);

    expect(mockedGetAppRouter).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Home" }),
    ).toBeInTheDocument();
  });
});
