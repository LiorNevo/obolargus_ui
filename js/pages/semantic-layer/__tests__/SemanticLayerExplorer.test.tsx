import { MemoryRouter } from "react-router-dom";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQueryClient } from "../../../query/testUtils";
import { useOfflineStore } from "../../../offline/offlineStore";
import type {
  SemanticLayerViewState,
} from "../../../types/semanticLayer";
import { SemanticLayerExplorer } from "../SemanticLayerExplorer";
import { buildSemanticDictionary } from "../semanticDictionary";
import {
  semanticDictionaryCanonicalText,
  semanticDictionaryFixture,
} from "../__fixtures__/semanticDictionary";

const DICTIONARY = buildSemanticDictionary(
  semanticDictionaryFixture,
  semanticDictionaryCanonicalText,
);

const BASE: SemanticLayerViewState = {
  view: "overview",
  definitionKey: null,
  tab: "details",
  query: "",
  kind: "all",
  subject: null,
  aggregate: null,
};

function renderExplorer(
  viewState: Partial<SemanticLayerViewState> = {},
  dictionary = DICTIONARY,
) {
  const onNavigate = jest.fn();
  const onRefresh = jest.fn();
  const result = renderWithQueryClient(
    <MemoryRouter initialEntries={["/semantic-layer"]}>
      <SemanticLayerExplorer
        dictionary={dictionary}
        viewState={{ ...BASE, ...viewState }}
        refreshing={false}
        refreshError={null}
        onRefresh={onRefresh}
        onNavigate={onNavigate}
      />
    </MemoryRouter>,
  );
  return { ...result, onNavigate, onRefresh };
}

