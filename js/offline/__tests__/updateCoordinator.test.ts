import type { Workbox, WorkboxLifecycleEvent } from "workbox-window";
import { UpdateCoordinator } from "../updateCoordinator";
import { useOfflineStore } from "../offlineStore";
import { useUpdateTabRegistry } from "../../store/updateTabRegistry";
import { useDataLoadStore } from "../../store/dataLoadStore";

interface Broadcast {
  type: string;
  buildId: string;
  tabId: string;
}

class FakeWorkbox {
  private listeners = new Map<
    string,
    Set<(event: WorkboxLifecycleEvent) => void>
  >();
  update = jest.fn().mockResolvedValue(undefined);
  messageSkipWaiting = jest.fn();

  addEventListener = jest.fn(
    (type: string, listener: (event: WorkboxLifecycleEvent) => void) => {
      const set = this.listeners.get(type) ?? new Set();
      set.add(listener);
      this.listeners.set(type, set);
    },
  );

  removeEventListener = jest.fn(
    (type: string, listener: (event: WorkboxLifecycleEvent) => void) => {
      this.listeners.get(type)?.delete(listener);
    },
  );

  emit(type: string, event: Partial<WorkboxLifecycleEvent> = {}): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event as WorkboxLifecycleEvent);
    }
  }
}

class FakeChannel {
  onmessage: ((event: MessageEvent) => void) | null = null;
  sent: Broadcast[] = [];
  postMessage = jest.fn((data: Broadcast) => {
    this.sent.push(data);
  });
  close = jest.fn();
}

function create(options: { tabId?: string; reload?: jest.Mock } = {}) {
  const wb = new FakeWorkbox();
  const channel = new FakeChannel();
  const reload = options.reload ?? jest.fn();
  const coordinator = new UpdateCoordinator(wb as unknown as Workbox, {
    channelFactory: () => channel as unknown as BroadcastChannel,
    reload,
    hasUnsavedWork: () => false,
    now: () => 1_000,
    tabId: options.tabId ?? "tab-a",
    documentRef: null,
  });
  return { wb, channel, reload, coordinator };
}

describe("UpdateCoordinator", () => {
  beforeEach(() => {
    useOfflineStore.getState().reset();
    useUpdateTabRegistry.getState().clear();
    useDataLoadStore.getState().reset();
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
    });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows one notice when a worker is waiting", () => {
    const { wb, channel, coordinator } = create();
    coordinator.start();
    wb.emit("waiting", { sw: { scriptURL: "https://x/sw-v2.js" } as unknown as ServiceWorker });

    expect(useOfflineStore.getState().update).toMatchObject({
      state: "available",
      availableVersion: "https://x/sw-v2.js",
    });
    expect(channel.sent.filter((m) => m.type === "UPDATE_AVAILABLE")).toHaveLength(
      1,
    );
    coordinator.stop();
  });

  it("activates only after confirmation and reloads the activating tab", () => {
    const { wb, channel, reload, coordinator } = create();
    coordinator.start();
    wb.emit("waiting", { sw: { scriptURL: "https://x/sw-v2.js" } as unknown as ServiceWorker });
    coordinator.acceptUpdate();

    expect(wb.messageSkipWaiting).toHaveBeenCalledTimes(1);
    expect(useOfflineStore.getState().update.state).toBe("activating");
    expect(channel.sent.some((m) => m.type === "UPDATE_ACCEPTED")).toBe(true);

    wb.emit("activated");
    expect(reload).toHaveBeenCalledTimes(1);
    coordinator.stop();
  });

  it("does not reload on a first install", () => {
    const { wb, reload, coordinator } = create();
    coordinator.start();
    wb.emit("activated");
    expect(reload).not.toHaveBeenCalled();
    expect(useOfflineStore.getState().update.state).toBe("idle");
    coordinator.stop();
  });

  it("defers without discarding the notice", () => {
    const { wb, coordinator } = create();
    coordinator.start();
    wb.emit("waiting", { sw: { scriptURL: "https://x/sw-v2.js" } as unknown as ServiceWorker });
    coordinator.deferUpdate();
    expect(useOfflineStore.getState().update.state).toBe("deferred");
    coordinator.stop();
  });

  it("reports a redundant worker as a recoverable failure", () => {
    const { wb, coordinator } = create();
    coordinator.start();
    wb.emit("redundant");
    expect(useOfflineStore.getState().update.state).toBe("failed");
    coordinator.stop();
  });

  it("checks quietly while offline", () => {
    const { wb, coordinator } = create();
    coordinator.start();
    wb.update.mockClear();
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });
    coordinator.checkForUpdate();
    expect(wb.update).not.toHaveBeenCalled();
    coordinator.stop();
  });

  it("checks on visibility when the interval has elapsed", () => {
    let now = 1_000;
    const wb = new FakeWorkbox();
    const doc = {
      visibilityState: "visible",
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    } as unknown as Document;
    const coordinator = new UpdateCoordinator(wb as unknown as Workbox, {
      channelFactory: () => null,
      reload: jest.fn(),
      hasUnsavedWork: () => false,
      now: () => now,
      tabId: "tab-a",
      documentRef: doc,
    });
    coordinator.start();
    const handler = (doc.addEventListener as jest.Mock).mock.calls.find(
      ([type]) => type === "visibilitychange",
    )?.[1] as () => void;
    wb.update.mockClear();
    now += 3_600_000;
    handler();
    expect(wb.update).toHaveBeenCalled();
    coordinator.stop();
  });

  it("stops listeners and timers", () => {
    const { wb, channel, coordinator } = create();
    coordinator.start();
    coordinator.stop();
    expect(wb.removeEventListener).toHaveBeenCalled();
    expect(channel.close).toHaveBeenCalled();
    expect(useUpdateTabRegistry.getState().buildId).toBeNull();
  });
});
