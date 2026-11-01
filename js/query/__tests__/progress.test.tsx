import { act, renderHook, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "../testUtils";
import { createTestQueryClient } from "../client";
import { useRangeProgressQuery } from "../progressQueries";
import { queryKeys } from "../keys";
import { fetchProgress } from "../../api/dataLoad";
import type { RangeProgress } from "../../types/dataLoad";

jest.mock("../../api/dataLoad", () => ({
  ...jest.requireActual("../../api/dataLoad"),
  fetchProgress: jest.fn(),
}));

const mockedProgress = jest.mocked(fetchProgress);

function progress(status: RangeProgress["status"]): RangeProgress {
  return {
    group_id: "group-1",
    status,
    dates_requested: 2,
    dates_completed: status === "running" ? 1 : 2,
    dates_failed: 0,
    dates_with_loads: 1,
    started_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:01Z",
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockedProgress.mockResolvedValue(progress("running"));
});

afterEach(() => {
  jest.useRealTimers();
});

async function flush(): Promise<void> {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
    await Promise.resolve();
  });
}

describe("range progress query", () => {
  it("does not poll without a group id", async () => {
    const wrapper = createQueryWrapper(createTestQueryClient());
    renderHook(() => useRangeProgressQuery(null), { wrapper });
    await flush();
    expect(mockedProgress).not.toHaveBeenCalled();
  });

  it("polls every two seconds and shares one request between observers", async () => {
    const wrapper = createQueryWrapper(createTestQueryClient());
    const { result } = renderHook(
      () => [useRangeProgressQuery("group-1"), useRangeProgressQuery("group-1")],
      { wrapper },
    );

    await flush();
    expect(mockedProgress).toHaveBeenCalledTimes(1);
    expect(result.current[0].data?.status).toBe("running");

    await act(async () => {
      await jest.advanceTimersByTimeAsync(2_000);
    });
    await flush();
    expect(mockedProgress).toHaveBeenCalledTimes(2);
    expect(result.current[1].data?.status).toBe("running");
  });

  it("stops polling after a terminal status", async () => {
    mockedProgress
      .mockResolvedValueOnce(progress("running"))
      .mockResolvedValue(progress("complete"));
    const wrapper = createQueryWrapper(createTestQueryClient());
    const { result } = renderHook(() => useRangeProgressQuery("group-1"), {
      wrapper,
    });

    await flush();
    expect(mockedProgress).toHaveBeenCalledTimes(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(2_000);
    });
    await flush();
    expect(mockedProgress).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(result.current.data?.status).toBe("complete"),
    );

    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });
    await flush();
    expect(mockedProgress).toHaveBeenCalledTimes(2);
  });

  it("keeps the last progress when a poll fails", async () => {
    mockedProgress
      .mockResolvedValueOnce(progress("running"))
      .mockRejectedValueOnce(new Error("offline"));
    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);
    const { result } = renderHook(() => useRangeProgressQuery("group-1"), {
      wrapper,
    });

    await flush();
    expect(result.current.data?.status).toBe("running");

    await act(async () => {
      await jest.advanceTimersByTimeAsync(2_000);
    });
    expect(result.current.data?.status).toBe("running");
    await waitFor(() => expect(mockedProgress).toHaveBeenCalledTimes(2));
    expect(
      client.getQueryState(queryKeys.dataLoad.progress("group-1"))?.error,
    ).toBeInstanceOf(Error);
    expect(result.current.data?.status).toBe("running");
  });

  it("resumes polling when a stale active run is observed again", async () => {
    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);
    const first = renderHook(() => useRangeProgressQuery("group-1"), {
      wrapper,
    });
    await flush();
    expect(first.result.current.data?.status).toBe("running");
    first.unmount();

    const second = renderHook(() => useRangeProgressQuery("group-1"), {
      wrapper,
    });
    expect(second.result.current.data?.status).toBe("running");
    await flush();
    expect(mockedProgress).toHaveBeenCalledTimes(2);
  });
});
