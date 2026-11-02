import { render, screen } from "@testing-library/react";
import { act } from "react";
import { axe } from "jest-axe";
import { OfflineStatusBar } from "../OfflineStatusBar";
import { useOfflineStore } from "../offlineStore";

describe("OfflineStatusBar", () => {
  beforeEach(() => {
    useOfflineStore.getState().reset();
  });

  it("renders nothing while online", () => {
    const { container } = render(<OfflineStatusBar />);
    expect(container).toBeEmptyDOMElement();
  });

  it("announces offline without stealing focus", () => {
    act(() => {
      useOfflineStore.getState().setConnectivity("offline", "browser-offline");
    });
    render(<OfflineStatusBar />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/offline/i);
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("announces reconnecting and unsupported states", () => {
    act(() => {
      useOfflineStore.getState().setConnectivity("reconnecting", "reconnected");
    });
    const { rerender } = render(<OfflineStatusBar />);
    expect(screen.getByRole("status")).toHaveTextContent(/reconnecting/i);

    act(() => {
      useOfflineStore.getState().setConnectivity("unsupported", "unsupported");
    });
    rerender(<OfflineStatusBar />);
    expect(screen.getByRole("status")).toHaveTextContent(/not available/i);
  });

  it("has no accessibility violations", async () => {
    act(() => {
      useOfflineStore.getState().setConnectivity("offline", "browser-offline");
    });
    const { container } = render(<OfflineStatusBar />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
