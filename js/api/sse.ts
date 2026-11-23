/**
 * Server-sent events over `fetch`.
 *
 * `EventSource` cannot send an `Authorization` header, so automation streams
 * use a fetch body reader instead. The parser handles CRLF, multi-line `data:`
 * fields, comments (heartbeats), and events split across chunks.
 */

import { HttpError, apiFetch } from "./http";

/** One parsed server-sent event. */
export interface SseEvent {
  event: string;
  data: string;
  id: string | null;
}

/** Handlers for an authenticated event stream. */
export interface SseHandlers {
  onEvent: (event: SseEvent) => void;
  /** Transport or HTTP failure; the stream is already closed. */
  onError?: (error: unknown) => void;
  /** The server ended the stream without an error. */
  onClose?: () => void;
}

function parseBlock(block: string): SseEvent | null {
  let event = "message";
  let id: string | null = null;
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line === "" || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const rawValue = colon === -1 ? "" : line.slice(colon + 1);
    const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
    else if (field === "id") id = value;
  }
  if (data.length === 0) return null;
  return { event, data: data.join("\n"), id };
}

/**
 * Reads one SSE response body and dispatches every complete event.
 *
 * Returns when the body ends or the signal aborts; aborts are not errors.
 */
export async function consumeSse(
  response: Response,
  signal: AbortSignal,
  onEvent: (event: SseEvent) => void,
): Promise<void> {
  const body = response.body;
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const dispatch = (block: string) => {
    const parsed = parseBlock(block.replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
    if (parsed) onEvent(parsed);
  };
  try {
    for (;;) {
      if (signal.aborted) return;
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        dispatch(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) dispatch(buffer);
  } finally {
    reader.releaseLock();
  }
}

/**
 * Opens an authenticated event stream and returns its close function.
 *
 * No request deadline is applied: a run stream is expected to stay open and
 * carries heartbeats below the gateway idle window.
 */
export function openAuthenticatedEventStream(
  path: string,
  handlers: SseHandlers,
): () => void {
  const controller = new AbortController();
  void apiFetch(path, {
    signal: controller.signal,
    timeoutMs: null,
    headers: { accept: "text/event-stream" },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new HttpError(
          response.status,
          response.status === 401 ? "unauthorized" : "request_failed",
          `The event stream failed with status ${response.status}.`,
          response.status >= 500,
        );
      }
      await consumeSse(response, controller.signal, handlers.onEvent);
      if (!controller.signal.aborted) handlers.onClose?.();
    })
    .catch((error: unknown) => {
      if (controller.signal.aborted) return;
      handlers.onError?.(error);
    });
  return () => controller.abort();
}
