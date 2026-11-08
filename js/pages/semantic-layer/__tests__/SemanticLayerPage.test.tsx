import {
  createMemoryRouter,
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
} from "react-router-dom";
import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQueryClient } from "../../../query/testUtils";
import { useOfflineStore } from "../../../offline/offlineStore";
import { SemanticLayerPage } from "../../SemanticLayerPage";
import {
  semanticDictionaryFixture,
  semanticDictionaryResponse,
} from "../__fixtures__/semanticDictionary";
import { makeLargeSemanticDictionary } from "../__fixtures__/largeSemanticDictionary";

function renderPage(path = "/semantic-layer") {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/semantic-layer" element={<SemanticLayerPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function successFetch() {
  return jest
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(semanticDictionaryResponse());
}

describe("SemanticLayerPage", () => {
  beforeEach(() => {
    useOfflineStore.getState().reset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders the overview with version metadata and counts", async () => {
    successFetch();
    renderPage();

    expect(
      await screen.findByText("Dictionary contents"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Schema 1.0.0").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Model 0.1.0").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Domain entities").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fact types").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fact value shapes").length).toBeGreaterThan(0);
  });

  it("loads a definition from the URL", async () => {
    successFetch();
    renderPage("/semantic-layer?def=Portfolio");

    expect(
      await screen.findByRole("heading", { level: 2, name: "Portfolio" }),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("region", { name: "Fields of Portfolio" }),
      ).getByRole("grid"),
    ).toBeInTheDocument();
    expect(screen.getByText("parent_id")).toBeInTheDocument();
  });

  it("loads a fact type from the URL", async () => {
    successFetch();
    renderPage("/semantic-layer?def=FactType.market_price");

    expect(
      await screen.findByRole("heading", { level: 2, name: "Market price" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Subjects")).toBeInTheDocument();
    expect(screen.getAllByText("asset").length).toBeGreaterThan(0);
    expect(screen.getByText("open")).toBeInTheDocument();
  });

  it("loads the system semantics view", async () => {
    successFetch();
    renderPage("/semantic-layer?view=system");

    const detail = await screen.findByRole("region", {
      name: "Dictionary detail",
    });
    expect(
      within(detail).getByRole("heading", {
        level: 2,
        name: "System semantics",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Portfolio graph is a DAG.")).toBeInTheDocument();
  });

  it("loads the whole canonical document", async () => {
    successFetch();
    renderPage("/semantic-layer?view=document");

    expect(
      await screen.findByRole("region", { name: "Canonical dictionary" }),
    ).toHaveTextContent('"$schema"');
  });

  it("loads a raw definition tab", async () => {
    successFetch();
    renderPage("/semantic-layer?def=Portfolio&tab=raw");

    expect(
      await screen.findByRole("region", { name: "Portfolio raw definition" }),
    ).toHaveTextContent('"x-obolargus-entity": "Portfolio"');
    expect(
      screen.getByRole("button", { name: "Copy definition" }),
    ).toBeInTheDocument();
  });

  it("restores views through browser back and forward", async () => {
    const user = userEvent.setup();
    successFetch();
    const router = createMemoryRouter(
      [{ path: "/semantic-layer", element: <SemanticLayerPage /> }],
      { initialEntries: ["/semantic-layer?def=Portfolio"] },
    );
    renderWithQueryClient(<RouterProvider router={router} />);

    expect(
      await screen.findByRole("heading", { level: 2, name: "Portfolio" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("link", { name: "Semantic Layer" }),
    );
    expect(await screen.findByText("Dictionary contents")).toBeInTheDocument();

    await act(async () => {
      await router.navigate(-1);
    });
    expect(
      await screen.findByRole("heading", { level: 2, name: "Portfolio" }),
    ).toBeInTheDocument();

    await act(async () => {
      await router.navigate(1);
    });
    expect(await screen.findByText("Dictionary contents")).toBeInTheDocument();
  });

  it("shows an in-page not-found state for an unknown definition", async () => {
    successFetch();
    renderPage("/semantic-layer?def=Missing");

    expect(await screen.findByText("Definition not found")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to the current overview" }),
    ).toBeInTheDocument();
  });

  it("searches the dictionary and shows match context", async () => {
    const user = userEvent.setup();
    successFetch();
    renderPage();

    const input = await screen.findByRole("searchbox", {
      name: "Search the dictionary",
    });
    await user.type(input, "quantity");

    const results = await screen.findByRole("region", {
      name: "Search results",
    });
    expect(within(results).getByText("Position")).toBeInTheDocument();
    expect(
      within(results).getAllByText(/Matched: field: quantity/).length,
    ).toBeGreaterThan(0);
  });

  it("filters search results by kind", async () => {
    const user = userEvent.setup();
    successFetch();
    renderPage();

    await screen.findByRole("searchbox", { name: "Search the dictionary" });
    await user.selectOptions(
      screen.getByLabelText("Definition kind"),
      "fact_type",
    );

    const results = await screen.findByRole("region", {
      name: "Search results",
    });
    expect(within(results).getByText("Market price")).toBeInTheDocument();
    expect(within(results).queryByText("Portfolio")).not.toBeInTheDocument();
  });

  it("shows an explicit load error with retry", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new TypeError("network unavailable"));
    renderPage();

    expect(
      await screen.findByRole("heading", {
        name: "The data dictionary could not be loaded",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows the loading state", () => {
    jest.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(
      screen.getByText("Loading the data dictionary..."),
    ).toBeInTheDocument();
  });

  it("shows an incomplete state for a missing envelope", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ title: "Only a title" }), {
        status: 200,
        headers: { "content-type": "application/schema+json" },
      }),
    );
    renderPage();

    expect(
      await screen.findByRole("heading", {
        name: "The data dictionary is incomplete",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/\$defs/)).toBeInTheDocument();
  });

  it("shows an empty state for an empty definition map", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ ...semanticDictionaryFixture, $defs: {} }),
        { status: 200, headers: { "content-type": "application/schema+json" } },
      ),
    );
    renderPage();

    expect(
      await screen.findByRole("heading", {
        name: "The data dictionary is empty",
      }),
    ).toBeInTheDocument();
  });

  it("retries a failed read", async () => {
    const user = userEvent.setup();
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("network unavailable"))
      .mockResolvedValueOnce(semanticDictionaryResponse());
    renderPage();

    const retry = await screen.findByRole("button", { name: "Retry" });
    await user.click(retry);

    await screen.findByRole("searchbox", { name: "Search the dictionary" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stays usable with an order-of-magnitude larger dictionary", async () => {
    const large = makeLargeSemanticDictionary(320);
    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(large), {
        status: 200,
        headers: { "content-type": "application/schema+json" },
      }),
    );
    renderPage();

    const input = await screen.findByRole(
      "searchbox",
      { name: "Search the dictionary" },
      { timeout: 10_000 },
    );
    fireEvent.change(input, { target: { value: "ExtraEntity319" } });

    const results = await screen.findByRole(
      "region",
      { name: "Search results" },
      { timeout: 10_000 },
    );
    expect(
      within(results).getByText("ExtraEntity319"),
    ).toBeInTheDocument();
  }, 20_000);

  it("downloads the canonical document from the header", async () => {
    const user = userEvent.setup();
    successFetch();
    const createObjectURL = jest.fn().mockReturnValue("blob:test");
    Object.assign(URL, { createObjectURL, revokeObjectURL: jest.fn() });
    jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    renderPage();

    await screen.findByRole("searchbox", { name: "Search the dictionary" });
    await user.click(
      screen.getByRole("button", { name: "Download dictionary" }),
    );
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });
});
