import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { createTestQueryClient } from "../client";
import { useDomainsQuery } from "../dataLoadQueries";
import { queryKeys } from "../keys";
import { fetchDomains } from "../../api/dataLoad";
import type { DomainCatalog } from "../../types/dataLoad";

jest.mock("../../api/dataLoad", () => ({
  ...jest.requireActual("../../api/dataLoad"),
  fetchDomains: jest.fn(),
}));

const mockedFetchDomains = jest.mocked(fetchDomains);

const DOMAINS: DomainCatalog = {
  domains: [
    {
      id: "market_data",
      label: "Market data",
      loadable: true,
      unavailable_reason: null,
    },
  ],
};

function Probe() {
  const query = useDomainsQuery();
  return (
    <div>
      <span data-testid="data">
        {query.data?.domains[0]?.label ?? "none"}
      </span>
      <span data-testid="pending">{String(query.isPending)}</span>
      <span data-testid="fetching">{String(query.isFetching)}</span>
      <span data-testid="error">{query.error ? "error" : "ok"}</span>
    </div>
  );
}

function renderProbe(client = createTestQueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>,
  );
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("cache presentation states", () => {
  it("shows a first-load state before data exists", async () => {
    mockedFetchDomains.mockReturnValue(deferred<DomainCatalog>().promise);
    renderProbe();

    expect(screen.getByTestId("data")).toHaveTextContent("none");
    expect(screen.getByTestId("pending")).toHaveTextContent("true");
    expect(screen.getByTestId("fetching")).toHaveTextContent("true");
  });

  it("keeps cached data visible during a background refresh", async () => {
    const client = createTestQueryClient();
    client.setQueryData(queryKeys.dataLoad.domains(), DOMAINS);
    const pending = deferred<DomainCatalog>();
    mockedFetchDomains.mockReturnValue(pending.promise);
    renderProbe(client);

    expect(screen.getByTestId("data")).toHaveTextContent("Market data");
    await act(async () => {
      void client.invalidateQueries({
        queryKey: queryKeys.dataLoad.domains(),
      });
      await Promise.resolve();
    });

    expect(screen.getByTestId("data")).toHaveTextContent("Market data");
    await waitFor(() =>
      expect(screen.getByTestId("fetching")).toHaveTextContent("true"),
    );
    pending.resolve(DOMAINS);
  });

  it("keeps cached data visible when a refresh fails", async () => {
    const client = createTestQueryClient();
    client.setQueryData(queryKeys.dataLoad.domains(), DOMAINS);
    mockedFetchDomains.mockRejectedValueOnce(new Error("offline"));
    renderProbe(client);

    await act(async () => {
      await client.invalidateQueries({
        queryKey: queryKeys.dataLoad.domains(),
      });
    });

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent("error"),
    );
    expect(screen.getByTestId("data")).toHaveTextContent("Market data");
  });

  it("shows an explicit first-load error when no data exists", async () => {
    mockedFetchDomains.mockRejectedValueOnce(new Error("offline"));
    renderProbe();

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent("error"),
    );
    expect(screen.getByTestId("data")).toHaveTextContent("none");
    expect(screen.getByTestId("pending")).toHaveTextContent("false");
  });
});