describe("SemanticLayerExplorer", () => {
  beforeEach(() => {
    useOfflineStore.getState().reset();
  });

  it("renders grouped inventories with counts", () => {
    renderExplorer();
    const inventory = screen.getByRole("navigation", {
      name: "Dictionary inventory",
    });
    expect(within(inventory).getByRole("heading", { name: /Domain entities/ }))
      .toBeInTheDocument();
    expect(within(inventory).getByRole("heading", { name: /Fact types/ }))
      .toBeInTheDocument();
    expect(within(inventory).getByRole("heading", { name: /Fact value shapes/ }))
      .toBeInTheDocument();
    expect(within(inventory).getByRole("heading", { name: /System semantics/ }))
      .toBeInTheDocument();
  });

  it("makes every definition reachable exactly once", () => {
    renderExplorer();
    const inventory = screen.getByRole("navigation", {
      name: "Dictionary inventory",
    });
    for (const definition of DICTIONARY.definitions) {
      expect(
        within(inventory).getByRole("link", { name: definition.name }),
      ).toBeInTheDocument();
    }
  });

  it("marks the selected definition", () => {
    renderExplorer({ view: "definition", definitionKey: "Portfolio" });
    const inventory = screen.getByRole("navigation", {
      name: "Dictionary inventory",
    });
    expect(
      within(inventory).getByRole("link", { name: "Portfolio" }),
    ).toHaveAttribute("aria-current", "true");
  });

  it("renders an entity detail with fields and relationships", () => {
    renderExplorer({ view: "definition", definitionKey: "Portfolio" });
    expect(
      screen.getByRole("heading", { level: 2, name: "Portfolio" }),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("region", { name: "Fields of Portfolio" }),
      ).getByRole("grid"),
    ).toBeInTheDocument();
    expect(screen.getByText("parent_id")).toBeInTheDocument();
    expect(screen.getAllByText("composes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("holds").length).toBeGreaterThan(0);
    expect(screen.getAllByText("self").length).toBeGreaterThan(0);

    const breadcrumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(
      within(breadcrumbs).getByRole("link", { name: "Semantic Layer" }),
    ).toBeInTheDocument();
    expect(
      within(breadcrumbs).getByRole("link", { name: "Domain entities" }),
    ).toBeInTheDocument();
  });

  it("shows an unresolved relationship endpoint as plain text", () => {
    const document = {
      ...semanticDictionaryFixture,
      "x-obolargus-relationships": [
        ...semanticDictionaryFixture["x-obolargus-relationships"],
        {
          from: "Portfolio",
          to: "Missing",
          label: "references",
          cardinality_from: "0..*",
          cardinality_to: "1",
        },
      ],
    };
    const dictionary = buildSemanticDictionary(
      document,
      semanticDictionaryCanonicalText,
    );
    renderExplorer(
      { view: "definition", definitionKey: "Portfolio" },
      dictionary,
    );
    expect(screen.getByText("Missing (unresolved)")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Missing" }),
    ).not.toBeInTheDocument();
  });

  it("renders observation fact metadata and exact field values", () => {
    renderExplorer({
      view: "definition",
      definitionKey: "FactType.market_price",
    });
    expect(
      screen.getByRole("heading", { level: 2, name: "Market price" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Subjects")).toBeInTheDocument();
    expect(screen.getAllByText("asset").length).toBeGreaterThan(0);
    expect(screen.getAllByText("USD").length).toBeGreaterThan(0);
    expect(screen.getByText("open")).toBeInTheDocument();
    expect(screen.getAllByText(/precision 38/).length).toBeGreaterThan(0);
  });

  it("renders scalar fact types with a synthetic value field", () => {
    renderExplorer({ view: "definition", definitionKey: "FactType.nav" });
    expect(screen.getByText("value")).toBeInTheDocument();
    expect(screen.getByText(/Reference → FactValue.decimal/)).toBeInTheDocument();
    expect(screen.getAllByText("USD").length).toBeGreaterThan(0);
  });

  it("distinguishes open and closed vocabularies", () => {
    renderExplorer({ view: "definition", definitionKey: "Event" });
    expect(
      screen.getByText("Closed: buy, sell, transfer"),
    ).toBeInTheDocument();

    renderExplorer({ view: "definition", definitionKey: "TemporalFact" });
    expect(
      screen.getByText("Open (known values): market_price, name, nav"),
    ).toBeInTheDocument();
  });

  it("renders aggregates, precision, and scale for a field", () => {
    renderExplorer({ view: "definition", definitionKey: "Position" });
    const table = within(
      screen.getByRole("region", { name: "Fields of Position" }),
    ).getByRole("grid");
    const row = within(table).getByRole("row", { name: /quantity/ });
    expect(within(row).getByText("sum, min, max")).toBeInTheDocument();
    expect(within(row).getByText(/precision 38/)).toBeInTheDocument();
    expect(within(row).getByText(/scale 18/)).toBeInTheDocument();
  });

  it("renders union variants", () => {
    renderExplorer({ view: "definition", definitionKey: "FactValue" });
    expect(screen.getByText("Union variants")).toBeInTheDocument();
    expect(screen.getByText("market_price")).toBeInTheDocument();
    expect(screen.getByText("timestamp")).toBeInTheDocument();
  });

  it("renders value shape references", () => {
    renderExplorer({ view: "definition", definitionKey: "FactValue.text" });
    const section = screen.getByRole("region", {
      name: "Referenced by fact types",
    });
    expect(
      within(section).getByRole("link", { name: "Name" }),
    ).toBeInTheDocument();
  });

  it("renders system semantics", () => {
    renderExplorer({ view: "system" });
    const detail = screen.getByRole("region", { name: "Dictionary detail" });
    expect(
      within(detail).getByRole("heading", {
        level: 2,
        name: "System semantics",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Portfolio graph is a DAG."),
    ).toBeInTheDocument();
    expect(screen.getByText("transfer_requires_destination")).toBeInTheDocument();
    expect(
      screen.getByText("retraction_reason_iff_retracted"),
    ).toBeInTheDocument();
  });

  it("renders the whole canonical document", () => {
    renderExplorer({ view: "document" });
    const region = screen.getByRole("region", {
      name: "Canonical dictionary",
    });
    expect(region).toHaveTextContent('"$schema"');
    expect(region).toHaveTextContent("Obolargus System Data Dictionary");
  });

  it("shows a definition not-found state with an overview link", () => {
    renderExplorer({ view: "definition", definitionKey: "Missing" });
    expect(screen.getByText("Definition not found")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to the current overview" }),
    ).toBeInTheDocument();
  });

  it("copies a raw definition and announces the result", async () => {
    const user = userEvent.setup();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderExplorer({
      view: "definition",
      definitionKey: "Portfolio",
      tab: "raw",
    });

    await user.click(
      screen.getByRole("button", { name: "Copy definition" }),
    );
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText("Copied to the clipboard."),
    ).toBeInTheDocument();
  });

  it("requests the raw tab through the URL owner", async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderExplorer({
      view: "definition",
      definitionKey: "Portfolio",
    });
    await user.click(screen.getByRole("tab", { name: "Raw" }));
    expect(onNavigate).toHaveBeenCalledWith({ tab: "raw" });
  });

  it("requests search changes with replace navigation", async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderExplorer();
    await user.type(
      screen.getByRole("searchbox", { name: "Search the dictionary" }),
      "q",
    );
    expect(onNavigate).toHaveBeenCalledWith(
      { query: "q" },
      { replace: true },
    );
  });

  it("requests filter changes with replace navigation", async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderExplorer();
    await user.selectOptions(
      screen.getByLabelText("Definition kind"),
      "fact_type",
    );
    expect(onNavigate).toHaveBeenCalledWith(
      { kind: "fact_type" },
      { replace: true },
    );
  });

  it("renders search results and clears them", async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderExplorer({ query: "quantity" });
    const results = screen.getByRole("region", { name: "Search results" });
    expect(within(results).getByText("Position")).toBeInTheDocument();
    expect(
      within(results).getAllByText(/Matched: field: quantity/).length,
    ).toBeGreaterThan(0);
    await user.click(
      screen.getByRole("button", { name: "Clear search and filters" }),
    );
    expect(onNavigate).toHaveBeenCalledWith(
      {
        query: "",
        kind: "all",
        subject: null,
        aggregate: null,
      },
      { replace: true },
    );
  });

  it("shows a distinct no-match state", () => {
    renderExplorer({ query: "zzzz-not-in-the-dictionary" });
    expect(
      screen.getByText(
        "No dictionary item matched the current search and filters.",
      ),
    ).toBeInTheDocument();
  });
});
