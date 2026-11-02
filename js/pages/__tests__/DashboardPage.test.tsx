import { screen, waitFor } from "@testing-library/react";
import { DashboardPage } from "../DashboardPage";
import { renderWithQueryClient } from "../../query/testUtils";

describe("DashboardPage", () => {
  it("renders the promoted dashboard page", async () => {
    renderWithQueryClient(<DashboardPage />);
    await waitFor(
      () =>
        expect(
          screen.getByRole("region", { name: "Dashboard" }),
        ).toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(
      await screen.findByText("Your dashboard is empty", undefined, {
        timeout: 3000,
      }),
    ).toBeInTheDocument();
  });

  it("keeps the dashboard inside the flex page body", async () => {
    renderWithQueryClient(<DashboardPage />);
    const dashboard = await screen.findByRole(
      "region",
      { name: "Dashboard" },
      { timeout: 3000 },
    );
    const page = dashboard.closest(".obolargus_dashboard_page");
    expect(page).not.toBeNull();
    expect(
      page?.querySelector(".obolargus_dashboard_page_body"),
    ).toContainElement(dashboard);
  });
});
