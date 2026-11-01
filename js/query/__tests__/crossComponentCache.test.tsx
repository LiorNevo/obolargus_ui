import { render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { createTestQueryClient } from "../client";
import { useDomainsQuery } from "../dataLoadQueries";
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

function Consumer({ label }: { label: string }) {
  const query = useDomainsQuery();
  return (
    <span>
      {label}:{query.data?.domains[0]?.label ?? "pending"}
    </span>
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

describe("cross-component cache reuse", () => {
  it("shares one request between components and reuses it after remount", async () => {
    const client = createTestQueryClient();
    const pending = deferred<DomainCatalog>();
    mockedFetchDomains.mockReturnValue(pending.promise);
    const view = (
      <QueryClientProvider client={client}>
        <Consumer label="A" />
        <Consumer label="B" />
      </QueryClientProvider>
    );

    const first = render(view);
    await waitFor(() => expect(mockedFetchDomains).toHaveBeenCalledTimes(1));
    pending.resolve(DOMAINS);
    expect(await screen.findByText("A:Market data")).toBeInTheDocument();
    expect(screen.getByText("B:Market data")).toBeInTheDocument();
    first.unmount();

    render(view);
    expect(screen.getByText("A:Market data")).toBeInTheDocument();
    expect(mockedFetchDomains).toHaveBeenCalledTimes(1);
  });
});
