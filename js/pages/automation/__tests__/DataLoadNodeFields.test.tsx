import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getComponent } from "lx_client/js/components/SchemaForm/registry";
import { IdentifierBatch, SourceSelect } from "../DataLoadNodeFields";
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
    expect(getComponent("SourceSelect")).toBe(SourceSelect);
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
