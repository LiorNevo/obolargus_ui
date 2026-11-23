import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { configureAuthBridge } from "../../api/http";
import { MorpheusHost } from "../MorpheusHost";

function json(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe("MorpheusHost", () => {
  afterEach(() => {
    configureAuthBridge(null);
  });

  it("sends the bearer token on Morpheus requests", async () => {
    configureAuthBridge({
      getAccessToken: () => "access-token",
      hasSession: () => true,
      refreshAccessToken: async () => true,
    });
    const fetchMock = jest.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/status")) return json({ enabled: false });
        return json({ items: [], total: 0, limit: 30, offset: 0 });
      },
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      render(
        <MemoryRouter>
          <MorpheusHost>
            <div />
          </MorpheusHost>
        </MemoryRouter>,
      );

      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe("/obolargus/api/morpheus/status");
      expect(
        new Headers((init as RequestInit | undefined)?.headers).get(
          "authorization",
        ),
      ).toBe("Bearer access-token");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
