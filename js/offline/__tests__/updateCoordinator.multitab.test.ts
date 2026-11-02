import type { Workbox, WorkboxLifecycleEvent } from "workbox-window";
import { UpdateCoordinator } from "../updateCoordinator";
import { createOfflineStore } from "../offlineStore";
import { useUpdateTabRegistry } from "../../store/updateTabRegistry";

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

  addEventListener = (
    type: string,
    listener: (event: WorkboxLifecycleEvent) => void,
  ) => {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  };

  removeEventListener = (
    type: string,
    listener: (event: WorkboxLifecycleEvent) => void,
  ) => {
    this.listeners.get(type)?.delete(listener);
  };

  emit(type: string, event: Partial<WorkboxLifecycleEvent> = {}): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event as WorkboxLifecycleEvent);
    }
  }
}

class FakeChannel {
  onmessage: ((event: MessageEvent) => void) | null = null;
  close = jest.fn();
  postMessage: (data: Broadcast) => void;

  constructor(deliver: (data: Broadcast, from: FakeChannel) => void) {
    this.postMessage = (data) => deliver(data, this);
  }
}

function setup(options: { tabId: string; unsaved: boolean; channels: FakeChannel[] }) {
  const wb = new FakeWorkbox();
  const reload = jest.fn();
  const store = createOfflineStore();
  const channels = options.channels;
  const deliver = (data: Broadcast, from: FakeChannel) => {
    for (const channel of channels) {
      if (channel === from) continue;
      channel.onmessage?.({ data } as MessageEvent);
    }
  };
  const coordinator = new UpdateCoordinator(wb as unknown as Workbox, {
    channelFactory: () => {
      const channel = new FakeChannel(deliver);
      channels.push(channel);
      return channel as unknown as BroadcastChannel;
    },
    reload,
    hasUnsavedWork: () => options.unsaved,
    now: () => 1_000,
    tabId: options.tabId,
    documentRef: null,
    store,
  });
  return { wb, reload, store, coordinator };
}

describe("multi-tab update coordination", () => {
  beforeEach(() => {
    useUpdateTabRegistry.getState().clear();
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
    });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    useUpdateTabRegistry.getState().clear();
  });

  it("keeps a pending tab on the previous version and blocks cleanup", () => {
    const channels: FakeChannel[] = [];
    const a = setup({ tabId: "a", unsaved: false, channels });
    const b = setup({ tabId: "b", unsaved: true, channels });
    a.coordinator.start();
    b.coordinator.start();

    a.wb.emit("waiting", {
      sw: { scriptURL: "https://x/sw-v2.js" } as unknown as ServiceWorker,
    });
    expect(a.store.getState().update.state).toBe("available");
    expect(b.store.getState().update.state).toBe("available");
    expect(useUpdateTabRegistry.getState().tabIds).toEqual(["a", "b"]);

    a.coordinator.acceptUpdate();
    expect(b.store.getState().update.state).toBe("pending");
    expect(useUpdateTabRegistry.getState().pendingTabIds).toEqual(["b"]);

    a.wb.emit("activated");
    expect(a.reload).toHaveBeenCalledTimes(1);
    expect(b.reload).not.toHaveBeenCalled();
    expect(useUpdateTabRegistry.getState().canCleanup(1_001)).toBe(false);

    const postMessage = jest.fn();
    Object.defineProperty(navigator, "serviceWorker", {
      value: { controller: { postMessage } },
      configurable: true,
    });
    window.dispatchEvent(new Event("pagehide"));
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "CLEANUP_RETIRED_CACHES" }),
    );

    a.coordinator.stop();
    b.coordinator.stop();
  });

  it("reloads a pending tab only at a confirmed safe point", () => {
    const b = setup({ tabId: "b", unsaved: true, channels: [] });
    b.coordinator.start();
    b.store.getState().setUpdateState({ state: "pending" });
    b.coordinator.confirmSafePoint();
    expect(b.reload).toHaveBeenCalledTimes(1);
    b.coordinator.stop();
  });
});
