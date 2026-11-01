import { renderHook, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "../testUtils";
import { createTestQueryClient } from "../client";
import { useHealthQuery } from "../healthQueries";
import { healthCheck } from "../../api/client";

jest.mock("../../api/client", () => ({
  healthCheck: jest.fn(),
}));

const mockedHealth = jest.mocked(healthCheck);

beforeEach(() => {
  jest.clearAllMocks();
  mockedHealth.mockResolvedValue({ status: "ok" });
});

describe("health query", () => {
  it("shares one read and serves the fresh result from cache", async () => {
    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);
    const { result, unmount } = renderHook(
      () => [useHealthQuery(), useHealthQuery()] as const,
      { wrapper },
    );

    await waitFor(() => expect(result.current[0].isSuccess).toBe(true));
    expect(result.current[1].data).toEqual({ status: "ok" });
    expect(mockedHealth).toHaveBeenCalledTimes(1);

    unmount();
    const again = renderHook(() => useHealthQuery(), { wrapper });
    expect(again.result.current.data).toEqual({ status: "ok" });
    expect(mockedHealth).toHaveBeenCalledTimes(1);
  });
});
