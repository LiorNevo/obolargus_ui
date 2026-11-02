import { WORKER_MESSAGE } from "./constants";
import { isRuntimeDataCacheName } from "./cachePolicy";
import { useOfflineStore } from "./offlineStore";

/** Outcome of an identity-boundary cache clear. */
export interface CacheClearResult {
  clearedCaches: string[];
  failedCaches: string[];
  completedAt: number;
}

interface ClearReply {
  cleared: string[];
  failed: string[];
}

function requestId(): string {
  return `clear-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function askWorker(
  controller: ServiceWorker,
  reason: "identity-change" | "sign-out",
  timeoutMs = 5_000,
): Promise<ClearReply> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      reject(new Error("Timed out waiting for the worker to clear caches."));
    }, timeoutMs);

    channel.port1.onmessage = (event: MessageEvent) => {
      clearTimeout(timer);
      const reply = event.data as { type?: string; payload?: ClearReply };
      channel.port1.close();
      if (reply?.type === WORKER_MESSAGE.cachesCleared && reply.payload) {
        resolve(reply.payload);
        return;
      }
      reject(new Error("The worker returned an unexpected cache-clear reply."));
    };

    controller.postMessage(
      {
        type: WORKER_MESSAGE.clearCaches,
        requestId: requestId(),
        payload: { reason },
      },
      [channel.port2],
    );
  });
}

async function deleteRuntimeCachesDirectly(): Promise<ClearReply> {
  if (typeof caches === "undefined") {
    return { cleared: [], failed: ["cache-storage-unavailable"] };
  }
  const names = await caches.keys();
  const cleared: string[] = [];
  const failed: string[] = [];
  await Promise.all(
    names.map(async (name) => {
      if (!isRuntimeDataCacheName(name)) return;
      try {
        if (await caches.delete(name)) cleared.push(name);
        else failed.push(name);
      } catch {
        failed.push(name);
      }
    }),
  );
  return { cleared, failed };
}

/**
 * Clears every runtime data cache before a new identity renders.
 *
 * The precached app shell is preserved because it contains no server data. A
 * failed clear is a blocking identity error, never a best-effort warning.
 */
export async function clearOfflineCachesForIdentityChange(
  reason: "identity-change" | "sign-out" = "identity-change",
): Promise<CacheClearResult> {
  const store = useOfflineStore.getState();
  store.setIdentityClear({
    clearRequestedAt: Date.now(),
    clearStatus: "clearing",
    error: null,
  });

  let reply: ClearReply | null = null;
  const controller =
    typeof navigator === "undefined" ? null : navigator.serviceWorker?.controller;
  if (controller) {
    try {
      reply = await askWorker(controller, reason);
    } catch (error) {
      console.warn("[offline] worker cache clear failed; trying directly", error);
    }
  }

  if (!reply || reply.failed.length > 0) {
    const direct = await deleteRuntimeCachesDirectly();
    reply = reply
      ? {
          cleared: [...reply.cleared, ...direct.cleared],
          failed: direct.failed.length > 0 ? direct.failed : reply.failed,
        }
      : direct;
  }

  const failedCaches = reply?.failed ?? [];
  const clearedCaches = reply?.cleared ?? [];
  store.setIdentityClear({
    clearStatus: failedCaches.length > 0 ? "failed" : "cleared",
    error:
      failedCaches.length > 0
        ? "Offline data from the previous identity could not be cleared."
        : null,
  });

  return {
    clearedCaches,
    failedCaches,
    completedAt: Date.now(),
  };
}
