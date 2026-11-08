import { MemoryRouter, Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { renderWithQueryClient } from "../../../query/testUtils";
import { useOfflineStore } from "../../../offline/offlineStore";
import { SemanticLayerPage } from "../../SemanticLayerPage";
import { semanticDictionaryResponse } from "../__fixtures__/semanticDictionary";

function renderPage(path = "/semantic-layer") {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/semantic-layer" element={<SemanticLayerPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Semantic Layer accessibility", () => {
  beforeEach(() => {
    useOfflineStore.getState().reset();
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(semanticDictionaryResponse());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("has no automated accessibility violations on the overview", async () => {
    renderPage();
    await screen.findByRole("searchbox", { name: "Search the dictionary" });
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it("has no automated accessibility violations on a definition detail", async () => {
    renderPage("/semantic-layer?def=FactType.market_price");
    await screen.findByRole("heading", { level: 2, name: "Market price" });
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it("supports keyboard tab switching", async () => {
    const user = userEvent.setup();
    renderPage("/semantic-layer?def=Portfolio");
    const detailsTab = await screen.findByRole("tab", { name: "Details" });
    detailsTab.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Raw" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
