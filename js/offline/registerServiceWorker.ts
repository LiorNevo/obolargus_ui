import { Workbox } from "workbox-window";
import { BASE_PATH } from "./paths";
import {
  UpdateCoordinator,
  setActiveCoordinator,
} from "./updateCoordinator";

let instance: Workbox | null = null;
let coordinator: UpdateCoordinator | null = null;

/** Returns true when the runtime should register the production worker. */
export function canRegisterServiceWorker(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  if (typeof navigator === "undefined" || !navigator.serviceWorker) {
    return false;
  }
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return false;
  }
  return true;
}

/**
 * Registers the production service worker after the initial render.
 *
 * Registration never blocks first paint. A failure is logged and the app
 * remains fully usable online.
 */
export function registerServiceWorker(): Workbox | null {
  if (!canRegisterServiceWorker()) return null;
  if (instance) return instance;

  const wb = new Workbox(`${BASE_PATH}/service-worker.js`, {
    scope: `${BASE_PATH}/`,
  });
  instance = wb;

  coordinator = new UpdateCoordinator(wb);
  setActiveCoordinator(coordinator);
  coordinator.attach();

  wb.register()
    .then(() => {
      coordinator?.start();
    })
    .catch((error: unknown) => {
      console.error("[offline] service-worker registration failed", error);
      coordinator?.stop();
      coordinator = null;
      setActiveCoordinator(null);
      instance = null;
    });

  return wb;
}

/** Returns the registered Workbox controller, if any. */
export function getServiceWorkerController(): Workbox | null {
  return instance;
}

/** Resets module state between tests. */
export function resetServiceWorkerForTests(): void {
  coordinator?.stop();
  coordinator = null;
  instance = null;
  setActiveCoordinator(null);
}
