import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoadForm, validateDraft } from "../LoadForm";
import type { DataLoadDraft, DomainEntry, SourceCatalogEntry } from "../../../types/dataLoad";

const DOMAINS: DomainEntry[] = [
  {
    id: "market_data",
    label: "Market & reference data",
    loadable: true,
    unavailable_reason: null,
  },
  {
    id: "holdings",
    label: "Holdings",
    loadable: false,
    unavailable_reason: "Not available.",
  },
];

const SOURCE: SourceCatalogEntry = {
  source_id: "yahoo_finance",
  display_name: "Yahoo Finance",
  enabled: true,
  priority: 1,
  supported_schemes: ["TICKER"],
  supported_data_domains: ["market_data"],
  selectable_for_domain: true,
  unavailable_reason: null,
};

const DRAFT: DataLoadDraft = {
  domain: "market_data",
  mode: "single",
  identifierText: "TICKER:XNAS:AAPL",
  identifiers: [{ scheme: "TICKER:XNAS", value: "AAPL" }],
  date: "2026-10-01",
  from: "2026-10-01",
  to: "2026-10-05",
  concurrency: 4,
  sourceId: null,
  createMissingAssets: false,
};

describe("validateDraft", () => {
  it("accepts a valid single-date draft", () => {
    expect(validateDraft(DRAFT, DOMAINS, [SOURCE])).toEqual({});
  });

  it("rejects an empty batch without a request", () => {
    const errors = validateDraft(
      { ...DRAFT, identifierText: "", identifiers: [] },
      DOMAINS,
      [SOURCE],
    );
    expect(errors.identifiers).toBeDefined();
  });

  it("rejects a future date", () => {
    const errors = validateDraft(
      { ...DRAFT, date: "2999-01-01" },
      DOMAINS,
      [SOURCE],
    );
    expect(errors.date?.join(" ")).toContain("later than today");
  });

  it("rejects an inverted range and a bad window", () => {
    const errors = validateDraft(
      {
        ...DRAFT,
        mode: "range",
        from: "2026-10-05",
        to: "2026-10-01",
        concurrency: 0,
      },
      DOMAINS,
      [SOURCE],
    );
    expect(errors.range).toBeDefined();
    expect(errors.concurrency).toBeDefined();
  });

  it("rejects a non-loadable domain", () => {
    const errors = validateDraft(
      { ...DRAFT, domain: "holdings" },
      DOMAINS,
      [SOURCE],
    );
    expect(errors.domain?.join(" ")).toContain("Not available");
  });

  it("rejects a load when no source is enabled", () => {
    const errors = validateDraft(DRAFT, DOMAINS, [
      { ...SOURCE, enabled: false, selectable_for_domain: false },
    ]);
    expect(errors.source).toBeDefined();
  });
});


describe("LoadForm", () => {
  it("switches modes, renders range fields, and submits", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const onSubmit = jest.fn();
    render(
      <LoadForm
        draft={DRAFT}
        domains={DOMAINS}
        sources={[{ ...SOURCE, selectable_for_domain: true }]}
        errors={{}}
        running={false}
        catalogError="offline"
        onChange={onChange}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText(/source catalog is unavailable/)).toBeInTheDocument();
    await user.click(screen.getByLabelText("Date range"));
    expect(onChange).toHaveBeenCalledWith({ mode: "range" });
    await user.click(screen.getByRole("button", { name: "Load" }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("shows the no-source reason and disables the submit only while running", () => {
    const { rerender } = render(
      <LoadForm
        draft={DRAFT}
        domains={DOMAINS}
        sources={[{ ...SOURCE, enabled: false, selectable_for_domain: false }]}
        errors={{ source: ["No source is enabled"] }}
        running
        onChange={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("No source is enabled");
    rerender(
      <LoadForm
        draft={{ ...DRAFT, mode: "range", createMissingAssets: true }}
        domains={DOMAINS}
        sources={[SOURCE]}
        errors={{}}
        running={false}
        onChange={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Range start" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Range end" })).toBeInTheDocument();
    expect(screen.getByLabelText("Window (1–32)")).toBeInTheDocument();
  });
});
