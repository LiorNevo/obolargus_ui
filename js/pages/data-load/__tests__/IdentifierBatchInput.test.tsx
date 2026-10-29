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

  it("treats a bare ticker as TICKER", () => {
    expect(parseIdentifierLine("QQQM").identifier).toEqual({
      scheme: "TICKER",
      value: "QQQM",
    });
  });

  it("rejects an empty type or value", () => {
    expect(parseIdentifierLine("TICKER:").error).toContain("TYPE:VALUE");
    expect(parseIdentifierLine(":AAPL").error).toContain("TYPE:VALUE");
  });

  it("rejects a bare value containing spaces", () => {
    expect(parseIdentifierLine("QQ QM").error).toContain("spaces");
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

  it("mixes bare tickers and typed identifiers", () => {
    const parsed = parseIdentifierBatch("QQQM\nTICKER:XNAS:AAPL");
    expect(parsed.errors).toEqual([]);
    expect(parsed.identifiers).toEqual([
      { scheme: "TICKER", value: "QQQM" },
      { scheme: "TICKER:XNAS", value: "AAPL" },
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

  it("adds a bare ticker from the Add field", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <IdentifierBatchInput
        text=""
        identifiers={[]}
        onChange={onChange}
      />,
    );

    await user.type(screen.getByLabelText("Add one identifier"), "QQQM");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onChange).toHaveBeenCalledWith("QQQM", [
      { scheme: "TICKER", value: "QQQM" },
    ]);
    expect(screen.getByLabelText("Add one identifier")).toHaveValue("");
  });

  it("shows an error instead of silently ignoring an invalid Add", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <IdentifierBatchInput
        text=""
        identifiers={[]}
        onChange={onChange}
      />,
    );

    await user.type(screen.getByLabelText("Add one identifier"), "TICKER:");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/must be TYPE:VALUE/)).toBeInTheDocument();
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
