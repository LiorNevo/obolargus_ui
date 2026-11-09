import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getComponent } from "lx_client/js/components/SchemaForm/registry";
import {
  DateOrExpression,
  IdentifierBatch,
  SourceSelect,
} from "../DataLoadNodeFields";
import { renderWithQueryClient } from "../../../query/testUtils";

jest.mock("../../../query/dataLoadQueries", () => ({
  sourcesQueryOptions: () => ({
    queryKey: ["data-load", "sources", "market_data"],
    queryFn: async () => ({
      domain: "market_data",
      sources: [
        {
          source_id: "yahoo",
          display_name: "Yahoo Finance",
          enabled: true,
          priority: 1,
          supported_schemes: ["TICKER"],
          supported_data_domains: ["market_data"],
          selectable_for_domain: true,
          unavailable_reason: null,
        },
        {
          source_id: "hidden",
          display_name: "Hidden",
          enabled: false,
          priority: 2,
          supported_schemes: ["TICKER"],
          supported_data_domains: ["market_data"],
          selectable_for_domain: false,
          unavailable_reason: "disabled",
        },
      ],
    }),
  }),
}));

describe("data-load field adapters", () => {
  it("registers both adapters with SchemaForm", () => {
    expect(getComponent("IdentifierBatch")).toBe(IdentifierBatch);
    expect(getComponent("DateOrExpression")).toBe(DateOrExpression);
    expect(getComponent("SourceSelect")).toBe(SourceSelect);
  });

  it("edits a date or an expression value", () => {
    const onChange = jest.fn();
    render(
      <DateOrExpression
        id="as-of-date"
        path="as_of_date"
        value="2026-01-02"
        schema={{ title: "As of date" }}
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText("As of date");
    expect(input).toHaveValue("2026-01-02");
    fireEvent.change(input, { target: { value: "2026-02-03" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-02-03");

    onChange.mockClear();
    render(
      <DateOrExpression
        id="expression-date"
        path="as_of_date"
        value={{ kind: "reference", path: "inputs.as_of_date" }}
        schema={{ title: "As of date" }}
        onChange={onChange}
      />,
    );
    expect(screen.getAllByLabelText("As of date")[1]).toHaveValue(
      '{"kind":"reference","path":"inputs.as_of_date"}',
    );
  });

  it("parses and serializes typed identifiers", async () => {
    const onChange = jest.fn();
    render(
      <IdentifierBatch
        id="identifiers"
        path="identifiers"
        value={[
          { scheme: "TICKER", value: "XNAS:AAPL" },
          { scheme: "TICKER", value: "XNAS:MSFT" },
        ]}
        schema={{ title: "Identifiers" }}
        onChange={onChange}
      />,
    );
    const textarea = screen.getByLabelText("Identifiers");
    expect(textarea).toHaveValue("TICKER:XNAS:AAPL\nTICKER:XNAS:MSFT");
    fireEvent.change(textarea, { target: { value: "TICKER:XNAS:IBM" } });
    expect(onChange).toHaveBeenCalled();
    const latest = onChange.mock.calls.at(-1)?.[0] as Array<{
      scheme: string;
      value: string;
    }>;
    expect(latest[0]).toEqual({ scheme: "TICKER", value: "XNAS:IBM" });
  });

  it("lists only selectable sources", async () => {
    renderWithQueryClient(
      <SourceSelect
        id="source"
        path="preferred_source"
        value={null}
        schema={{ title: "Source" }}
        onChange={jest.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Yahoo Finance" })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("option", { name: "Hidden" })).not.toBeInTheDocument();
  });
});
