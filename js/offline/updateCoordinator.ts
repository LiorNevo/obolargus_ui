import type { Workbox, WorkboxLifecycleEvent } from "workbox-window";

/** Workbox also emits `externalwaiting`, which its type map omits. */
interface WorkboxLike {
  addEventListener(
    type: string,
    listener: (event: WorkboxLifecycleEvent) => void,
  ): void;
  removeEventListener(
    type: string,
    listener: (event: WorkboxLifecycleEvent) => void,
  ): void;
}
import {
  UPDATE_CHANNEL_NAME,
  UPDATE_CHECK_INTERVAL_MS,
  UPDATE_MESSAGE,
  WORKER_MESSAGE,
} from "./constants";
import { BUILD_ID } from "./paths";
import { useOfflineStore } from "./offlineStore";

type OfflineStoreApi = typeof useOfflineStore;
import { useUpdateTabRegistry } from "../store/updateTabRegistry";
import { useDataLoadStore } from "../store/dataLoadStore";

const TAB_ID_KEY = "obolargus_pwa_tab_id";
const CLEANUP_DELAY_MS = 1_000;

interface UpdateBroadcast {
  type: string;
  buildId: string;
  tabId: string;
}

/** Injectable seams used by tests. */
export interface UpdateCoordinatorOptions {
  channelFactory?: (name: string) => BroadcastChannel | null;
  reload?: () => void;
  hasUnsavedWork?: () => boolean;
  now?: () => number;
  documentRef?: Document | null;
  tabId?: string;
  store?: OfflineStoreApi;
}

