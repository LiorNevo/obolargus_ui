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
  if (message.includes("[lx-client-table] IndexedDB unavailable")) return;
  originalWarn.apply(console, args);
};

// React Router's data-router runtime relies on the Web Encoding API, which the
// Jest 29 jsdom environment does not provide. `whatwg-fetch` above supplies
// Request/Response/Headers/fetch for the same environment.
if (typeof globalThis.TextEncoder === "undefined") {
  Object.assign(globalThis, { TextEncoder, TextDecoder });
}

export {};
