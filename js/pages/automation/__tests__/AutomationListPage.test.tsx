import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { axe } from "jest-axe";
import AutomationListPage from "../AutomationListPage";
import { renderWithQueryClient } from "../../../query/testUtils";

const mockCreateFlow = jest.fn();

jest.mock("../../../query/automationQueries", () => ({
  useFlowsQuery: () => ({
    isPending: false,
    isError: false,
    isSuccess: true,
    data: {
      items: [
        {
          id: "f1",
          name: "Daily reference load",
          description: "Loads reference data",
          tags: ["market-data"],
          status: "active",
          owner_id: "dev-user",
          current_version_number: 2,
          draft_revision: 3,
          last_run: null,
          next_scheduled_run_at: null,
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    },
  }),
  useTemplatesQuery: () => ({
    isPending: false,
    isSuccess: true,
    data: {
      items: [
        {
          id: "data-load-single-date",
          version: 1,
          name: "Load reference data for one date",
          description: "Load a batch of identifiers for a chosen date.",
          category: "data",
          node_count: 3,
        },
      ],
    },
  }),
}));

jest.mock("../../../query/mutations", () => ({
  useCreateFlowMutation: () => ({
    mutateAsync: mockCreateFlow,
    isPending: false,
  }),
  useArchiveFlowMutation: () => ({ mutate: jest.fn(), isPending: false }),
  useRestoreFlowMutation: () => ({ mutate: jest.fn(), isPending: false }),
  useDeleteFlowMutation: () => ({ mutate: jest.fn(), isPending: false }),
}));

function renderPage() {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={["/automation"]}>
      <Routes>
        <Route path="/automation" element={<AutomationListPage />} />
        <Route
          path="/automation/flows/:flowId"
          element={<p>Flow editor loaded</p>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AutomationListPage", () => {
  beforeEach(() => mockCreateFlow.mockReset());

  it("lists flows and starts from a template", async () => {
    mockCreateFlow.mockResolvedValue({ id: "new-flow" });
    renderPage();
    expect(screen.getByText("Daily reference load")).toBeInTheDocument();
    expect(
      screen.getByText("Load reference data for one date"),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Use template" }),
    );
    await waitFor(() =>
      expect(mockCreateFlow).toHaveBeenCalledWith(
        expect.objectContaining({ template_id: "data-load-single-date" }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByText("Flow editor loaded")).toBeInTheDocument(),
    );
  });

  it("creates a blank flow from the header", async () => {
    mockCreateFlow.mockResolvedValue({ id: "blank" });
    renderPage();
    await userEvent.type(screen.getByPlaceholderText("New flow name"), "My flow");
    await userEvent.click(
      screen.getByRole("button", { name: "Create blank flow" }),
    );
    await waitFor(() =>
      expect(mockCreateFlow).toHaveBeenCalledWith(
        expect.objectContaining({ name: "My flow" }),
      ),
    );
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = renderPage();
    expect(await axe(container)).toHaveNoViolations();
  });
});
