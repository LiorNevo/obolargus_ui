import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AutomationLandingPage from "../AutomationLandingPage";

let mockFlows: {
  isSuccess: boolean;
  isError: boolean;
  data: {
    items: Array<{ id: string; name: string; status: string }>;
    total: number;
    limit: number;
    offset: number;
  };
  error?: unknown;
} = {
  isSuccess: true,
  isError: false,
  data: {
    items: [{ id: "f1", name: "First flow", status: "active" }],
    total: 1,
    limit: 1,
    offset: 0,
  },
};

jest.mock("../../../query/automationQueries", () => ({
  useFlowsQuery: () => mockFlows,
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/automation"]}>
      <Routes>
        <Route path="/automation" element={<AutomationLandingPage />} />
        <Route
          path="/automation/flows/:flowId"
          element={<p>Editor for flow</p>}
        />
        <Route path="/automation/flows" element={<p>Flow list</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AutomationLandingPage", () => {
  it("opens the most recent active flow", async () => {
    mockFlows = {
      isSuccess: true,
      isError: false,
      data: {
        items: [{ id: "f1", name: "First flow", status: "active" }],
        total: 1,
        limit: 1,
        offset: 0,
      },
    };
    renderPage();
    expect(await screen.findByText("Editor for flow")).toBeInTheDocument();
  });

  it("falls back to the flow list when no active flows exist", async () => {
    mockFlows = {
      isSuccess: true,
      isError: false,
      data: { items: [], total: 0, limit: 1, offset: 0 },
    };
    renderPage();
    expect(await screen.findByText("Flow list")).toBeInTheDocument();
  });
});
