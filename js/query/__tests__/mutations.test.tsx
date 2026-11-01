import { act, renderHook } from "@testing-library/react";
import { createQueryWrapper } from "../testUtils";
import { createTestQueryClient } from "../client";
import {
  useLoadOnceMutation,
  useLoadRangeMutation,
  useToggleSourceMutation,
} from "../mutations";
import { queryKeys } from "../keys";
import * as api from "../../api/dataLoad";
import type { LoadReport, RangeReport } from "../../types/dataLoad";

jest.mock("../../api/dataLoad", () => ({
  ...jest.requireActual("../../api/dataLoad"),
  toggleSource: jest.fn(),
  loadOnce: jest.fn(),
  loadRange: jest.fn(),
}));

const mocked = api as jest.Mocked<typeof api>;

const REPORT = {
  identifiers: [{ asset_id: "asset-1" }],
  assets_created: 1,
  assets_adopted: 0,
  loaded: 1,
  status: "complete",
} as unknown as LoadReport;

const RANGE_REPORT = {
  range_group_id: "group-1",
  dates: [{ date: "2026-10-01", report: REPORT }],
  status: "partial",
} as unknown as RangeReport;

beforeEach(() => {
  jest.clearAllMocks();
  mocked.toggleSource.mockResolvedValue({ changed: true });
  mocked.loadOnce.mockResolvedValue(REPORT);
  mocked.loadRange.mockResolvedValue(RANGE_REPORT);
});

describe("data load mutations", () => {
  it("toggles a source and invalidates only its affected reads", async () => {
    const client = createTestQueryClient();
    client.setQueryData(queryKeys.dataLoad.sources("market_data"), {});
    client.setQueryData(queryKeys.dataLoad.sources("holdings"), {});
    client.setQueryData(queryKeys.dataLoad.historyDetail("entry-1"), {});
    const wrapper = createQueryWrapper(client);
    const { result } = renderHook(
      () => useToggleSourceMutation("market_data"),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({
        sourceId: "yahoo_finance",
        enabled: false,
      });
    });

    expect(mocked.toggleSource).toHaveBeenCalledWith(
      "yahoo_finance",
      false,
    );
    expect(
      client.getQueryState(queryKeys.dataLoad.sources("market_data"))
        ?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(queryKeys.dataLoad.sources("holdings"))
        ?.isInvalidated,
    ).toBe(false);
    expect(
      client.getQueryState(queryKeys.dataLoad.historyDetail("entry-1"))
        ?.isInvalidated,
    ).toBe(true);
  });

  it("invalidates affected series and search after a single load", async () => {
    const client = createTestQueryClient();
    client.setQueryData(
      queryKeys.marketSeries.detail("asset-1", "2026-10-01", "2026-10-02"),
      {},
    );
    client.setQueryData(queryKeys.assets.search("Apple", 20), {});
    const wrapper = createQueryWrapper(client);
    const { result } = renderHook(() => useLoadOnceMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        identifiers: [{ type: "TICKER", value: "AAPL" }],
        date: "2026-10-01",
        source: null,
        create_missing_assets: false,
        data_domain: "market_data",
      });
    });

    expect(mocked.loadOnce).toHaveBeenCalledTimes(1);
    expect(
      client.getQueryState(
        queryKeys.marketSeries.detail("asset-1", "2026-10-01", "2026-10-02"),
      )?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(queryKeys.assets.search("Apple", 20))
        ?.isInvalidated,
    ).toBe(true);
  });

  it("invalidates progress after a range load", async () => {
    const client = createTestQueryClient();
    client.setQueryData(queryKeys.dataLoad.progress("group-1"), {});
    const wrapper = createQueryWrapper(client);
    const { result } = renderHook(() => useLoadRangeMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        identifiers: [{ type: "TICKER", value: "AAPL" }],
        from: "2026-10-01",
        to: "2026-10-02",
        concurrency: 2,
        source: null,
        create_missing_assets: false,
        data_domain: "market_data",
        client_group_id: "group-1",
      });
    });

    expect(
      client.getQueryState(queryKeys.dataLoad.progress("group-1"))
        ?.isInvalidated,
    ).toBe(true);
  });

  it("does not retry or invalidate when a mutation fails", async () => {
    mocked.toggleSource.mockRejectedValueOnce(new Error("offline"));
    const client = createTestQueryClient();
    client.setQueryData(queryKeys.dataLoad.sources("market_data"), {});
    const wrapper = createQueryWrapper(client);
    const { result } = renderHook(
      () => useToggleSourceMutation("market_data"),
      { wrapper },
    );

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          sourceId: "yahoo_finance",
          enabled: false,
        }),
      ).rejects.toThrow("offline");
    });

    expect(mocked.toggleSource).toHaveBeenCalledTimes(1);
    expect(
      client.getQueryState(queryKeys.dataLoad.sources("market_data"))
        ?.isInvalidated,
    ).toBe(false);
  });
});