function defaultTabId(): string {
  try {
    const existing = sessionStorage.getItem(TAB_ID_KEY);
    if (existing) return existing;
    const generated =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `tab-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    sessionStorage.setItem(TAB_ID_KEY, generated);
    return generated;
  } catch {
    return `tab-${Math.random().toString(36).slice(2)}`;
  }
}

function defaultHasUnsavedWork(): boolean {
  return useDataLoadStore.getState().draft.identifierText.trim().length > 0;
}

/**
 * Coordinates update detection, operator confirmation, and multi-tab reloads.
 *
 * Activation is never forced: the worker waits for an explicit message, and a
 * tab with unsaved work stays on the previous version until it is safe.
 */
export class UpdateCoordinator {
  private readonly wb: Workbox;
  private readonly channel: BroadcastChannel | null;
  private readonly reload: () => void;
  private readonly hasUnsavedWork: () => boolean;
  private readonly now: () => number;
  private readonly documentRef: Document | null;
  private readonly tabId: string;
  private readonly store: OfflineStoreApi;
  private timer: ReturnType<typeof setInterval> | null = null;
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  private attached = false;

  constructor(wb: Workbox, options: UpdateCoordinatorOptions = {}) {
    this.wb = wb;
    this.channel =
      options.channelFactory?.(UPDATE_CHANNEL_NAME) ??
      (typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel(UPDATE_CHANNEL_NAME));
    this.reload =
      options.reload ??
      (() => {
        if (typeof window !== "undefined") window.location.reload();
      });
    this.hasUnsavedWork = options.hasUnsavedWork ?? defaultHasUnsavedWork;
    this.now = options.now ?? (() => Date.now());
    this.documentRef =
      options.documentRef ??
      (typeof document === "undefined" ? null : document);
    this.tabId = options.tabId ?? defaultTabId();
    this.store = options.store ?? useOfflineStore;
  }

  /**
   * Attaches event listeners without starting timers or an update check.
   *
   * Registration calls this before `register()` so a worker that is already
   * waiting cannot be missed.
   */
  attach(): void {
    if (this.attached) return;
    this.attached = true;
    this.wbEvents.addEventListener("waiting", this.handleWaiting);
    this.wbEvents.addEventListener("externalwaiting", this.handleWaiting);
    this.wbEvents.addEventListener("activated", this.handleActivated);
    this.wbEvents.addEventListener("redundant", this.handleRedundant);
    if (this.channel) this.channel.onmessage = this.handleBroadcast;
    this.documentRef?.addEventListener("visibilitychange", this.handleVisibility);
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", this.handlePageHide);
    }
  }

  /** Starts listeners, the periodic check, and post-reload cleanup. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.attach();

    this.timer = setInterval(
      () => this.checkForUpdate(),
      UPDATE_CHECK_INTERVAL_MS,
    );

    // The update registry is rehydrated asynchronously from IndexedDB.
    this.cleanupTimer = setTimeout(
      () => this.cleanupAfterReload(),
      CLEANUP_DELAY_MS,
    );

    this.checkForUpdate();
  }

  /** Stops every listener and timer. */
  stop(): void {
    this.started = false;
    if (this.attached) {
      this.attached = false;
      this.wbEvents.removeEventListener("waiting", this.handleWaiting);
      this.wbEvents.removeEventListener("externalwaiting", this.handleWaiting);
      this.wbEvents.removeEventListener("activated", this.handleActivated);
      this.wbEvents.removeEventListener("redundant", this.handleRedundant);
      if (this.channel) this.channel.onmessage = null;
      this.documentRef?.removeEventListener(
        "visibilitychange",
        this.handleVisibility,
      );
      if (typeof window !== "undefined") {
        window.removeEventListener("pagehide", this.handlePageHide);
      }
    }
    if (this.timer) clearInterval(this.timer);
    if (this.cleanupTimer) clearTimeout(this.cleanupTimer);
    this.timer = null;
    this.cleanupTimer = null;
    this.channel?.close();
  }

  /** Checks for a newer deployment when the browser is online. */
  checkForUpdate(): void {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    const state = this.store.getState().update.state;
    if (state === "available" || state === "deferred") return;

    this.setState({ state: "checking", lastCheckAt: this.now() });
    void this.wb
      .update()
      .then(() => {
        if (this.store.getState().update.state === "checking") {
          this.setState({ state: "idle" });
        }
      })
      .catch((error: unknown) => {
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          this.setState({ state: "idle" });
          return;
        }
        console.error("[offline] update check failed", error);
        this.setState({
          state: "failed",
          error: "The update check failed. It will retry later.",
        });
      });
  }

  /** Accepts the waiting update and coordinates every open tab. */
  acceptUpdate(): void {
    const state = this.store.getState().update;
    const buildId = state.availableVersion ?? "pending";
    const registry = useUpdateTabRegistry.getState();
    if (registry.buildId !== buildId) registry.begin(buildId, this.now());
    registry.addTab(this.tabId);
    this.setState({ state: "activating", error: null });
    this.broadcast(UPDATE_MESSAGE.accepted, buildId);
    this.wb.messageSkipWaiting();
  }

  /** Defers the update while keeping the notice discoverable. */
  deferUpdate(): void {
    const state = this.store.getState().update;
    this.setState({ state: "deferred", deferredUntil: this.now() });
    const buildId = state.availableVersion ?? "pending";
    useUpdateTabRegistry.getState().addTab(this.tabId);
    this.broadcast(UPDATE_MESSAGE.available, buildId);
  }

  /** Reloads a pending tab after the operator reaches a safe point. */
  confirmSafePoint(): void {
    if (this.store.getState().update.state !== "pending") return;
    this.setState({ state: "activating" });
    this.reload();
  }

  private get wbEvents(): WorkboxLike {
    return this.wb as unknown as WorkboxLike;
  }

  private setState(
    patch: Partial<ReturnType<typeof useOfflineStore.getState>["update"]>,
  ): void {
    this.store.getState().setUpdateState(patch);
  }

  private broadcast(type: string, buildId: string): void {
    this.channel?.postMessage({ type, buildId, tabId: this.tabId });
  }

  private currentBuildId(): string {
    return this.store.getState().update.availableVersion ?? BUILD_ID;
  }

  private handleWaiting = (event: WorkboxLifecycleEvent): void => {
    const buildId = event.sw?.scriptURL ?? this.currentBuildId();
    this.setState({
      state: "available",
      availableVersion: buildId,
      detectedAt: this.now(),
      error: null,
    });
    const registry = useUpdateTabRegistry.getState();
    if (registry.buildId !== buildId) registry.begin(buildId, this.now());
    registry.addTab(this.tabId);
    this.broadcast(UPDATE_MESSAGE.available, buildId);
  };

  private handleActivated = (): void => {
    const state = this.store.getState().update.state;
    if (state === "activating") {
      this.broadcast(UPDATE_MESSAGE.reloaded, this.currentBuildId());
      this.reload();
      return;
    }
    if (state === "pending") return;
    this.setState({ state: "idle" });
  };

  private handleRedundant = (): void => {
    this.setState({
      state: "failed",
      error: "The update could not be activated. It will retry later.",
    });
  };

  private handleBroadcast = (event: MessageEvent): void => {
    const data = event.data as UpdateBroadcast;
    if (!data || typeof data.type !== "string") return;
    const registry = useUpdateTabRegistry.getState();

    switch (data.type) {
      case UPDATE_MESSAGE.available: {
        if (registry.buildId !== data.buildId) {
          registry.begin(data.buildId, this.now());
        }
        registry.addTab(data.tabId);
        registry.addTab(this.tabId);
        if (
          this.store.getState().update.state === "idle" ||
          this.store.getState().update.state === "checking"
        ) {
          this.setState({
            state: "available",
            availableVersion: data.buildId,
            detectedAt: this.now(),
            error: null,
          });
        }
        break;
      }
      case UPDATE_MESSAGE.accepted: {
        if (this.hasUnsavedWork()) {
          this.setState({ state: "pending" });
          registry.markPending(this.tabId);
          this.broadcast(UPDATE_MESSAGE.pending, data.buildId);
        } else {
          this.setState({ state: "activating" });
        }
        break;
      }
      case UPDATE_MESSAGE.pending:
        registry.markPending(data.tabId);
        break;
      case UPDATE_MESSAGE.reloaded:
        registry.markReloaded(data.tabId);
        this.cleanupIfReady();
        break;
      case UPDATE_MESSAGE.tabClosed:
        registry.markClosed(data.tabId);
        this.cleanupIfReady();
        break;
      default:
        break;
    }
  };

  private handleVisibility = (): void => {
    if (this.documentRef?.visibilityState !== "visible") return;
    const lastCheckAt = this.store.getState().update.lastCheckAt ?? 0;
    if (this.now() - lastCheckAt >= UPDATE_CHECK_INTERVAL_MS) {
      this.checkForUpdate();
    }
  };

  private handlePageHide = (): void => {
    this.broadcast(UPDATE_MESSAGE.tabClosed, this.currentBuildId());
    useUpdateTabRegistry.getState().markClosed(this.tabId);
    this.cleanupIfReady();
  };

  /**
   * Marks this tab as reloaded after an activation and retires old caches once
   * every announced tab has reloaded or closed.
   */
  private cleanupAfterReload(): void {
    const registry = useUpdateTabRegistry.getState();
    if (!registry.buildId) return;
    if (registry.tabIds.includes(this.tabId)) {
      registry.markReloaded(this.tabId);
      this.broadcast(UPDATE_MESSAGE.reloaded, registry.buildId);
    }
    this.cleanupIfReady();
  }

  private cleanupIfReady(): void {
    const registry = useUpdateTabRegistry.getState();
    if (!registry.canCleanup(this.now())) return;
    const controller =
      typeof navigator === "undefined" ? null : navigator.serviceWorker?.controller;
    controller?.postMessage({
      type: WORKER_MESSAGE.cleanupRetiredCaches,
      requestId: `cleanup-${this.now()}`,
      payload: { keepBuildId: BUILD_ID },
    });
    registry.clear();
  }
}

let activeCoordinator: UpdateCoordinator | null = null;

/** Registers the coordinator used by the update notice UI. */
export function setActiveCoordinator(
  coordinator: UpdateCoordinator | null,
): void {
  activeCoordinator = coordinator;
}

/** Returns the coordinator used by the update notice UI. */
export function getActiveCoordinator(): UpdateCoordinator | null {
  return activeCoordinator;
}
