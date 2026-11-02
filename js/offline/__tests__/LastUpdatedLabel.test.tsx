import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import {
  LastUpdatedLabel,
  OfflineReadSummary,
} from "../LastUpdatedLabel";
import { useOfflineStore } from "../offlineStore";
import { hashQueryKey } from "../responseProvenance";

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = jest.spyOn(client, "invalidateQueries");
  return {
    ...render(
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
    ),
    invalidate,
  };
}

function seed(
  queryKey: unknown[],
  options: {
    source: "cache" | "network";
    cachedAt?: number | null;
    fetchedAt?: number;
  },
) {
  useOfflineStore.getState().recordProvenance({
    queryKeyHash: hashQueryKey(queryKey),
    requestUrl: "query:test",
    source: options.source,
    cachedAt: options.cachedAt ?? null,
    fetchedAt: options.fetchedAt ?? Date.now(),
    offline: options.source === "cache",
  });
}

describe("LastUpdatedLabel", () => {
  beforeEach(() => {
    useOfflineStore.getState().reset();
  });

  it("labels a cached read with its last-updated time", () => {
    const key = ["data-load", "domains"];
    seed(key, { source: "cache", cachedAt: 1_700_000_000_000 });
    renderWithClient(<LastUpdatedLabel queryKey={key} />);
    expect(screen.getByText(/cached/i)).toBeInTheDocument();
    expect(screen.getByText(/last updated/i)).toBeInTheDocument();
  });

  it("labels a network read as live", () => {
    const key = ["market-series", "a"];
    seed(key, { source: "network", fetchedAt: 1_700_000_000_000 });
    renderWithClient(<LastUpdatedLabel queryKey={key} />);
    expect(screen.getByText(/live/i)).toBeInTheDocument();
  });

  it("reports an expired in-memory read as unavailable offline", async () => {
    const key = ["data-load", "history"];
    seed(key, {
      source: "cache",
      cachedAt: Date.now() - 25 * 60 * 60 * 1000,
    });
    useOfflineStore
      .getState()
      .setConnectivity("offline", "browser-offline");
    const { invalidate } = renderWithClient(
      <LastUpdatedLabel queryKey={key} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /no longer available offline/i,
    );
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: key }),
    );
  });

  it("renders nothing without provenance", () => {
    const { container } = renderWithClient(
      <LastUpdatedLabel queryKey={["missing"]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("OfflineReadSummary", () => {
  beforeEach(() => {
    useOfflineStore.getState().reset();
  });

  it("shows the most recent cached read", () => {
    seed(["a"], { source: "network", fetchedAt: 1 });
    seed(["b"], { source: "cache", cachedAt: 2, fetchedAt: 2 });
    renderWithClient(<OfflineReadSummary />);
    expect(screen.getByText(/cached/i)).toBeInTheDocument();
  });

  it("reports expired cached data offline", () => {
    seed(["b"], {
      source: "cache",
      cachedAt: Date.now() - 25 * 60 * 60 * 1000,
    });
    useOfflineStore
      .getState()
      .setConnectivity("offline", "browser-offline");
    renderWithClient(<OfflineReadSummary />);
    expect(screen.getByText(/expired/i)).toBeInTheDocument();
  });
});
