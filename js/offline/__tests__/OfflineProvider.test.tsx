import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { createTestQueryClient } from "../../query/client";
import { OfflineProvider } from "../OfflineProvider";
import { useOfflineStore } from "../offlineStore";

function wrap(children: ReactNode, client = createTestQueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <OfflineProvider>{children}</OfflineProvider>
    </QueryClientProvider>,
  );
}

describe("OfflineProvider", () => {
  beforeEach(() => {
    useOfflineStore.getState().reset();
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("keeps a populated view visible while offline", () => {
    wrap(<div data-testid="content">populated</div>);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByTestId("content")).toHaveTextContent("populated");
    expect(screen.getByRole("status")).toHaveTextContent(/offline/i);
    expect(useOfflineStore.getState().status.state).toBe("offline");
  });

  it("reconnects, clears the status, and refreshes active reads", () => {
    jest.useFakeTimers();
    const client = createTestQueryClient();
    const refetch = jest.spyOn(client, "refetchQueries");
    wrap(<div>content</div>, client);

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(useOfflineStore.getState().status.state).toBe("reconnecting");

    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    expect(useOfflineStore.getState().status.state).toBe("online");
    expect(refetch).toHaveBeenCalledWith({ type: "active", stale: true });
    expect(refetch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "active" }),
    );
  });

  it("cleans up listeners on unmount", () => {
    const remove = jest.spyOn(window, "removeEventListener");
    const { unmount } = wrap(<div>content</div>);
    unmount();
    expect(remove).toHaveBeenCalledWith("online", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("offline", expect.any(Function));
  });
});
