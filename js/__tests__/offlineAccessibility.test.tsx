import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { createTestQueryClient } from "../query/client";
import { OfflineProvider } from "../offline/OfflineProvider";
import { useOfflineStore } from "../offline/offlineStore";

function renderApp() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <OfflineProvider>
        <button type="button">Primary action</button>
      </OfflineProvider>
    </QueryClientProvider>,
  );
}

describe("offline accessibility", () => {
  beforeEach(() => {
    useOfflineStore.getState().reset();
  });

  it("announces the offline state without moving focus", async () => {
    renderApp();
    const button = screen.getByRole("button", { name: /primary action/i });
    button.focus();
    expect(document.activeElement).toBe(button);

    act(() => {
      useOfflineStore.getState().setConnectivity("offline", "browser-offline");
    });

    expect(document.activeElement).toBe(button);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it("announces one update notice per state without focus changes", async () => {
    renderApp();
    act(() => {
      useOfflineStore.getState().setUpdateState({
        state: "available",
        availableVersion: "v2",
      });
    });
    expect(screen.getAllByText(/new version/i)).toHaveLength(1);
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
