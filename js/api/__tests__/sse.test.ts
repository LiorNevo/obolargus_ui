import { configureAuthBridge } from "../http";
import {
  consumeSse,
  openAuthenticatedEventStream,
  type SseEvent,
} from "../sse";

function bodyOf(chunks: string[]): { getReader: () => unknown } {
  const encoder = new TextEncoder();
  let index = 0;
  return {
    getReader: () => ({
      read: async () =>
        index < chunks.length
          ? { value: encoder.encode(chunks[index++]), done: false }
          : { value: undefined, done: true },
      releaseLock: () => {},
    }),
  };
}

function streamResponse(chunks: string[]): Response {
  return {
    ok: true,
    status: 200,
    body: bodyOf(chunks),
    headers: new Headers({ "content-type": "text/event-stream" }),
  } as unknown as Response;
}

describe("server-sent events", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    configureAuthBridge(null);
    jest.restoreAllMocks();
  });

  it("parses events split across chunks and ignores heartbeats", async () => {
    const events: SseEvent[] = [];
    const response = streamResponse([
      ": heartbeat\n\n",
      'event: snapshot\ndata: {"status":',
      '"running"}\n\n',
      "event: message\ndata: line one\ndata: line two\n\n",
      'id: 7\nevent: end\ndata: done\n\n',
    ]);

    await consumeSse(response, new AbortController().signal, (event) =>
      events.push(event),
    );

    expect(events).toEqual([
      { event: "snapshot", data: '{"status":"running"}', id: null },
      { event: "message", data: "line one\nline two", id: null },
      { event: "end", data: "done", id: "7" },
    ]);
  });

  it("handles CRLF line endings", async () => {
    const events: SseEvent[] = [];
    const response = streamResponse(['event: run.status\r\ndata: ok\r\n\r\n']);

    await consumeSse(response, new AbortController().signal, (event) =>
      events.push(event),
    );

    expect(events).toEqual([{ event: "run.status", data: "ok", id: null }]);
  });

  it("streams with the bearer header and closes cleanly on end", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(streamResponse(["event: end\ndata: {}\n\n"]));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    configureAuthBridge({
      getAccessToken: () => "access-1",
      hasSession: () => true,
      refreshAccessToken: jest.fn().mockResolvedValue(true),
    });
    const onEvent = jest.fn();
    const onClose = jest.fn();

    openAuthenticatedEventStream("/automation/runs/r1/events", {
      onEvent,
      onClose,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers).get(
      "authorization",
    )).toBe("Bearer access-1");
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("access-1");
    expect(onEvent).toHaveBeenCalledWith({
      event: "end",
      data: "{}",
      id: null,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("ends cleanly with an unauthorized error when the token expired", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
    }) as unknown as typeof fetch;
    configureAuthBridge({
      getAccessToken: () => "expired",
      hasSession: () => false,
      refreshAccessToken: jest.fn().mockResolvedValue(false),
    });
    const onError = jest.fn();
    const onClose = jest.fn();

    openAuthenticatedEventStream("/automation/runs/r1/events", {
      onEvent: jest.fn(),
      onError,
      onClose,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, code: "unauthorized" }),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
