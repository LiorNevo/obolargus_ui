import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LastUpdatedLabel } from "../../offline/LastUpdatedLabel";
import { useOfflineStore } from "../../offline/offlineStore";
import { hashQueryKey } from "../../offline/responseProvenance";

const QUERY_KEY = ["manual-refresh-offline"];

function Probe() {
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      throw new Error("network unavailable");
    },
    initialData: { value: 1 },
    retry: false,
    staleTime: 0,
  });

  return (
    <div>
      <span data-testid="value">{query.data?.value}</span>
      <span data-testid="refreshing">{String(query.isFetching)}</span>
      <button type="button" onClick={() => void query.refetch()}>
        Refresh now
      </button>
    </div>
  );
}

describe("manual refresh while offline", () => {
  beforeEach(() => {
    useOfflineStore.getState().reset();
    useOfflineStore.getState().recordProvenance({
      queryKeyHash: hashQueryKey(QUERY_KEY),
      requestUrl: "query:manual",
      source: "cache",
      cachedAt: Date.now(),
      fetchedAt: Date.now(),
      offline: true,
    });
  });

  it("preserves the cached result and its label when refresh fails", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <LastUpdatedLabel queryKey={QUERY_KEY} />
        <Probe />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId("value")).toHaveTextContent("1");
    expect(screen.getByText(/cached · last updated/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /refresh now/i }));

    await waitFor(() =>
      expect(screen.getByTestId("refreshing")).toHaveTextContent("false"),
    );
    expect(screen.getByTestId("value")).toHaveTextContent("1");
    expect(screen.getByText(/cached · last updated/i)).toBeInTheDocument();
  });
});
