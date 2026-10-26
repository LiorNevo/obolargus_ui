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

// React Router's data-router runtime relies on the Web Encoding API, which the
// Jest 29 jsdom environment does not provide. `whatwg-fetch` above supplies
// Request/Response/Headers/fetch for the same environment.
if (typeof globalThis.TextEncoder === "undefined") {
  Object.assign(globalThis, { TextEncoder, TextDecoder });
}

export {};
