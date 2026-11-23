import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { AuthGate } from "../AuthGate";
import { loadGoogleIdentityServices } from "../gis";
import { useAuthStore } from "../store";
import { UserMenu } from "../UserMenu";
import {
  clearOfflineCachesForIdentityChange,
} from "../../offline/identityBoundary";
import { createTestQueryClient } from "../../query/client";
import { createQueryWrapper } from "../../query/testUtils";

jest.mock("../gis", () => ({
  loadGoogleIdentityServices: jest.fn().mockResolvedValue({
    accounts: {
      id: {
        initialize: jest.fn(),
        renderButton: jest.fn(),
        disableAutoSelect: jest.fn(),
      },
    },
  }),
}));

jest.mock("../../offline/identityBoundary", () => ({
  clearOfflineCachesForIdentityChange: jest.fn().mockResolvedValue({
    clearedCaches: [],
    failedCaches: [],
    completedAt: 0,
  }),
}));

const mockedLoadGis = jest.mocked(loadGoogleIdentityServices);
const mockedClearCaches = jest.mocked(clearOfflineCachesForIdentityChange);

function resetAuth(): void {
  useAuthStore.setState({
    status: "signedOut",
    actor: null,
    accessToken: null,
    refreshToken: null,
    error: null,
  });
}

function renderWithQuery(ui: ReactElement) {
  const client = createTestQueryClient();
  const wrapper = createQueryWrapper(client);
  return { client, ...render(ui, { wrapper }) };
}

describe("auth UI", () => {
  beforeEach(async () => {
    await useAuthStore.persist.rehydrate();
    resetAuth();
    jest.clearAllMocks();
  });

  it("shows the development banner and the workspace when auth is disabled", () => {
    render(
      <AuthGate authEnabled={false}>
        <div>Workspace</div>
      </AuthGate>,
    );

    expect(screen.getByTestId("dev-mode-banner")).toHaveTextContent(
      /authentication is disabled/i,
    );
    expect(screen.getByText("Workspace")).toBeInTheDocument();
  });

  it("renders the Google sign-in screen for a signed-out session", async () => {
    const google = await mockedLoadGis();
    const renderButton = google.accounts.id.renderButton as jest.Mock;
    const initialize = google.accounts.id.initialize as jest.Mock;
    renderWithQuery(
      <AuthGate googleClientId="client-1">
        <div>Workspace</div>
      </AuthGate>,
    );

    expect(
      await screen.findByRole("heading", { name: "Obolargus" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("google-signin-button")).toBeInTheDocument(),
    );
    expect(renderButton).toHaveBeenCalled();
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: "client-1" }),
    );
    expect(screen.queryByText("Workspace")).toBeNull();
  });

  it("shows a configuration error when no Google client id is configured", async () => {
    renderWithQuery(
      <AuthGate googleClientId="">
        <div>Workspace</div>
      </AuthGate>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /GOOGLE_CLIENT_ID/,
    );
    expect(screen.queryByText("Workspace")).toBeNull();
  });

  it("shows a sign-in failure without revealing other accounts", async () => {
    useAuthStore.setState({
      status: "signedOut",
      error: {
        code: "account_not_allowed",
        message: "This Google account is not allowed to use this workspace.",
        retryAfterSeconds: null,
      },
    });
    renderWithQuery(
      <AuthGate googleClientId="client-1">
        <div>Workspace</div>
      </AuthGate>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /not allowed to use this workspace/i,
    );
  });

  it("renders the workspace for a signed-in actor", async () => {
    useAuthStore.setState({
      status: "signedIn",
      actor: { id: "actor-1", email: "owner@example.com" },
      accessToken: "access-1",
      refreshToken: "refresh-1",
    });
    renderWithQuery(
      <AuthGate googleClientId="client-1">
        <div>Workspace</div>
      </AuthGate>,
    );

    expect(await screen.findByText("Workspace")).toBeInTheDocument();
  });

  it("clears identity caches when a new actor signs in", async () => {
    const { client } = renderWithQuery(
      <AuthGate googleClientId="client-1">
        <div>Workspace</div>
      </AuthGate>,
    );
    const clearSpy = jest.spyOn(client, "clear");
    await screen.findByRole("heading", { name: "Obolargus" });

    act(() => {
      useAuthStore.setState({
        status: "signedIn",
        actor: { id: "actor-2", email: "second@example.com" },
        accessToken: "access-2",
        refreshToken: "refresh-2",
      });
    });

    await waitFor(() =>
      expect(mockedClearCaches).toHaveBeenCalledWith("identity-change"),
    );
    expect(clearSpy).toHaveBeenCalled();
    expect(await screen.findByText("Workspace")).toBeInTheDocument();
  });

  it("blocks sign-out when identity caches cannot be cleared", async () => {
    useAuthStore.setState({
      status: "signedIn",
      actor: { id: "actor-1", email: "owner@example.com" },
      accessToken: "access-1",
      refreshToken: "refresh-1",
    });
    mockedClearCaches.mockResolvedValueOnce({
      clearedCaches: [],
      failedCaches: ["obolargus-api"],
      completedAt: 0,
    });
    renderWithQuery(<UserMenu />);

    await userEvent.click(
      screen.getByRole("button", { name: /Account menu for owner@example/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/sign-out is blocked/i),
    );
    expect(useAuthStore.getState().actor).not.toBeNull();
  });

  it("blocks a new workspace when identity caches cannot be cleared", async () => {
    mockedClearCaches.mockResolvedValueOnce({
      clearedCaches: [],
      failedCaches: ["obolargus-api"],
      completedAt: 0,
    });
    renderWithQuery(
      <AuthGate googleClientId="client-1">
        <div>Workspace</div>
      </AuthGate>,
    );
    await screen.findByRole("heading", { name: "Obolargus" });

    act(() => {
      useAuthStore.setState({
        status: "signedIn",
        actor: { id: "actor-2", email: "second@example.com" },
        accessToken: "access-2",
        refreshToken: "refresh-2",
      });
    });

    expect(
      await screen.findByRole("heading", { name: "Workspace unavailable" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(screen.queryByText("Workspace")).toBeNull();
  });

  it("retries a failed Google script load", async () => {
    mockedLoadGis.mockRejectedValueOnce(
      new Error("Google Identity Services could not be loaded."),
    );
    renderWithQuery(
      <AuthGate googleClientId="client-1">
        <div>Workspace</div>
      </AuthGate>,
    );

    expect(
      await screen.findByText(/could not be loaded/i),
    ).toBeInTheDocument();
    const retry = screen.getByRole("button", {
      name: "Retry Google sign-in",
    });
    await userEvent.click(retry);

    await waitFor(() =>
      expect(mockedLoadGis).toHaveBeenCalledTimes(2),
    );
  });

  it("signs out through the user menu and clears identity caches", async () => {
    useAuthStore.setState({
      status: "signedIn",
      actor: { id: "actor-1", email: "owner@example.com" },
      accessToken: "access-1",
      refreshToken: "refresh-1",
    });
    const { client } = renderWithQuery(<UserMenu />);
    const clearSpy = jest.spyOn(client, "clear");

    await userEvent.click(
      screen.getByRole("button", { name: /Account menu for owner@example/i }),
    );
    expect(screen.getByRole("dialog", { name: "Account menu" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog", { name: "Account menu" })).getByText(
        "owner@example.com",
      ),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(mockedClearCaches).toHaveBeenCalledWith("sign-out"));
    expect(clearSpy).toHaveBeenCalled();
    expect(useAuthStore.getState().actor).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });
});
