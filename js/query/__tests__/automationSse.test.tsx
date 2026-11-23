import { act, render } from "@testing-library/react";
import { useRunEvents } from "../automationQueries";
import { HttpError } from "../../api/http";
import type { SseHandlers } from "../../api/sse";
import { createTestQueryClient } from "../client";
import { createQueryWrapper } from "../testUtils";

const mockRefreshAccessToken = jest.fn().mockResolvedValue(true);
const mockClose = jest.fn();
const mockOpen = jest.fn((..._args: unknown[]) => mockClose);

jest.mock("../../auth/store", () => ({
  useAuthStore: (
    selector: (state: {
      refreshAccessToken: typeof mockRefreshAccessToken;
    }) => unknown,
  ) => selector({ refreshAccessToken: mockRefreshAccessToken }),
}));

jest.mock("../../api/sse", () => ({
  openAuthenticatedEventStream: (...args: unknown[]) => mockOpen(...args),
}));

function Harness({ runId = "r1" }: { runId?: string }) {
  useRunEvents(runId);
  return null;
}

function latestHandlers(): SseHandlers {
  return mockOpen.mock.calls.at(-1)?.[1] as unknown as SseHandlers;
}

describe("useRunEvents", () => {
  beforeEach(() => {
    mockOpen.mockClear();
    mockClose.mockClear();
    mockRefreshAccessToken.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("invalidates run queries for each stream event", () => {
    const client = createTestQueryClient();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    render(<Harness />, { wrapper: createQueryWrapper(client) });

    expect(mockOpen).toHaveBeenCalledTimes(1);
    act(() => {
      latestHandlers().onEvent({ event: "message", data: "{}", id: null });
    });

    expect(invalidate).toHaveBeenCalledTimes(3);
  });

  it("closes on the terminal end event and stops polling", () => {
    const client = createTestQueryClient();
    const interval = jest.spyOn(globalThis, "setInterval");
    render(<Harness />, { wrapper: createQueryWrapper(client) });

    act(() => {
      latestHandlers().onEvent({ event: "end", data: "{}", id: null });
      latestHandlers().onClose?.();
    });

    expect(mockClose).toHaveBeenCalled();
    expect(interval).not.toHaveBeenCalled();
  });

  it("falls back to polling when the stream drops", () => {
    const client = createTestQueryClient();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const interval = jest.spyOn(globalThis, "setInterval");
    render(<Harness />, { wrapper: createQueryWrapper(client) });
    const initialCalls = invalidate.mock.calls.length;

    act(() => {
      latestHandlers().onClose?.();
    });

    expect(interval).toHaveBeenCalledWith(expect.any(Function), 3_000);
    const tick = interval.mock.calls.at(-1)?.[0] as () => void;
    act(() => tick());
    expect(invalidate.mock.calls.length).toBeGreaterThan(initialCalls);
  });

  it("ends an expired-token stream without polling and asks for a refresh", async () => {
    const client = createTestQueryClient();
    const interval = jest.spyOn(globalThis, "setInterval");
    mockRefreshAccessToken.mockResolvedValueOnce(false);
    render(<Harness />, { wrapper: createQueryWrapper(client) });

    await act(async () => {
      latestHandlers().onError?.(
        new HttpError(401, "unauthorized", "expired", false),
      );
      await Promise.resolve();
    });

    expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
    expect(interval).not.toHaveBeenCalled();
  });
});
