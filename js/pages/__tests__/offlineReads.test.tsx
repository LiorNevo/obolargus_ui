import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  LastUpdatedLabel,
  OfflineReadSummary,
} from "../../offline/LastUpdatedLabel";
import { useOfflineStore } from "../../offline/offlineStore";
import { hashQueryKey } from "../../offline/responseProvenance";

function renderWithClient(ui: ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      {ui}
    </QueryClientProvider>,
  );
}

function seed(queryKey: unknown[], cachedAt: number) {
  useOfflineStore.getState().recordProvenance({
    queryKeyHash: hashQueryKey(queryKey),
    requestUrl: "query:test",
    source: "cache",
    cachedAt,
    fetchedAt: cachedAt,
    offline: true,
  });
}

describe("offline read presentation", () => {
  beforeEach(() => {
    useOfflineStore.getState().reset();
  });

  it("shows the dashboard summary for the latest cached read", () => {
    seed(["market-series", "AAPL"], Date.now());
    renderWithClient(<OfflineReadSummary />);
    expect(screen.getByText(/cached · last updated/i)).toBeInTheDocument();
  });

  it("shows a per-surface last-updated label for data-load reads", () => {
    const domainsKey = ["data-load", "domains"];
    const historyKey = [
      "data-load",
      "history",
      "list",
      {},
      { limit: 50, offset: 0 },
    ];
    seed(domainsKey, Date.now());
    seed(historyKey, Date.now());
    renderWithClient(
      <>
        <LastUpdatedLabel queryKey={domainsKey} />
        <LastUpdatedLabel queryKey={historyKey} />
      </>,
    );
    expect(screen.getAllByText(/cached · last updated/i)).toHaveLength(2);
  });

  it("shows the explicit offline-unavailable state for expired data", () => {
    const key = ["data-load", "history", "detail", "entry-1"];
    seed(key, Date.now() - 25 * 60 * 60 * 1000);
    useOfflineStore
      .getState()
      .setConnectivity("offline", "browser-offline");
    renderWithClient(<LastUpdatedLabel queryKey={key} />);
    expect(screen.getByText(/no longer available offline/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
