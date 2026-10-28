import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  IdentifierBatchInput,
  parseIdentifierBatch,
  parseIdentifierLine,
} from "../IdentifierBatchInput";

describe("identifier parsing", () => {
  it("splits at the last colon and normalizes the type", () => {
    expect(parseIdentifierLine("ticker:xnas:aapl").identifier).toEqual({
      scheme: "TICKER:XNAS",
      value: "aapl",
    });
  });

  it("rejects an empty type or value", () => {
    expect(parseIdentifierLine("TICKER").error).toContain("TYPE:VALUE");
    expect(parseIdentifierLine("TICKER:").error).toContain("TYPE:VALUE");
    expect(parseIdentifierLine(":AAPL").error).toContain("TYPE:VALUE");
  });

  it("removes duplicates and preserves first occurrence", () => {
    const parsed = parseIdentifierBatch(
      "TICKER:AAPL\nTICKER:MSFT\nTICKER:AAPL",
    );
    expect(parsed.duplicates).toBe(1);
    expect(parsed.identifiers.map((identifier) => identifier.value)).toEqual([
      "AAPL",
      "MSFT",
    ]);
  });
});

describe("IdentifierBatchInput", () => {
  it("adds a single identifier and shows the parsed pair", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <IdentifierBatchInput
        text=""
        identifiers={[]}
        onChange={onChange}
      />,
    );

    await user.type(
      screen.getByLabelText("Add one identifier"),
      "TICKER:XNAS:AAPL",
    );
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onChange).toHaveBeenCalledWith(
      "TICKER:XNAS:AAPL",
      [{ scheme: "TICKER:XNAS", value: "AAPL" }],
    );
  });

  it("discloses duplicates from pasted text", () => {
    render(
      <IdentifierBatchInput
        text={"TICKER:AAPL\nTICKER:AAPL"}
        identifiers={[{ scheme: "TICKER", value: "AAPL" }]}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Removed 1 duplicate identifier(s).",
    );
  });
});
