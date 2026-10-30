import "whatwg-fetch";
import "@testing-library/jest-dom";
import { toHaveNoViolations } from "jest-axe";
import { TextDecoder, TextEncoder } from "node:util";

jest.mock("tslog", () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    silly: jest.fn(),
  })),
}));

expect.extend(toHaveNoViolations);

// lx_client's table store probes for IndexedDB and falls back to an in-memory
// implementation when it is unavailable. jsdom does not implement IndexedDB, so
// that fallback is the expected path in tests; silence its notice to keep the
// coverage output clean (mirrors lx_client's own jest.setup.js).
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const message = typeof args[0] === "string" ? args[0] : "";
  if (message.includes("[lx-client-table] IndexedDB unavailable") || message.includes("[lx-client-storage] IndexedDB unavailable")) return;
  originalWarn.apply(console, args);
};

// React Router's data-router runtime relies on the Web Encoding API, which the
// Jest 29 jsdom environment does not provide. `whatwg-fetch` above supplies
// Request/Response/Headers/fetch for the same environment.
if (typeof globalThis.TextEncoder === "undefined") {
  Object.assign(globalThis, { TextEncoder, TextDecoder });
}

export {};

// --- Dashboard test environment -------------------------------------------
if (typeof globalThis.BroadcastChannel === "undefined") {
  class TestBroadcastChannel {
    static channels = new Map<string, Set<TestBroadcastChannel>>();
    onmessage: ((event: { data: unknown }) => void) | null = null;
    private closed = false;
    constructor(public name: string) {
      const channels = TestBroadcastChannel.channels.get(name) ?? new Set();
      channels.add(this);
      TestBroadcastChannel.channels.set(name, channels);
    }
    postMessage(data: unknown): void {
      if (this.closed) return;
      for (const channel of TestBroadcastChannel.channels.get(this.name) ?? []) {
        if (channel === this || channel.closed) continue;
        channel.onmessage?.({ data });
      }
    }
    close(): void {
      this.closed = true;
      TestBroadcastChannel.channels.get(this.name)?.delete(this);
    }
  }
  (globalThis as unknown as { BroadcastChannel: unknown }).BroadcastChannel =
    TestBroadcastChannel;
}

if (typeof globalThis.requestAnimationFrame === "undefined") {
  (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = (
    callback: (time: number) => void,
  ) => setTimeout(() => callback(Date.now()), 0);
  (globalThis as unknown as { cancelAnimationFrame: unknown }).cancelAnimationFrame = (
    handle: ReturnType<typeof setTimeout>,
  ) => clearTimeout(handle);
}

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
