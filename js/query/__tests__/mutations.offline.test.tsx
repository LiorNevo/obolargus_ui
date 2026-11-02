import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  loadOnce,
  loadRange,
  toggleSource,
} from "../../api/dataLoad";
import { OfflineWriteError } from "../../offline/errors";
import { createTestQueryClient } from "../client";
import {
  useLoadOnceMutation,
  useLoadRangeMutation,
  useToggleSourceMutation,
} from "../mutations";

jest.mock("../../api/dataLoad", () => ({
  ...jest.requireActual("../../api/dataLoad"),
  toggleSource: jest.fn(),
  loadOnce: jest.fn(),
  loadRange: jest.fn(),
}));

const mockedToggle = jest.mocked(toggleSource);
const mockedOnce = jest.mocked(loadOnce);
const mockedRange = jest.mocked(loadRange);

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

describe("offline write rejection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
    });
  });

  it("rejects every mutation before the network call", async () => {
    const { result } = renderHook(
      () => ({
        toggle: useToggleSourceMutation("market_data"),
        once: useLoadOnceMutation(),
        range: useLoadRangeMutation(),
      }),
      { wrapper },
    );

    await act(async () => {
      await expect(
        result.current.toggle.mutateAsync({ sourceId: "s1", enabled: true }),
      ).rejects.toBeInstanceOf(OfflineWriteError);
      await expect(
        result.current.once.mutateAsync({
          identifiers: [],
          date: "2026-01-01",
          source: null,
          create_missing_assets: false,
          data_domain: "market_data",
        }),
      ).rejects.toBeInstanceOf(OfflineWriteError);
      await expect(
        result.current.range.mutateAsync({
          identifiers: [],
          from: "2026-01-01",
          to: "2026-01-02",
          concurrency: 1,
          source: null,
          create_missing_assets: false,
          data_domain: "market_data",
          client_group_id: "g1",
        }),
      ).rejects.toBeInstanceOf(OfflineWriteError);
    });

    expect(mockedToggle).not.toHaveBeenCalled();
    expect(mockedOnce).not.toHaveBeenCalled();
    expect(mockedRange).not.toHaveBeenCalled();
  });
});
