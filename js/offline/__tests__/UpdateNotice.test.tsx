import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { UpdateNotice } from "../UpdateNotice";
import { useOfflineStore } from "../offlineStore";
import {
  setActiveCoordinator,
  type UpdateCoordinator,
} from "../updateCoordinator";

const coordinator = {
  acceptUpdate: jest.fn(),
  deferUpdate: jest.fn(),
  confirmSafePoint: jest.fn(),
} as unknown as UpdateCoordinator;

describe("UpdateNotice", () => {
  beforeEach(() => {
    useOfflineStore.getState().reset();
    setActiveCoordinator(coordinator);
    jest.clearAllMocks();
  });

  afterEach(() => {
    setActiveCoordinator(null);
  });

  it("offers reload and later without blocking", async () => {
    useOfflineStore
      .getState()
      .setUpdateState({ state: "available", availableVersion: "v2" });
    render(<UpdateNotice />);
    expect(screen.getByRole("status")).toHaveTextContent(/new version/i);

    await userEvent.click(screen.getByRole("button", { name: /reload to update/i }));
    expect(coordinator.acceptUpdate).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /later/i }));
    expect(coordinator.deferUpdate).toHaveBeenCalled();
  });

  it("keeps a deferred notice discoverable", () => {
    useOfflineStore.getState().setUpdateState({ state: "deferred" });
    render(<UpdateNotice />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("asks for a safe point when a draft blocks the update", async () => {
    useOfflineStore.getState().setUpdateState({ state: "pending" });
    render(<UpdateNotice />);
    expect(screen.getByText(/save your work/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /reload now/i }));
    expect(coordinator.confirmSafePoint).toHaveBeenCalled();
  });

  it("shows a recoverable failure message", () => {
    useOfflineStore.getState().setUpdateState({
      state: "failed",
      error: "Update failed; retrying later.",
    });
    render(<UpdateNotice />);
    expect(screen.getByRole("status")).toHaveTextContent(/retrying later/i);
  });

  it("has no accessibility violations", async () => {
    useOfflineStore.getState().setUpdateState({ state: "available" });
    const { container } = render(<UpdateNotice />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
