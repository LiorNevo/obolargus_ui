import { Workbox } from "workbox-window";
import {
  canRegisterServiceWorker,
  registerServiceWorker,
  resetServiceWorkerForTests,
  unregisterServiceWorkers,
} from "../registerServiceWorker";

jest.mock("workbox-window", () => {
  const instance = {
    register: jest.fn().mockResolvedValue(undefined),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
    messageSkipWaiting: jest.fn(),
  };
  return { Workbox: jest.fn().mockImplementation(() => instance) };
});

const MockWorkbox = jest.mocked(Workbox);
const originalNodeEnv = process.env.NODE_ENV;

function enableProductionSupport(): void {
  process.env.NODE_ENV = "production";
  Object.defineProperty(window, "isSecureContext", {
    value: true,
    configurable: true,
  });
  Object.defineProperty(navigator, "serviceWorker", {
    value: {},
    configurable: true,
  });
}

describe("registerServiceWorker", () => {
  beforeEach(() => {
    resetServiceWorkerForTests();
    MockWorkbox.mockClear();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    resetServiceWorkerForTests();
  });

  it("returns early outside production", () => {
    process.env.NODE_ENV = "test";
    expect(canRegisterServiceWorker()).toBe(false);
    expect(registerServiceWorker()).toBeNull();
    expect(MockWorkbox).not.toHaveBeenCalled();
  });

  it("returns early without service-worker support", () => {
    process.env.NODE_ENV = "production";
    Object.defineProperty(navigator, "serviceWorker", {
      value: undefined,
      configurable: true,
    });
    expect(canRegisterServiceWorker()).toBe(false);
    expect(registerServiceWorker()).toBeNull();
  });

  it("returns early in an insecure context", () => {
    enableProductionSupport();
    Object.defineProperty(window, "isSecureContext", {
      value: false,
      configurable: true,
    });
    expect(canRegisterServiceWorker()).toBe(false);
  });

  it("registers the worker under the base path with the matching scope", async () => {
    enableProductionSupport();
    const controller = registerServiceWorker();
    expect(controller).not.toBeNull();
    expect(MockWorkbox).toHaveBeenCalledWith("/obolargus/service-worker.js", {
      scope: "/obolargus/",
    });
    await Promise.resolve();
    await Promise.resolve();
    const instance = MockWorkbox.mock.results[0].value as {
      register: jest.Mock;
      update: jest.Mock;
    };
    expect(instance.register).toHaveBeenCalled();
    expect(instance.update).toHaveBeenCalled();
  });

  it("unregisters workers and clears cache storage", async () => {
    const unregister = jest.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, "serviceWorker", {
      value: { getRegistrations: jest.fn().mockResolvedValue([{ unregister }]) },
      configurable: true,
    });
    const deleteCache = jest.fn().mockResolvedValue(true);
    Object.defineProperty(globalThis, "caches", {
      value: {
        keys: jest.fn().mockResolvedValue(["obolargus-ui-v1"]),
        delete: deleteCache,
      },
      configurable: true,
    });
    await unregisterServiceWorkers();
    expect(unregister).toHaveBeenCalled();
    expect(deleteCache).toHaveBeenCalledWith("obolargus-ui-v1");
  });

  it("returns the existing registration on repeat calls", () => {
    enableProductionSupport();
    const first = registerServiceWorker();
    const second = registerServiceWorker();
    expect(second).toBe(first);
    expect(MockWorkbox).toHaveBeenCalledTimes(1);
  });
});
