import {
  SemanticLayerApiError,
  fetchSemanticLayerDocument,
} from "../semanticLayer";
import {
  semanticDictionaryCanonicalText,
  semanticDictionaryFixture,
} from "../../pages/semantic-layer/__fixtures__/semanticDictionary";

describe("semantic layer transport", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("keeps the exact response text and parses the same bytes", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(semanticDictionaryCanonicalText, {
          status: 200,
          headers: {
            "content-type": "application/schema+json; charset=utf-8",
          },
        }),
      );
    const onMeta = jest.fn();

    const result = await fetchSemanticLayerDocument(undefined, onMeta);

    expect(String(fetchMock.mock.calls[0][0])).toContain("/domain/schema");
    expect(fetchMock.mock.calls[0][1]).toEqual({ signal: undefined });
    expect(result.canonicalText).toBe(semanticDictionaryCanonicalText);
    expect(result.document).toEqual(semanticDictionaryFixture);
    expect(onMeta).toHaveBeenCalledWith(
      expect.objectContaining({ source: "network" }),
    );
  });

  it("reads the nested error envelope", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "infrastructure", message: "database offline" },
        }),
        { status: 500, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(fetchSemanticLayerDocument()).rejects.toMatchObject({
      name: "SemanticLayerApiError",
      status: 500,
      code: "infrastructure",
      message: "database offline",
      retryable: true,
    });
  });

  it("reads the flat error envelope returned by the export endpoint", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "infrastructure",
          message: "schema generation failed",
        }),
        { status: 500, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(fetchSemanticLayerDocument()).rejects.toMatchObject({
      code: "infrastructure",
      message: "schema generation failed",
    });
  });

  it("keeps plain-text failures as diagnostics", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("service unavailable", {
        status: 503,
        headers: { "content-type": "text/plain" },
      }),
    );

    await expect(fetchSemanticLayerDocument()).rejects.toMatchObject({
      code: "request_failed",
      message: "service unavailable",
    });
  });

  it("reports invalid JSON explicitly", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not json", {
        status: 200,
        headers: { "content-type": "application/schema+json" },
      }),
    );

    await expect(fetchSemanticLayerDocument()).rejects.toMatchObject({
      code: "invalid_json",
      message: "The dictionary response was not valid JSON.",
    });
  });

  it("passes the abort signal to fetch", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(semanticDictionaryCanonicalText, { status: 200 }),
      );
    const controller = new AbortController();

    await fetchSemanticLayerDocument(controller.signal);

    expect(String(fetchMock.mock.calls[0][0])).toContain("/domain/schema");
    expect(fetchMock.mock.calls[0][1]).toEqual({ signal: controller.signal });
  });

  it("exposes a retryable class for status failures", () => {
    const error = new SemanticLayerApiError(500, "infrastructure", "failed");
    expect(error).toBeInstanceOf(Error);
    expect(error.retryable).toBe(true);
    expect(new SemanticLayerApiError(400, "bad", "bad").retryable).toBe(false);
  });
});
