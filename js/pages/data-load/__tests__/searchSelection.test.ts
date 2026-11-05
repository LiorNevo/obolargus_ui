import type { DataLoadDraft, ParsedIdentifier } from "../../../types/dataLoad";
import {
  appendIdentifiersToDraft,
  identifierKey,
} from "../searchSelection";

function draft(overrides: Partial<DataLoadDraft> = {}): DataLoadDraft {
  return {
    domain: "market_data",
    mode: "single",
    identifierText: "",
    identifiers: [],
    date: "2026-11-04",
    from: "2026-11-01",
    to: "2026-11-04",
    concurrency: 4,
    sourceId: "yahoo_finance",
    createMissingAssets: false,
    ...overrides,
  };
}

const APPLE: ParsedIdentifier = { scheme: "TICKER:XNAS", value: "AAPL" };
const QQQM: ParsedIdentifier = { scheme: "TICKER", value: "QQQM" };

describe("identifierKey", () => {
  it("uses the parser's scheme-and-value key", () => {
    expect(identifierKey(APPLE)).toBe("TICKER:XNAS\u0000AAPL");
    expect(identifierKey({ scheme: "TICKER", value: "AAPL" })).not.toBe(
      identifierKey(APPLE),
    );
  });
});

describe("appendIdentifiersToDraft", () => {
  it("appends in input order after the existing batch", () => {
    const current = draft({
      identifierText: "MSFT",
      identifiers: [{ scheme: "TICKER", value: "MSFT" }],
    });
    const result = appendIdentifiersToDraft(current, [APPLE, QQQM]);

    expect(result.added).toEqual([APPLE, QQQM]);
    expect(result.identifiers).toEqual([
      { scheme: "TICKER", value: "MSFT" },
      APPLE,
      QQQM,
    ]);
    expect(result.text).toBe("MSFT\nTICKER:XNAS:AAPL\nTICKER:QQQM");
    expect(result.skipped).toBe(0);
  });

  it("skips exact duplicates using the shared key", () => {
    const current = draft({
      identifierText: "TICKER:XNAS:AAPL",
      identifiers: [APPLE],
    });
    const result = appendIdentifiersToDraft(current, [
      APPLE,
      QQQM,
      { scheme: "TICKER:XNAS", value: "AAPL" },
    ]);

    expect(result.added).toEqual([QQQM]);
    expect(result.skipped).toBe(2);
    expect(result.identifiers).toEqual([APPLE, QQQM]);
  });

  it("keeps the same value under a different scheme", () => {
    const current = draft({
      identifierText: "TICKER:AAPL",
      identifiers: [{ scheme: "TICKER", value: "AAPL" }],
    });
    const result = appendIdentifiersToDraft(current, [APPLE]);

    expect(result.added).toEqual([APPLE]);
    expect(result.skipped).toBe(0);
  });

  it("preserves every untouched draft field", () => {
    const current = draft({
      identifierText: "MSFT",
      identifiers: [{ scheme: "TICKER", value: "MSFT" }],
      mode: "range",
      createMissingAssets: true,
    });
    const result = appendIdentifiersToDraft(current, [APPLE]);

    expect(result.text).toBe("MSFT\nTICKER:XNAS:AAPL");
    expect(result.identifiers).toEqual([
      { scheme: "TICKER", value: "MSFT" },
      APPLE,
    ]);
    // The helper is deliberately limited to the batch fields.
    expect(Object.keys(result).sort()).toEqual([
      "added",
      "identifiers",
      "skipped",
      "text",
    ]);
    expect(current.mode).toBe("range");
    expect(current.createMissingAssets).toBe(true);
    expect(current.sourceId).toBe("yahoo_finance");
  });

  it("rebuilds text from parsed identifiers when the text is empty", () => {
    const current = draft({
      identifierText: "   ",
      identifiers: [{ scheme: "TICKER", value: "MSFT" }],
    });
    const result = appendIdentifiersToDraft(current, [APPLE]);

    expect(result.text).toBe("TICKER:MSFT\nTICKER:XNAS:AAPL");
  });

  it("returns the unchanged batch when nothing is addable", () => {
    const current = draft({
      identifierText: "MSFT",
      identifiers: [{ scheme: "TICKER", value: "MSFT" }],
    });
    const result = appendIdentifiersToDraft(current, []);

    expect(result.added).toEqual([]);
    expect(result.identifiers).toEqual(current.identifiers);
    expect(result.text).toBe("MSFT");
  });
});
